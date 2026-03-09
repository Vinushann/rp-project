# ATHENA - Vinushan's Context-Aware Forecasting System
**Complete Technical Documentation**

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Frontend Components](#frontend-components)
4. [Backend Services](#backend-services)
5. [Real-Time Streaming](#real-time-streaming)
6. [Multi-Agent System](#multi-agent-system)
7. [Data Flow](#data-flow)
8. [API Endpoints](#api-endpoints)
9. [Key Features](#key-features)
10. [Technical Implementation](#technical-implementation)

---

## System Overview

ATHENA (Advanced Thinking and Holistic Enterprise Navigation Assistant) is a context-aware forecasting and decision support system designed for coffee shop managers. It uses a multi-agent AI architecture powered by CrewAI to analyze historical sales data, forecast demand, assess holiday and weather impacts, and generate actionable business insights.

### Core Purpose
- Provide intelligent sales forecasting with 7-day moving average and seasonal-naive blending
- Analyze contextual factors (holidays, weather, trends) affecting business performance
- Generate real-time reasoning streams showing how AI agents collaborate to solve problems
- Deliver actionable recommendations through natural language chat interface

### Technology Stack
- **Frontend**: React 18 + Vite, Chart.js for visualizations
- **Backend**: FastAPI (Python 3.11+), CrewAI for agent orchestration
- **AI/LLM**: OpenAI GPT-4o-mini for reasoning, OpenAI TTS-1 for voice synthesis
- **Data**: CSV-based sales data (2020-2025), holiday calendar, weather impact models

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ VinushanPage │  │ ReasoningPanel│  │ AthenaChatMessage   │  │
│  │   (Main UI)  │  │   (Timeline)  │  │ (Message Display)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                  │                      │              │
│         └──────────────────┴──────────────────────┘              │
│                            │                                     │
│                    ┌───────▼────────┐                           │
│                    │   API Layer    │                           │
│                    │ (api.js/SSE)   │                           │
│                    └───────┬────────┘                           │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTP/SSE
┌────────────────────────────▼──────────────────────────────────┐
│                     BACKEND (FastAPI)                          │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Router (router.py)                         │   │
│  │  - /ping  - /chat  - /chat/stream  - /tts             │   │
│  └──────────────────┬─────────────────────────────────────┘   │
│                     │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │        Real-Time Streaming Service                      │  │
│  │      (realtime_streaming.py)                            │  │
│  │   - Event emission (SSE)                                │  │
│  │   - Run lifecycle management                            │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                     │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │        Query Router (router.py)                         │  │
│  │   - Analyzes question using GPT-4o-mini                 │  │
│  │   - Determines which agents to activate                 │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                     │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │     Dynamic Crew Builder (dynamic_crew.py)              │  │
│  │   - Builds crew with only needed agents                 │  │
│  │   - Configures sequential task execution                │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                     │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │            CrewAI Multi-Agent System                     │  │
│  │  ┌──────────┬──────────┬──────────┬──────────────────┐ │  │
│  │  │Historical│Forecasting│ Holiday  │   Weather        │ │  │
│  │  │ Analyst  │Specialist │ Analyst  │   Analyst        │ │  │
│  │  └──────────┴──────────┴──────────┴──────────────────┘ │  │
│  │  ┌──────────┬──────────────────────────────────────────┐ │
│  │  │ Strategy │    Visualization Specialist              │ │
│  │  │ Planner  │                                           │ │
│  │  └──────────┴──────────────────────────────────────────┘ │
│  └──────────────────┬──────────────────────────────────────┘  │
│                     │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │              Specialized Tools                           │  │
│  │  - ItemHistoryTool    - ForecastingTool                 │  │
│  │  - HolidayContextTool - WeatherContextTool              │  │
│  │  - 7 Visualization Chart Tools                          │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Frontend Components

### 1. VinushanPage.jsx
**Main container component for the ATHENA interface**

#### Responsibilities:
- Manages chat state (messages, loading, errors)
- Handles real-time event streaming from backend
- Coordinates between chat display and reasoning panel
- Manages input and message submission

#### State Management:
```javascript
// Core state
const [messages, setMessages] = useState([])           // Chat history
const [isLoading, setIsLoading] = useState(false)      // Loading state
const [error, setError] = useState(null)               // Error messages

// Real-time streaming state
const [currentRunId, setCurrentRunId] = useState(null) // Current execution ID
const [events, setEvents] = useState([])               // Stream of events
const [routingReasoning, setRoutingReasoning] = useState(null) // Routing decision
const [agentsNeeded, setAgentsNeeded] = useState([])   // Selected agents

// UI state
const [showReasoning, setShowReasoning] = useState(false) // Panel visibility
const [inputValue, setInputValue] = useState('')      // User input
```

#### Event Handlers:
```javascript
// Streaming callbacks
onRunStart: (data) => {
  // Initialize new run with unique ID
  setCurrentRunId(data.run_id)
  setEvents(prev => [...prev, data])
}

onQueryAnalysis: (data) => {
  // Capture routing decision and agents selected
  setRoutingReasoning(data.content || data.data?.reasoning)
  setAgentsNeeded(data.data?.agents_needed || [])
  setEvents(prev => [...prev, data])
}

onAgentStart/onToolStart/onToolResult/onAgentEnd: (data) => {
  // Append real-time events as they occur
  setEvents(prev => [...prev, data])
}

onRunEnd: (data) => {
  // Extract final response and display
  const assistantMessage = {
    role: 'assistant',
    content: responseData.response,
    timestamp: new Date().toISOString(),
    charts: responseData.charts
  }
  setMessages(prev => [...prev, assistantMessage])
  setIsLoading(false)
}
```

#### Key Features:
- **Auto-open reasoning panel** when processing starts
- **Real-time event aggregation** from SSE stream
- **Error handling** with user-friendly messages
- **Example questions** for quick interaction
- **Keyboard shortcuts** (Enter to send)

---

### 2. ReasoningPanel.jsx
**Real-time timeline visualization of AI agent reasoning**

#### Purpose:
Provides transparency into the multi-agent decision-making process by showing live events as they occur during query processing.

#### Components:

##### Progress Bar
Displays completion percentage based on agents finished:
```javascript
const agentStartEvents = events.filter(e => e.type === 'agent_start')
const agentEndEvents = events.filter(e => e.type === 'agent_end')
const progress = (completedAgents / totalAgents) * 100
```

##### Query Analysis Card
Shows the routing decision:
- **Reasoning text**: Why certain agents were selected
- **Agent chips**: Visual badges for each activated agent
- **Color-coded** by agent type (historical=orange, forecasting=blue, etc.)

##### Event Timeline
Vertical timeline with:
- **Event dots**: Color-coded by type (start/tool/result/end)
- **Active indicators**: Pulsing animation for currently executing events
- **Agent attribution**: Shows which agent performed each action
- **Timestamps**: Precise timing for each event
- **Expandable details**: Click to see full output previews

##### Elapsed Time Counter
Live timer showing:
```javascript
useEffect(() => {
  let interval
  if (isLoading && runStartTime) {
    interval = setInterval(() => {
      setElapsedTime(getElapsedTime(runStartTime))
    }, 100)
  }
  return () => clearInterval(interval)
}, [isLoading, runStartTime])
```

##### Completion Summary
Shows when run finishes:
- Total execution time
- Completion icon
- Agent count

#### Event Types Displayed:
1. **run_start** 🚀 - Execution begins
2. **query_analysis** 🎯 - Routing decision made
3. **agent_start** ▶️ - Agent begins work
4. **tool_start** 🔧 - Tool invocation
5. **tool_result** ✅ - Tool completes
6. **agent_output** 💭 - Intermediate output
7. **agent_end** ✔️ - Agent completes
8. **run_end** 🏁 - Final response
9. **error** ❌ - Error occurred

#### Auto-Scroll Behavior:
```javascript
useEffect(() => {
  if (isLoading && eventsEndRef.current) {
    eventsEndRef.current.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'end' 
    })
  }
}, [events, isLoading])
```

---

### 3. AthenaChatMessage.jsx
**Individual message display with rich features**

#### Message Types:
- **User messages**: Right-aligned, blue gradient background
- **Assistant messages**: Left-aligned, left border accent

#### Features:

##### 1. Markdown Rendering
Uses ReactMarkdown for:
- Headers (h1, h2, h3)
- Bold/italic text
- Lists (bullet, numbered)
- Code blocks
- Tables
- Blockquotes

##### 2. Chart Rendering (Chart.js)
Supports multiple chart types:
- **Bar charts**: Top items, comparisons
- **Line charts**: Trends over time
- **Pie charts**: Category distribution

Dark theme configuration:
```javascript
options: {
  plugins: {
    legend: {
      labels: { color: '#f1f5f9' }
    }
  },
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
  }
}
```

##### 3. Text-to-Speech (OpenAI TTS)
- **Voice**: Nova (warm, engaging female voice)
- **Model**: TTS-1
- **Process**:
  1. Convert markdown to plain text
  2. Send to `/api/v1/vinushan/tts` endpoint
  3. Stream MP3 audio
  4. Play in browser with pause/stop controls

```javascript
const response = await fetch('/api/v1/vinushan/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text: plainText, 
    voice: 'nova' 
  })
})
const audioBlob = await response.blob()
const audioUrl = URL.createObjectURL(audioBlob)
audioRef.current.src = audioUrl
audioRef.current.play()
```

##### 4. Export Functionality

**PDF Export (jsPDF)**:
- Formatted headers and body text
- Preserves section hierarchy
- Adds footer with page numbers
- Includes timestamp

**Word Export (docx.js)**:
- Heading styles (H1, H2, H3)
- Bullet and numbered lists
- Paragraph formatting
- Professional layout

---

### 4. Athena.css
**Premium dark theme styling**

#### Design Principles:
- **Dark-first**: Optimized for low-light viewing
- **High contrast**: Accessible text and UI elements
- **Gradient accents**: Blue-to-purple for primary elements
- **Smooth animations**: Fade-in, slide-in, pulse effects

#### CSS Variables:
```css
:root {
  --athena-primary: #0ea5e9;      /* Sky blue */
  --athena-secondary: #8b5cf6;    /* Purple */
  --athena-bg: #0f172a;           /* Dark blue-gray */
  --athena-surface: #1e293b;      /* Card background */
  --athena-text: #f1f5f9;         /* Primary text */
  --athena-text-secondary: #94a3b8; /* Secondary text */
  --athena-border: #334155;       /* Borders */
}
```

#### Animations:
```css
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 5px var(--athena-primary); }
  50% { box-shadow: 0 0 15px var(--athena-primary); }
}
```

---

## Backend Services

### 1. Router (router.py)
**FastAPI endpoint definitions**

#### Endpoints:

##### GET /api/v1/vinushan/ping
Health check endpoint:
```python
@router.get("/ping", response_model=PingResponse)
async def ping():
    return PingResponse(module="vinushan", status="ok")
```

##### POST /api/v1/vinushan/chat
Synchronous chat (returns complete response):
```python
@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    return process_chat_message(
        message=request.message,
        conversation_history=request.conversation_history
    )
```

##### POST /api/v1/vinushan/chat/stream
**Real-time streaming endpoint** (SSE):
```python
@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        stream_chat_realtime(
            message=request.message,
            conversation_history=request.conversation_history
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
```

##### POST /api/v1/vinushan/tts
Text-to-speech conversion:
```python
@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.audio.speech.create(
        model="tts-1",
        voice=request.voice,  # nova, alloy, echo, etc.
        input=request.text[:4000]
    )
    return StreamingResponse(
        BytesIO(response.content),
        media_type="audio/mpeg"
    )
```

---

### 2. Real-Time Streaming Service (realtime_streaming.py)
**Core streaming implementation for live reasoning updates**

#### Event Schema:
Every event follows this standardized structure:
```python
{
    "type": "run_start | query_analysis | agent_start | tool_start | tool_result | agent_output | agent_end | run_end | error",
    "run_id": "uuid",
    "timestamp": "ISO-8601",
    "agent": "string | null",
    "task": "string | null",
    "content": "string | null",
    "data": {}
}
```

#### SSE Formatting:
```python
def _format_sse(event_type: str, data: dict) -> str:
    """Format data as Server-Sent Event."""
    json_data = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event_type}\ndata: {json_data}\n\n"
```

#### Main Streaming Function:
```python
async def stream_chat_realtime(
    message: str,
    conversation_history: List[Message]
) -> AsyncGenerator[str, None]:
    run_id = str(uuid.uuid4())
    
    # 1. RUN_START - Begin processing
    yield _format_sse(EventType.RUN_START, {
        "run_id": run_id,
        "content": "Processing your question...",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })
    
    # 2. QUERY_ANALYSIS - Route the question
    routing_result = route_question(message)
    yield _format_sse(EventType.QUERY_ANALYSIS, {
        "run_id": run_id,
        "content": routing_result["reasoning"],
        "data": {
            "agents_needed": routing_result["agents_needed"],
            "is_comprehensive": routing_result["is_comprehensive"]
        }
    })
    
    # 3. Execute based on type
    if is_conversational:
        # Handle greetings/small talk
        yield _format_sse(EventType.AGENT_START, ...)
        response = handle_conversational(message)
        yield _format_sse(EventType.AGENT_END, ...)
        
    elif needs_visualization:
        # Handle chart requests
        yield _format_sse(EventType.TOOL_START, ...)
        charts = create_visualization(message)
        yield _format_sse(EventType.TOOL_RESULT, ...)
        
    else:
        # Multi-agent CrewAI execution
        crew, task_info = builder.build_instrumented_crew(agents_needed)
        
        # Emit agent_start for each task
        for info in task_info:
            yield _format_sse(EventType.AGENT_START, {
                "agent": info["agent_name"],
                "task": info["description"]
            })
            
        # Run crew (blocking)
        result = crew.kickoff(inputs=inputs)
        
        # Emit completion events
        for task_output in result.tasks_output:
            yield _format_sse(EventType.TOOL_RESULT, ...)
            yield _format_sse(EventType.AGENT_END, ...)
    
    # 4. RUN_END - Final response
    yield _format_sse(EventType.RUN_END, {
        "data": {
            "response": response_text,
            "charts": charts,
            "reasoning_steps": reasoning_steps
        }
    })
```

#### Error Handling:
```python
try:
    # ... streaming logic ...
except Exception as e:
    yield _format_sse(EventType.ERROR, {
        "run_id": run_id,
        "content": str(e),
        "data": {"error_type": type(e).__name__}
    })
```

---

### 3. Query Router (router.py - contextawareforecastingsys)
**Intelligent agent selection using GPT-4o-mini**

#### Purpose:
Analyzes user questions to determine which specialized agents should be activated, avoiding unnecessary computation and providing focused responses.

#### Agent Capabilities:
```python
AGENT_CAPABILITIES = {
    "historical": {
        "description": "Analyze past sales data, trends, top sellers, declining items",
        "keywords": ["trend", "past", "history", "sold", "popular", "declining"]
    },
    "forecasting": {
        "description": "Predict future demand, daily forecasts, busiest days",
        "keywords": ["forecast", "predict", "future", "demand", "next month"]
    },
    "holiday": {
        "description": "Analyze holiday effects, festivals, Poya days",
        "keywords": ["holiday", "festival", "poya", "special day"]
    },
    "weather": {
        "description": "Analyze weather impact, rain/temperature effects",
        "keywords": ["weather", "rain", "temperature", "climate"]
    },
    "strategy": {
        "description": "Create business plans, actionable recommendations",
        "keywords": ["plan", "strategy", "recommend", "should I do"]
    },
    "visualization": {
        "description": "Create charts, graphs, visual representations",
        "keywords": ["chart", "graph", "visualize", "show me", "plot"]
    }
}
```

#### Routing Process:
```python
def route_question(question: str) -> dict:
    """Use OpenAI to determine which agents are needed."""
    
    # Build prompt with capabilities
    prompt = _build_routing_prompt(question)
    
    # Query GPT-4o-mini
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
    response = llm.invoke([{"role": "user", "content": prompt}])
    
    # Parse JSON response
    result = json.loads(response.content)
    
    return {
        "agents_needed": result["agents_needed"],
        "reasoning": result["reasoning"],
        "is_comprehensive": result["is_comprehensive"],
        "is_conversational": result.get("is_conversational", False),
        "needs_visualization": "visualization" in result["agents_needed"]
    }
```

#### Routing Examples:

**Simple Query**:
- Question: "What are the top selling items?"
- Agents: `["historical"]`
- Reasoning: "Only historical analysis needed"

**Comprehensive Query**:
- Question: "What should I do in January?"
- Agents: `["historical", "forecasting", "holiday", "weather", "strategy"]`
- Reasoning: "Comprehensive planning requires all analysis types"

**Visualization Query**:
- Question: "Show me a chart of sales trends"
- Agents: `["visualization"]`
- Reasoning: "Direct visualization request, no analysis needed"

**Conversational Query**:
- Question: "Hello, how are you?"
- Agents: `[]`
- Reasoning: "Greeting, handle conversationally"

---

### 4. Dynamic Crew Builder (dynamic_crew.py)
**Builds CrewAI crews with only necessary agents**

#### Purpose:
Creates optimized agent teams based on routing decisions, avoiding the overhead of running all agents for every query.

#### Agent Creation:
```python
def _create_historical_agent(self) -> Agent:
    return Agent(
        role="Coffee shop sales historian",
        goal="Analyze historical sales patterns and trends",
        backstory="Expert in analyzing past sales data...",
        tools=[self.item_history_tool],
        llm=self.llm,
        max_iter=3,
        allow_delegation=False
    )

def _create_forecasting_agent(self) -> Agent:
    return Agent(
        role="Daily demand forecaster",
        goal="Predict future daily demand",
        backstory="Specialist in time-series forecasting...",
        tools=[self.forecasting_tool],
        llm=self.llm,
        max_iter=3
    )

# Similar for holiday, weather, strategy, visualization agents
```

#### Task Creation:
```python
def _create_historical_task(self, inputs: dict) -> Task:
    return Task(
        description=f"""Analyze historical sales for {inputs['target_month_name']}.
        Use Item History Tool to find:
        - Top selling items
        - Declining items
        - Discount patterns""",
        expected_output="JSON with top_items, falling_items, discount_focus",
        agent=self._create_historical_agent()
    )
```

#### Crew Building:
```python
def build_crew(
    self, 
    agents_needed: List[str], 
    inputs: dict, 
    is_comprehensive: bool
) -> Crew:
    """Build crew with only needed agents."""
    tasks = []
    
    # Create tasks in logical order
    task_order = ["historical", "forecasting", "holiday", "weather"]
    for agent_key in task_order:
        if agent_key in agents_needed:
            tasks.append(self._create_task(agent_key, inputs))
    
    # Add final synthesis
    if is_comprehensive:
        tasks.append(self._create_strategy_task(inputs, tasks))
    else:
        tasks.append(self._create_direct_answer_task(inputs, tasks))
    
    # Build crew
    return Crew(
        agents=[task.agent for task in tasks],
        tasks=tasks,
        process=Process.sequential,
        verbose=False,
        max_rpm=30
    )
```

---

## Multi-Agent System

### Agent Specializations

#### 1. Historical Analyst
**Analyzes past sales patterns and trends**

**Tools**: ItemHistoryTool
**Capabilities**:
- Identifies top-selling items by category
- Detects declining items needing attention
- Analyzes discount effectiveness
- Tracks seasonal patterns

**Example Output**:
```json
{
  "top_items": [
    {"item": "Latte", "avg_qty": 45.2, "trend": "stable"},
    {"item": "Cappuccino", "avg_qty": 38.5, "trend": "growing"}
  ],
  "falling_items": [
    {"item": "Espresso", "avg_qty": 12.3, "decline_pct": -15.2}
  ],
  "discount_focus": ["Croissant", "Muffin"]
}
```

#### 2. Forecasting Specialist
**Predicts future demand using statistical models**

**Tools**: ForecastingTool
**Algorithm**: 
- 7-day moving average (70% weight)
- Seasonal-naive forecast (30% weight)
- Blended for robustness

**Capabilities**:
- Daily quantity predictions
- Busiest day identification
- Accuracy metrics (MAE, MAPE)
- Staffing recommendations

**Example Output**:
```json
{
  "predictions": [
    {"date": "2026-01-15", "predicted_qty": 850, "confidence": "high"},
    {"date": "2026-01-16", "predicted_qty": 920, "confidence": "high"}
  ],
  "total_qty": 24500,
  "busiest_days": ["2026-01-20", "2026-01-21"],
  "metrics": {
    "mae": 45.2,
    "mape": 5.3
  }
}
```

#### 3. Holiday Analyst
**Analyzes impact of holidays and festivals**

**Tools**: HolidayContextTool
**Capabilities**:
- Sri Lankan holiday calendar integration
- Pre-holiday, during-holiday, post-holiday patterns
- Sales lift percentage calculations
- Event-specific recommendations

**Example Output**:
```json
{
  "holidays": [
    {
      "name": "Poya Day",
      "date": "2026-01-13",
      "phase": "pre_holiday",
      "effect_pct": +15.5,
      "action": "Stock extra popular items"
    }
  ]
}
```

#### 4. Weather Analyst
**Assesses weather impact on product categories**

**Tools**: WeatherContextTool
**Capabilities**:
- Rain effect on foot traffic
- Temperature effect on hot vs. cold drinks
- Seasonal beverage recommendations
- Weather-based promotions

**Example Output**:
```json
{
  "rain_impact": {
    "hot_drinks": "+12% increase",
    "cold_drinks": "-8% decrease",
    "recommendation": "Promote hot beverages during monsoon"
  },
  "temperature_impact": {
    "cold_drinks_correlation": 0.78,
    "hot_drinks_correlation": -0.65
  }
}
```

#### 5. Strategy Planner
**Synthesizes all insights into actionable plan**

**No tools** - uses context from other agents
**Capabilities**:
- Combines all analysis results
- Creates structured business plan
- Prioritizes recommendations
- Provides risk assessment

**Example Output**:
```markdown
## Demand Outlook
- Expected 24,500 units sold
- Peak days: Jan 20-21 (weekend)

## Promotions
- Run "Monsoon Special" on hot drinks (+15% margins)
- Pre-Poya discount on popular items

## Staffing
- +2 staff on peak days (Jan 20-21)
- Normal staffing weekdays

## Inventory
- Stock up: Latte supplies, Croissants
- Watch: Espresso (declining trend)

## Risks
- Weather uncertainty (+/- 10%)
- Holiday timing overlap
```

#### 6. Visualization Specialist
**Creates charts and graphs**

**Tools**: 7 visualization chart tools
**Capabilities**:
- Sales trend charts (line)
- Top items charts (bar)
- Daily pattern charts (bar)
- Year comparison charts (line)
- Category distribution (pie)
- Weather impact charts (bar)
- Holiday impact charts (line)

**Chart Tools**:
1. `SalesTrendChartTool` - Monthly/daily trends
2. `TopItemsChartTool` - Best sellers
3. `DailyPatternChartTool` - Weekday vs weekend
4. `YearComparisonChartTool` - Year-over-year
5. `CategoryPieChartTool` - Category breakdown
6. `WeatherImpactChartTool` - Weather effects
7. `HolidayImpactChartTool` - Holiday patterns

---

## Data Flow

### Complete Request-Response Cycle

```
1. USER TYPES QUESTION
   ↓
2. FRONTEND (VinushanPage)
   - Captures input
   - Opens reasoning panel
   - Initiates streaming request
   ↓
3. API LAYER (api.js)
   - Establishes SSE connection
   - Sets up event callbacks
   ↓
4. BACKEND ROUTER (/chat/stream)
   - Receives POST request
   - Validates input
   - Calls streaming service
   ↓
5. STREAMING SERVICE
   - Generates run_id
   - Emits RUN_START event
   ↓
6. QUERY ROUTER
   - Analyzes question with GPT-4o-mini
   - Determines agents needed
   - Emits QUERY_ANALYSIS event
   ↓
7. DYNAMIC CREW BUILDER
   - Creates agents (only needed ones)
   - Builds tasks
   - Configures crew
   ↓
8. CREW EXECUTION (Sequential)
   For each agent:
   - Emit AGENT_START
   - Agent calls tool
   - Emit TOOL_START
   - Tool executes
   - Emit TOOL_RESULT
   - Agent processes result
   - Emit AGENT_END
   ↓
9. FINAL SYNTHESIS
   - Strategy agent (if comprehensive)
   - OR Direct answer agent
   - Visualization (if requested)
   ↓
10. STREAMING SERVICE
    - Emits RUN_END with full response
    ↓
11. FRONTEND RECEIVES EVENTS
    - Updates ReasoningPanel timeline
    - Displays final message
    - Stops loading indicator
    ↓
12. USER SEES RESULT
    - Complete reasoning timeline
    - Final answer with charts
    - TTS/export options
```

### Event Flow Example

**Question**: "Show me a chart of sales trends"

```
Event 1: run_start
{
  "type": "run_start",
  "run_id": "abc-123",
  "timestamp": "2026-01-01T12:00:00Z",
  "content": "Processing your question..."
}

Event 2: query_analysis
{
  "type": "query_analysis",
  "run_id": "abc-123",
  "content": "User requested visualization of sales trends",
  "data": {
    "agents_needed": ["visualization"],
    "needs_visualization": true
  }
}

Event 3: agent_start
{
  "type": "agent_start",
  "run_id": "abc-123",
  "agent": "Visualization Specialist",
  "task": "Creating visualization",
  "content": "Analyzing visualization request..."
}

Event 4: tool_start
{
  "type": "tool_start",
  "run_id": "abc-123",
  "agent": "Visualization Specialist",
  "content": "Generating chart using SalesTrendChartTool...",
  "data": {"tool_name": "SalesTrendChartTool"}
}

Event 5: tool_result
{
  "type": "tool_result",
  "run_id": "abc-123",
  "agent": "Visualization Specialist",
  "content": "Chart generated successfully",
  "data": {
    "tool_name": "SalesTrendChartTool",
    "has_image": true
  }
}

Event 6: agent_end
{
  "type": "agent_end",
  "run_id": "abc-123",
  "agent": "Visualization Specialist",
  "content": "Visualization complete"
}

Event 7: run_end
{
  "type": "run_end",
  "run_id": "abc-123",
  "data": {
    "response": "Here's your sales trend chart...",
    "charts": [{
      "chart_type": "trend",
      "title": "Sales Trend",
      "image_base64": "iVBORw0KGgoAAAANS..."
    }]
  }
}
```

---

## API Endpoints

### Base URL
```
http://localhost:8000/api/v1/vinushan
```

### Endpoint Reference

#### 1. Health Check
```http
GET /ping
```

**Response**:
```json
{
  "module": "vinushan",
  "status": "ok"
}
```

---

#### 2. Synchronous Chat
```http
POST /chat
Content-Type: application/json
```

**Request**:
```json
{
  "message": "What are the top selling items?",
  "conversation_history": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-01-01T12:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Hello! How can I help?",
      "timestamp": "2026-01-01T12:00:01Z"
    }
  ]
}
```

**Response**:
```json
{
  "response": "Based on analysis...",
  "routing_reasoning": "Selected historical agent...",
  "agents_used": ["historical"],
  "reasoning_steps": [...],
  "charts": null
}
```

---

#### 3. Streaming Chat (SSE)
```http
POST /chat/stream
Content-Type: application/json
```

**Request**: Same as synchronous chat

**Response**: Server-Sent Events stream
```
event: run_start
data: {"type":"run_start","run_id":"abc-123",...}

event: query_analysis
data: {"type":"query_analysis",...}

event: agent_start
data: {"type":"agent_start",...}

...

event: run_end
data: {"type":"run_end","data":{...}}
```

---

#### 4. Text-to-Speech
```http
POST /tts
Content-Type: application/json
```

**Request**:
```json
{
  "text": "Hello, this is ATHENA speaking",
  "voice": "nova"
}
```

**Response**: Binary audio/mpeg stream

**Available Voices**:
- `nova` - Warm, engaging female (default)
- `alloy` - Neutral, balanced
- `echo` - Warm male
- `fable` - Expressive storytelling
- `onyx` - Deep, authoritative male
- `shimmer` - Clear, friendly female

---

## Key Features

### 1. Real-Time Reasoning Transparency
**Unique ChatGPT-like experience showing AI thinking process**

- Live event stream during processing
- Visual timeline of agent collaboration
- Tool usage visibility
- Elapsed time tracking
- Progress indicators

### 2. Context-Aware Forecasting
**Blended statistical model with contextual adjustments**

- 7-day moving average (recent trends)
- Seasonal-naive forecast (historical patterns)
- Holiday impact adjustment
- Weather condition factors
- Accuracy metrics (MAE, MAPE)

### 3. Multi-Agent Collaboration
**Specialized agents working together**

- Intelligent agent selection per query
- Sequential task execution
- Context sharing between agents
- Final synthesis for comprehensive questions
- Efficient resource usage (only needed agents)

### 4. Interactive Visualizations
**Dynamic Chart.js charts with dark theme**

- 7 specialized chart types
- Responsive design
- Dark-optimized colors
- Interactive tooltips
- Export-ready formats

### 5. Natural Voice Output
**Human-like speech synthesis**

- OpenAI TTS-1 API integration
- Multiple voice personalities
- Streaming audio playback
- Pause/resume controls
- Automatic markdown-to-text conversion

### 6. Export Capabilities
**Professional document generation**

- PDF export with formatting
- Word document export
- Preserves structure and styling
- Includes charts (embedded)
- Timestamped filenames

### 7. Conversational Intelligence
**Distinguishes business vs. casual conversation**

- Greeting detection
- Small talk handling
- Direct GPT responses for non-business queries
- Context-aware agent activation
- Friendly personality

---

## Technical Implementation

### Frontend Stack

#### Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "vite": "^6.4.1",
  "chart.js": "^4.4.7",
  "react-chartjs-2": "^5.3.0",
  "react-markdown": "^9.0.1",
  "jspdf": "^2.5.2",
  "docx": "^9.0.4",
  "file-saver": "^2.0.5"
}
```

#### Build Configuration
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

---

### Backend Stack

#### Dependencies
```txt
fastapi==0.115.12
uvicorn[standard]==0.34.2
crewai==0.86.0
crewai-tools==0.19.4
langchain-openai==0.2.20
openai==1.59.8
pandas==2.2.3
numpy==2.2.2
matplotlib==3.10.0
python-dotenv==1.0.1
```

#### Environment Variables
```env
# OpenAI API
OPENAI_API_KEY=sk-...

# LLM Configuration
MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.2

# Business Info
BUSINESS_NAME=Rossmann Coffee Shop
BUSINESS_LOCATION=Katunayake / Negombo, Sri Lanka

# Data Paths
DATA_DIR=./data
REPORTS_DIR=./reports

# CrewAI Settings
CREWAI_TELEMETRY_OPT_OUT=true
OTEL_SDK_DISABLED=true
```

#### FastAPI Configuration
```python
app = FastAPI(
    title="ATHENA API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
```

---

### Data Processing

#### Sales Data Structure
```csv
date,category,item_name,quantity,unit_price,discount_pct,day_of_week,month,year,is_weekend,is_holiday,weather_condition,temperature_c
2024-12-25,Hot Drink,Latte,45,5.50,0,Wednesday,12,2024,0,1,Sunny,28
```

#### Forecasting Algorithm
```python
def blend_forecasts(
    moving_avg: float,
    seasonal_naive: float,
    ma_weight: float = 0.7
) -> float:
    """
    Blend two forecasts for robustness.
    - Moving average captures recent trends
    - Seasonal naive captures yearly patterns
    """
    return (ma_weight * moving_avg) + ((1 - ma_weight) * seasonal_naive)
```

#### Accuracy Metrics
```python
def calculate_metrics(actual, predicted):
    mae = mean_absolute_error(actual, predicted)
    mape = mean_absolute_percentage_error(actual, predicted)
    return {"mae": mae, "mape": mape}
```

---

### Deployment Considerations

#### Development
```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

#### Production
```bash
# Backend with Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# Frontend build
npm run build
# Serve dist/ with Nginx/Apache
```

#### Performance Optimizations
- Agent caching for repeated queries
- Database connection pooling
- Response compression
- CDN for static assets
- Rate limiting on API endpoints

---

## Conclusion

ATHENA represents a comprehensive implementation of a context-aware forecasting system that combines:
- **Multi-agent AI** for specialized analysis
- **Real-time streaming** for transparency
- **Modern web technologies** for user experience
- **Statistical forecasting** for accuracy
- **Contextual awareness** for relevance

The system demonstrates how AI agents can collaborate to solve complex business problems while providing full visibility into the reasoning process, making it both powerful and trustworthy for decision-making.

---

**Documentation Version**: 1.0  
**Last Updated**: January 1, 2026  
**Author**: Vinushan  
**Component**: ATHENA - Context-Aware Forecasting System
