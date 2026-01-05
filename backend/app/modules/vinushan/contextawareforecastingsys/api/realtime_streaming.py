"""
Real-Time Streaming Service - True real-time reasoning updates via Server-Sent Events.
Implements comprehensive event schema for ChatGPT-like streaming experience.
"""

import json
import os
import re
import uuid
from calendar import month_name
from datetime import datetime
from typing import AsyncGenerator, List, Dict, Any, Optional
from threading import Thread
from queue import Queue, Empty
import asyncio

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from crewai import Agent, Crew, Process, Task

# Disable CrewAI telemetry
os.environ["CREWAI_TELEMETRY_OPT_OUT"] = "true"
os.environ["OTEL_SDK_DISABLED"] = "true"

from ..router import route_question, AGENT_CAPABILITIES
from ..dynamic_crew import DynamicCrewBuilder
from ..tools.visualization_tools import (
    create_sales_trend_chart,
    create_top_items_chart,
    create_daily_pattern_chart,
    create_monthly_comparison_chart,
    create_category_pie_chart,
    create_weather_impact_chart,
    create_holiday_impact_chart,
    create_holiday_period_analysis_chart,
    create_top_items_holiday_chart,
)
from .models import Message, AgentStep, ChatResponse, ChartData

load_dotenv()


# ============================================================================
# Event Types
# ============================================================================
class EventType:
    RUN_START = "run_start"
    QUERY_ANALYSIS = "query_analysis"
    ROUTER_THOUGHT = "router_thought"
    AGENT_START = "agent_start"
    AGENT_THOUGHT = "agent_thought"
    AGENT_QUERY = "agent_query"
    AGENT_SELF_CHECK = "agent_self_check"
    AGENT_RESULT_SNAPSHOT = "agent_result_snapshot"
    TOOL_START = "tool_start"
    TOOL_RESULT = "tool_result"
    AGENT_OUTPUT = "agent_output"
    AGENT_END = "agent_end"
    RUN_END = "run_end"
    ERROR = "error"


# ============================================================================
# Date Extraction Helper
# ============================================================================
MONTH_MAP = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
}

def _extract_target_month_year(message: str) -> tuple:
    """
    Extract target month and year from user message.
    Falls back to current month/year if not found.
    
    Examples:
        "What should I do for February 2026?" -> (2, 2026)
        "Actions for March?" -> (3, current_year)
        "Plan for next month" -> (next_month, year)
    
    Returns:
        Tuple of (month_number, year)
    """
    message_lower = message.lower()
    now = datetime.now()
    
    # Default to current month/year
    target_month = now.month
    target_year = now.year
    
    # Try to find month name in message
    for month_str, month_num in MONTH_MAP.items():
        if month_str in message_lower:
            target_month = month_num
            break
    
    # Try to find year in message (4 digit number like 2025, 2026)
    year_match = re.search(r'\b(20\d{2})\b', message)
    if year_match:
        target_year = int(year_match.group(1))
    
    # Handle relative terms
    if 'next month' in message_lower:
        target_month = now.month + 1
        if target_month > 12:
            target_month = 1
            target_year = now.year + 1
    elif 'this month' in message_lower:
        target_month = now.month
        target_year = now.year
    elif 'last month' in message_lower:
        target_month = now.month - 1
        if target_month < 1:
            target_month = 12
            target_year = now.year - 1
    
    return (target_month, target_year)
    AGENT_THOUGHT = "agent_thought"
    AGENT_QUERY = "agent_query"
    AGENT_SELF_CHECK = "agent_self_check"
    AGENT_RESULT_SNAPSHOT = "agent_result_snapshot"
    AGENT_OUTPUT = "agent_output"
    TOOL_START = "tool_start"
    TOOL_RESULT = "tool_result"
    AGENT_END = "agent_end"
    RUN_END = "run_end"
    ERROR = "error"


# ============================================================================
# SSE Formatting
# ============================================================================
def _format_sse(event_type: str, data: dict) -> str:
    """Format data as Server-Sent Event."""
    json_data = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event_type}\ndata: {json_data}\n\n"


def _create_event(
    event_type: str,
    run_id: str,
    agent: Optional[str] = None,
    task: Optional[str] = None,
    content: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    phase: Optional[str] = None,
    text: Optional[str] = None
) -> dict:
    """Create a standardized event payload."""
    return {
        "type": event_type,
        "run_id": run_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "agent": agent,
        "task": task,
        "content": content,
        "phase": phase,
        "text": text,
        "data": data or {}
    }


# ============================================================================
# Event Queue for Real-Time Updates
# ============================================================================
class EventEmitter:
    """Thread-safe event queue for streaming updates."""
    
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.queue: Queue = Queue()
        self._closed = False
    
    def emit(
        self,
        event_type: str,
        agent: Optional[str] = None,
        task: Optional[str] = None,
        content: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ):
        """Emit an event to the queue."""
        if not self._closed:
            event = _create_event(event_type, self.run_id, agent, task, content, data)
            self.queue.put(event)
    
    def close(self):
        """Mark the queue as closed."""
        self._closed = True
        self.queue.put(None)  # Sentinel to signal end
    
    def get_events(self, timeout: float = 0.1):
        """Get all available events."""
        events = []
        while True:
            try:
                event = self.queue.get(timeout=timeout)
                if event is None:  # Sentinel
                    break
                events.append(event)
            except Empty:
                break
        return events


# ============================================================================
# Callback Handlers for CrewAI
# ============================================================================
class StreamingCallbackHandler:
    """Custom callback handler for real-time CrewAI events."""
    
    def __init__(self, emitter: EventEmitter):
        self.emitter = emitter
        self.current_agent: Optional[str] = None
        self.current_task: Optional[str] = None
        self.step_count = 0
    
    def on_agent_start(self, agent_name: str, task_description: str):
        """Called when an agent starts working on a task."""
        self.current_agent = agent_name
        self.current_task = task_description
        self.step_count += 1
        self.emitter.emit(
            EventType.AGENT_START,
            agent=agent_name,
            task=task_description[:200],
            content=f"{agent_name} starting analysis...",
            data={"step_number": self.step_count}
        )


# ============================================================================
# Agent Thought Templates - Structured reasoning output
# ============================================================================
def _generate_router_thought(message: str, agents_needed: list, is_comprehensive: bool) -> str:
    """Generate structured router thought text."""
    agents_list = "\n".join([f"- {a}" for a in agents_needed])
    
    return f"""alright, the manager asked: "{message[:100]}..."

step 1: decide what kind of question this is.
- analyzing the intent and required data sources
- determining which specialists are needed

agents i will run:
{agents_list}

{"this is a comprehensive planning request, so all relevant specialists will be activated." if is_comprehensive else "selecting only the necessary specialists for this specific question."}"""


def _generate_agent_plan(agent_name: str, task: str, target_month: str = None, target_year: int = None) -> str:
    """Generate agent planning thought."""
    agent_lower = agent_name.lower()
    
    if "historical" in agent_lower or "historian" in agent_lower:
        return f"""i need to anchor planning using evidence from historical data.
i will look at past records and find:
- best sellers, worst sellers
- weekend vs weekday patterns
- discount-heavy items
- revenue and volume trends"""
    
    elif "forecast" in agent_lower:
        return f"""the manager needs demand predictions, so i must forecast future demand.
i will call the trained Prophet model for daily_total_qty.
i will output:
- total expected quantity
- busiest days
- uncertainty (best/worst case)"""
    
    elif "holiday" in agent_lower:
        return f"""i need to flag holidays because demand shifts around them.
i will identify:
- upcoming holidays
- pre-holiday spikes
- post-holiday drops
and suggest practical actions."""
    
    elif "weather" in agent_lower:
        return f"""i will check how weather historically affects demand and menu mix.
i will focus on:
- rainy vs non-rainy sales differences
- temperature impact on orders"""
    
    elif "strategy" in agent_lower or "planner" in agent_lower:
        return f"""i will combine all insights into a single actionable plan.
i will produce actions under:
- demand expectations
- staffing recommendations
- inventory adjustments
- promotional strategies
- risks and monitoring"""
    
    elif "visualization" in agent_lower:
        return f"""i need to create a visual representation of the data.
i will:
- determine the best chart type
- extract relevant data
- generate the visualization"""
    
    else:
        return f"""i need to analyze the request and provide relevant insights.
task: {task[:100]}"""


def _generate_data_query(agent_name: str, tool_name: str = None) -> str:
    """Generate data query pseudo-code."""
    agent_lower = agent_name.lower()
    
    if "historical" in agent_lower or "historian" in agent_lower:
        return f"""DATASET: data/the_rossmann_coffee_shop_sales_dataset.csv

PSEUDO-QUERY:
FROM sales_rows
WHERE month = target_month AND year BETWEEN (target_year - 5) AND (target_year - 1)
SELECT
  food_name,
  SUM(qty) AS total_qty,
  SUM(total_price) AS total_revenue,
  AVG(discount_rate) AS avg_discount
GROUP BY food_name
ORDER BY total_qty DESC
LIMIT 10;"""
    
    elif "forecast" in agent_lower:
        return f"""MODEL: models/prophet_qty/v1/model.pkl
TARGET: daily_total_qty

PSEUDO-QUERY (model inference):
FORECAST daily_total_qty
FOR date BETWEEN start_date AND end_date
WITH regressors:
  is_weekend = derived from date
  is_holiday = from calendar table
  weather = historical averages"""
    
    elif "holiday" in agent_lower:
        return f"""DATASET: calendar/holiday table

PSEUDO-QUERY:
FROM calendar
WHERE year = target_year AND month = target_month
SELECT
  date,
  holiday_name,
  is_pre_holiday,
  is_post_holiday;"""
    
    elif "weather" in agent_lower:
        return f"""DATASET: data/the_rossmann_coffee_shop_sales_dataset.csv

PSEUDO-QUERY:
FROM sales_rows
WHERE month = target_month
SELECT
  is_rainy,
  AVG(temp_avg) AS avg_temp,
  SUM(qty) AS total_qty
GROUP BY is_rainy;"""
    
    else:
        return f"""invoking {tool_name or 'analysis tool'}
querying relevant data sources..."""


def _generate_self_check(agent_name: str) -> str:
    """Generate self-check validation thought."""
    agent_lower = agent_name.lower()
    
    if "historical" in agent_lower or "historian" in agent_lower:
        return f"""before i trust results, i will validate:
- do i have data for the requested time period?
- are qty and total_price mostly non-null?
- is total_qty reasonable compared to nearby periods?"""
    
    elif "forecast" in agent_lower:
        return f"""i will validate the forecast output:
- yhat must not be negative
- predictions should be within historical ranges
- uncertainty bands should not be too wide
- referencing model backtest error (MAE/RMSE)"""
    
    elif "holiday" in agent_lower:
        return f"""validation checks:
- confirm holiday dates align with Sri Lankan calendar
- confirm no overlapping holiday labels
- if no holidays exist, clearly state that"""
    
    elif "weather" in agent_lower:
        return f"""validation checks:
- ensure temp_avg and rain_mm exist and are numeric
- if weather columns are missing, report insufficient data"""
    
    elif "strategy" in agent_lower or "planner" in agent_lower:
        return f"""validation checks:
- do recommendations match forecast magnitude?
- are actions tied to evidence from at least one agent?
- if something is uncertain, label it as risk not fact"""
    
    else:
        return f"""validating output quality and completeness..."""


def _generate_result_snapshot(agent_name: str, result_preview: str) -> str:
    """Generate result snapshot summary."""
    agent_lower = agent_name.lower()
    
    # Truncate result for display
    truncated = result_preview[:200] + "..." if len(result_preview) > 200 else result_preview
    
    if "historical" in agent_lower or "historian" in agent_lower:
        return f"""historical analysis complete:
{truncated}

this provides a stable baseline for planning."""
    
    elif "forecast" in agent_lower:
        return f"""forecast summary:
{truncated}

this drives staffing and inventory planning."""
    
    elif "holiday" in agent_lower:
        return f"""holiday impact analysis:
{truncated}"""
    
    elif "weather" in agent_lower:
        return f"""weather signal analysis:
{truncated}"""
    
    elif "strategy" in agent_lower or "planner" in agent_lower:
        return f"""action plan generated:
{truncated}"""
    
    else:
        return truncated
    
    def on_tool_start(self, tool_name: str, tool_input: str):
        """Called when a tool is invoked."""
        self.emitter.emit(
            EventType.TOOL_START,
            agent=self.current_agent,
            task=self.current_task,
            content=f"Using {tool_name}...",
            data={
                "tool_name": tool_name,
                "tool_input": tool_input[:500] if tool_input else None
            }
        )
    
    def on_tool_result(self, tool_name: str, result: str):
        """Called when a tool returns results."""
        # Truncate large results for streaming
        preview = result[:500] + "..." if len(result) > 500 else result
        self.emitter.emit(
            EventType.TOOL_RESULT,
            agent=self.current_agent,
            task=self.current_task,
            content=f"{tool_name} completed",
            data={
                "tool_name": tool_name,
                "result_preview": preview,
                "result_length": len(result)
            }
        )
    
    def on_agent_output(self, output: str):
        """Called when an agent produces intermediate output."""
        preview = output[:300] + "..." if len(output) > 300 else output
        self.emitter.emit(
            EventType.AGENT_OUTPUT,
            agent=self.current_agent,
            task=self.current_task,
            content=preview,
            data={"full_length": len(output)}
        )
    
    def on_agent_end(self, agent_name: str, output: str):
        """Called when an agent completes its task."""
        preview = output[:300] + "..." if len(output) > 300 else output
        self.emitter.emit(
            EventType.AGENT_END,
            agent=agent_name,
            task=self.current_task,
            content=f"{agent_name} completed analysis",
            data={
                "output_preview": preview,
                "step_number": self.step_count
            }
        )


# ============================================================================
# Instrumented Dynamic Crew Builder
# ============================================================================
class InstrumentedCrewBuilder(DynamicCrewBuilder):
    """Extended crew builder with streaming callbacks."""
    
    def __init__(self, emitter: EventEmitter):
        super().__init__()
        self.emitter = emitter
        self.callback_handler = StreamingCallbackHandler(emitter)
    
    def _create_agent_with_callbacks(self, base_agent: Agent) -> Agent:
        """Wrap agent to emit events."""
        # CrewAI doesn't have built-in callbacks, so we'll emit events
        # before/after crew tasks
        return base_agent
    
    def build_instrumented_crew(
        self, 
        agents_needed: List[str], 
        inputs: dict, 
        is_comprehensive: bool = False
    ) -> tuple:
        """Build crew and return task metadata for event emission."""
        crew = self.build_crew(agents_needed, inputs, is_comprehensive)
        
        # Extract task info for streaming
        task_info = []
        for i, task in enumerate(crew.tasks):
            agent_name = task.agent.role if task.agent else "Unknown"
            task_info.append({
                "index": i,
                "agent_name": agent_name,
                "description": task.description[:200] if task.description else "",
                "expected_output": task.expected_output[:100] if task.expected_output else ""
            })
        
        return crew, task_info


# ============================================================================
# Direct Handlers (Non-CrewAI)
# ============================================================================
def _handle_conversational_message(
    message: str, 
    history: List[Message],
    emitter: Optional[EventEmitter] = None
) -> str:
    """Handle non-business conversational messages directly with LLM."""
    if emitter:
        emitter.emit(
            EventType.AGENT_START,
            agent="Conversational Assistant",
            task="Responding to greeting",
            content="Processing your message..."
        )
    
    llm = ChatOpenAI(
        model=os.getenv("MODEL", "gpt-4o-mini"),
        temperature=0.7,
        timeout=30,
    )
    
    business_name = os.getenv("BUSINESS_NAME", "Rossmann Coffee Shop")
    
    messages = [
        {
            "role": "system",
            "content": f"""You are ATHENA, a friendly AI assistant for {business_name}, a coffee shop in Sri Lanka.
You help the shop manager with business questions about sales, forecasting, inventory, and planning.

When responding to greetings or general conversation:
- Be friendly and welcoming
- Briefly mention what you can help with (sales analysis, forecasting, holiday planning, weather impacts)
- Keep responses concise and natural"""
        }
    ]
    
    for msg in history[-4:]:
        messages.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content[:500]
        })
    
    messages.append({"role": "user", "content": message})
    
    response = llm.invoke(messages)
    
    if emitter:
        emitter.emit(
            EventType.AGENT_END,
            agent="Conversational Assistant",
            task="Responding to greeting",
            content="Response generated",
            data={"output_preview": response.content[:200]}
        )
    
    return response.content


def _handle_visualization_directly(
    message: str,
    emitter: Optional[EventEmitter] = None
) -> tuple:
    """Handle visualization requests directly without CrewAI."""
    message_lower = message.lower()
    charts = []
    explanation = ""
    
    if emitter:
        emitter.emit(
            EventType.AGENT_START,
            agent="Visualization Specialist",
            task="Creating chart",
            content="Analyzing visualization request..."
        )
    
    try:
        chart_type = "general"
        
        if any(word in message_lower for word in ["trend", "over time", "sales trend", "monthly sales"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating sales trend chart...",
                    data={"tool_name": "SalesTrendChartTool"}
                )
            
            item = None
            for food in ["coffee", "latte", "cappuccino", "espresso", "tea", "cake", "muffin", "sandwich", "croissant"]:
                if food in message_lower:
                    item = food
                    break
            result = create_sales_trend_chart(item_name=item, months=6, group_by="month")
            chart_type = "trend"
            
        elif any(word in message_lower for word in ["top", "best selling", "popular", "most sold"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating top items chart...",
                    data={"tool_name": "TopItemsChartTool"}
                )
            result = create_top_items_chart(top_n=10)
            chart_type = "top_items"
            
        elif any(word in message_lower for word in ["daily", "hourly", "pattern", "hour", "time of day"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating daily pattern chart...",
                    data={"tool_name": "DailyPatternChartTool"}
                )
            result = create_daily_pattern_chart()
            chart_type = "daily_pattern"
            
        elif any(word in message_lower for word in ["year", "compare", "yearly", "annual", "yoy"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating year comparison chart...",
                    data={"tool_name": "YearComparisonChartTool"}
                )
            result = create_monthly_comparison_chart()
            chart_type = "year_comparison"
            
        elif any(word in message_lower for word in ["category", "pie", "distribution", "breakdown"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating category distribution chart...",
                    data={"tool_name": "CategoryPieChartTool"}
                )
            result = create_category_pie_chart()
            chart_type = "category"
            
        elif any(word in message_lower for word in ["weather", "rain", "temperature", "sunny"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating weather impact chart...",
                    data={"tool_name": "WeatherImpactChartTool"}
                )
            result = create_weather_impact_chart()
            chart_type = "weather"
            
        elif any(word in message_lower for word in ["holiday", "festival", "event"]):
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating holiday impact chart...",
                    data={"tool_name": "HolidayImpactChartTool"}
                )
            result = create_holiday_impact_chart()
            chart_type = "holiday"
            
        else:
            # Default to top items
            if emitter:
                emitter.emit(
                    EventType.TOOL_START,
                    agent="Visualization Specialist",
                    content="Creating sales overview chart...",
                    data={"tool_name": "TopItemsChartTool"}
                )
            result = create_top_items_chart(top_n=10)
            chart_type = "top_items"
        
        if emitter:
            emitter.emit(
                EventType.TOOL_RESULT,
                agent="Visualization Specialist",
                content="Chart generated successfully",
                data={"tool_name": f"{chart_type}_chart", "has_image": bool(result.get("image"))}
            )
        
        if result.get("image"):
            charts.append(ChartData(
                chart_type=chart_type,
                title=result.get("title", "Sales Chart"),
                image_base64=result["image"]
            ))
            explanation = result.get("explanation", "Here's your visualization.")
        else:
            explanation = "I couldn't generate that chart. Please try a different question."
            
    except Exception as e:
        explanation = f"I encountered an issue creating the visualization: {str(e)}"
        if emitter:
            emitter.emit(
                EventType.ERROR,
                content=f"Visualization error: {str(e)}"
            )
    
    if emitter:
        emitter.emit(
            EventType.AGENT_END,
            agent="Visualization Specialist",
            task="Creating chart",
            content="Chart creation completed",
            data={"charts_count": len(charts)}
        )
    
    return charts, explanation


def _generate_promotion_evidence_charts(
    response_text: str,
    emitter: Optional['EventEmitter'] = None
) -> List[ChartData]:
    """
    Generate supporting charts when the response contains promotion recommendations.
    These charts show historical evidence backing up the recommendations.
    
    Args:
        response_text: The AI response text to analyze
        emitter: Optional event emitter for streaming events
        
    Returns:
        List of ChartData objects with supporting visualizations
    """
    charts = []
    response_lower = response_text.lower()
    
    # Check if response contains promotion/holiday recommendations
    promotion_keywords = [
        'promotion', 'discount', 'offer', 'bundle', 'holiday',
        'poya', 'festival', 'recommend', 'strategy', 'boost',
        'falling items', 'demand effect', 'effect on demand'
    ]
    
    has_promotion_content = any(kw in response_lower for kw in promotion_keywords)
    
    if not has_promotion_content:
        return charts
    
    try:
        if emitter:
            emitter.emit(
                EventType.AGENT_START,
                agent="Evidence Visualizer",
                task="Generating supporting charts",
                content="Creating historical evidence charts for recommendations..."
            )
        
        # Generate holiday period analysis chart
        if emitter:
            emitter.emit(
                EventType.TOOL_START,
                agent="Evidence Visualizer",
                content="Analyzing historical holiday patterns...",
                data={"tool_name": "HolidayPeriodAnalysisTool"}
            )
        
        period_result = create_holiday_period_analysis_chart(window_days=7)
        
        if period_result.get("image"):
            charts.append(ChartData(
                chart_type="holiday_period",
                title=period_result.get("title", "Holiday Period Analysis"),
                image_base64=period_result["image"],
                chart_data=period_result.get("chart_data")
            ))
        
        if emitter:
            emitter.emit(
                EventType.TOOL_RESULT,
                agent="Evidence Visualizer",
                content="Holiday period chart generated",
                data={"has_chart": bool(period_result.get("image"))}
            )
        
        # Generate top items holiday comparison chart
        if emitter:
            emitter.emit(
                EventType.TOOL_START,
                agent="Evidence Visualizer",
                content="Comparing product performance on holidays...",
                data={"tool_name": "TopItemsHolidayComparisonTool"}
            )
        
        items_result = create_top_items_holiday_chart(top_n=5)
        
        if items_result.get("image"):
            charts.append(ChartData(
                chart_type="items_holiday",
                title=items_result.get("title", "Items Holiday Performance"),
                image_base64=items_result["image"],
                chart_data=items_result.get("chart_data")
            ))
        
        if emitter:
            emitter.emit(
                EventType.TOOL_RESULT,
                agent="Evidence Visualizer",
                content="Items comparison chart generated",
                data={"has_chart": bool(items_result.get("image"))}
            )
        
        if emitter:
            emitter.emit(
                EventType.AGENT_END,
                agent="Evidence Visualizer",
                task="Generating supporting charts",
                content=f"Generated {len(charts)} evidence charts",
                data={"charts_count": len(charts)}
            )
            
    except Exception as e:
        if emitter:
            emitter.emit(
                EventType.ERROR,
                content=f"Evidence chart generation error: {str(e)}"
            )
    
    return charts


# ============================================================================
# Main Streaming Function
# ============================================================================
async def stream_chat_realtime(
    message: str,
    conversation_history: List[Message]
) -> AsyncGenerator[str, None]:
    """
    Stream chat response with real-time reasoning events.
    
    Yields SSE-formatted events:
    - run_start: Beginning of processing
    - query_analysis: Routing decision
    - agent_start: Agent begins work
    - tool_start: Tool invocation
    - tool_result: Tool completes
    - agent_output: Intermediate output
    - agent_end: Agent completes
    - run_end: Final response with all data
    - error: Any errors
    """
    run_id = str(uuid.uuid4())
    emitter = EventEmitter(run_id)
    
    try:
        # RUN_START
        yield _format_sse(EventType.RUN_START, _create_event(
            EventType.RUN_START,
            run_id,
            content="Processing your question...",
            data={"message": message[:200]}
        ))
        await asyncio.sleep(0.05)  # Small delay for streaming effect
        
        # QUERY_ANALYSIS - Route the question
        routing_result = route_question(message)
        agents_needed = routing_result.get("agents_needed", [])
        reasoning = routing_result.get("reasoning", "")
        is_comprehensive = routing_result.get("is_comprehensive", False)
        is_conversational = routing_result.get("is_conversational", False)
        needs_visualization = routing_result.get("needs_visualization", False)
        
        # Generate structured router thought
        router_thought = _generate_router_thought(message, agents_needed, is_comprehensive)
        
        yield _format_sse(EventType.QUERY_ANALYSIS, _create_event(
            EventType.QUERY_ANALYSIS,
            run_id,
            content=router_thought,
            phase="router",
            text=router_thought,
            data={
                "agents_needed": agents_needed,
                "is_comprehensive": is_comprehensive,
                "is_conversational": is_conversational,
                "needs_visualization": needs_visualization
            }
        ))
        await asyncio.sleep(0.05)
        
        # Handle different request types
        charts = []
        response_text = ""
        reasoning_steps = []
        
        if is_conversational:
            # Handle conversational messages
            yield _format_sse(EventType.AGENT_START, _create_event(
                EventType.AGENT_START,
                run_id,
                agent="Conversational Assistant",
                task="Responding to message",
                content="Processing your message...",
                data={"step_number": 1}
            ))
            await asyncio.sleep(0.05)
            
            response_text = _handle_conversational_message(message, conversation_history)
            
            yield _format_sse(EventType.AGENT_END, _create_event(
                EventType.AGENT_END,
                run_id,
                agent="Conversational Assistant",
                task="Responding to message",
                content="Response ready",
                data={"output_preview": response_text[:200]}
            ))
            
            reasoning_steps.append(AgentStep(
                agent_name="Conversational Assistant",
                task_name="Responding to message",
                summary="Handled conversational request",
                output_preview=response_text[:200]
            ))
            
        elif needs_visualization:
            # Handle visualization directly
            yield _format_sse(EventType.AGENT_START, _create_event(
                EventType.AGENT_START,
                run_id,
                agent="Visualization Specialist",
                task="Creating visualization",
                content="Analyzing your visualization request...",
                data={"step_number": 1}
            ))
            await asyncio.sleep(0.05)
            
            # Determine chart type and emit tool events
            message_lower = message.lower()
            tool_name = "chart_tool"
            
            if "trend" in message_lower:
                tool_name = "SalesTrendChartTool"
            elif any(w in message_lower for w in ["top", "best", "popular"]):
                tool_name = "TopItemsChartTool"
            elif any(w in message_lower for w in ["daily", "hourly", "pattern"]):
                tool_name = "DailyPatternChartTool"
            elif any(w in message_lower for w in ["year", "compare"]):
                tool_name = "YearComparisonChartTool"
            elif any(w in message_lower for w in ["category", "pie"]):
                tool_name = "CategoryPieChartTool"
            elif "weather" in message_lower:
                tool_name = "WeatherImpactChartTool"
            elif "holiday" in message_lower:
                tool_name = "HolidayImpactChartTool"
            
            yield _format_sse(EventType.TOOL_START, _create_event(
                EventType.TOOL_START,
                run_id,
                agent="Visualization Specialist",
                content=f"Generating chart using {tool_name}...",
                data={"tool_name": tool_name}
            ))
            await asyncio.sleep(0.1)
            
            charts, response_text = _handle_visualization_directly(message)
            
            yield _format_sse(EventType.TOOL_RESULT, _create_event(
                EventType.TOOL_RESULT,
                run_id,
                agent="Visualization Specialist",
                content="Chart generated successfully",
                data={
                    "tool_name": tool_name,
                    "charts_count": len(charts),
                    "has_image": len(charts) > 0
                }
            ))
            await asyncio.sleep(0.05)
            
            yield _format_sse(EventType.AGENT_END, _create_event(
                EventType.AGENT_END,
                run_id,
                agent="Visualization Specialist",
                task="Creating visualization",
                content="Visualization complete",
                data={"charts_count": len(charts)}
            ))
            
            reasoning_steps.append(AgentStep(
                agent_name="Visualization Specialist",
                task_name="Creating visualization",
                summary=f"Generated {len(charts)} chart(s)",
                output_preview=response_text[:200]
            ))
            
        else:
            # Run CrewAI multi-agent analysis
            # Extract target month/year from user message, default to current
            target_month, target_year = _extract_target_month_year(message)
            target_month_name = month_name[target_month]
            
            inputs = {
                "user_question": message,
                "target_month": target_month,
                "target_month_name": target_month_name,
                "target_year": target_year,
            }
            
            # Build crew
            builder = InstrumentedCrewBuilder(emitter)
            crew, task_info = builder.build_instrumented_crew(
                agents_needed, 
                inputs, 
                is_comprehensive
            )
            
            total_tasks = len(task_info)
            
            # Emit agent_start for each task before running
            for i, info in enumerate(task_info):
                agent_name = info["agent_name"]
                task_desc = info["description"]
                
                # AGENT_START
                yield _format_sse(EventType.AGENT_START, _create_event(
                    EventType.AGENT_START,
                    run_id,
                    agent=agent_name,
                    task=task_desc,
                    content=f"{agent_name} starting analysis...",
                    data={
                        "step_number": i + 1,
                        "total_steps": total_tasks,
                        "expected_output": info["expected_output"]
                    }
                ))
                await asyncio.sleep(0.08)
                
                # AGENT_THOUGHT: PLAN phase
                plan_thought = _generate_agent_plan(agent_name, task_desc, target_month_name, target_year)
                yield _format_sse(EventType.AGENT_THOUGHT, _create_event(
                    EventType.AGENT_THOUGHT,
                    run_id,
                    agent=agent_name,
                    phase="plan",
                    content=plan_thought,
                    text=plan_thought
                ))
                await asyncio.sleep(0.08)
                
                # Determine tool name based on agent type
                agent_lower = agent_name.lower()
                tool_name = "AnalysisTool"
                tool_content = "querying data..."
                
                if "historical" in agent_lower or "historian" in agent_lower:
                    tool_name = "ItemHistoryTool"
                    tool_content = "querying historical sales data..."
                elif "forecast" in agent_lower:
                    tool_name = "TimeSeriesForecastTool"
                    tool_content = "invoking trained Prophet model..."
                elif "holiday" in agent_lower:
                    tool_name = "HolidayContextTool"
                    tool_content = "analyzing holiday calendar..."
                elif "weather" in agent_lower:
                    tool_name = "WeatherContextTool"
                    tool_content = "analyzing weather patterns..."
                elif "strategy" in agent_lower or "planner" in agent_lower:
                    tool_name = "StrategySynthesisTool"
                    tool_content = "synthesizing insights..."
                
                # AGENT_QUERY: DATA_QUERY phase
                query_thought = _generate_data_query(agent_name, tool_name)
                yield _format_sse(EventType.AGENT_QUERY, _create_event(
                    EventType.AGENT_QUERY,
                    run_id,
                    agent=agent_name,
                    phase="data_query",
                    content=query_thought,
                    text=query_thought,
                    data={"tool_name": tool_name}
                ))
                await asyncio.sleep(0.08)
                
                # TOOL_START
                yield _format_sse(EventType.TOOL_START, _create_event(
                    EventType.TOOL_START,
                    run_id,
                    agent=agent_name,
                    content=tool_content,
                    data={
                        "tool_name": tool_name,
                        "model": "Prophet (trained on 2020-2025 data)" if "forecast" in agent_lower else None
                    }
                ))
                
                await asyncio.sleep(0.1)
            
            # Run the crew in thread pool (blocking operation)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, lambda: crew.kickoff(inputs=inputs))
            
            # Extract results and emit completion events
            # In CrewAI, tasks_output is on the result object, not the crew
            tasks_output = getattr(result, 'tasks_output', None) or []
            
            for i, task_output in enumerate(tasks_output):
                agent_name = task_info[i]["agent_name"] if i < len(task_info) else "Agent"
                output_str = str(task_output)
                output_preview = output_str[:300] + "..." if len(output_str) > 300 else output_str
                
                # AGENT_SELF_CHECK: validation phase
                self_check = _generate_self_check(agent_name)
                yield _format_sse(EventType.AGENT_SELF_CHECK, _create_event(
                    EventType.AGENT_SELF_CHECK,
                    run_id,
                    agent=agent_name,
                    phase="self_check",
                    content=self_check,
                    text=self_check
                ))
                await asyncio.sleep(0.05)
                
                # Extract summary
                summary = ""
                if "top" in output_str.lower()[:100]:
                    summary = "identified key items and patterns"
                elif "forecast" in output_str.lower()[:100]:
                    summary = "generated demand predictions"
                elif "holiday" in output_str.lower()[:100]:
                    summary = "analyzed holiday impacts"
                elif "weather" in output_str.lower()[:100]:
                    summary = "assessed weather effects"
                else:
                    summary = "analysis complete"
                
                # Tool result event
                yield _format_sse(EventType.TOOL_RESULT, _create_event(
                    EventType.TOOL_RESULT,
                    run_id,
                    agent=agent_name,
                    content=summary,
                    data={
                        "result_preview": output_preview,
                        "result_length": len(output_str)
                    }
                ))
                await asyncio.sleep(0.05)
                
                # AGENT_RESULT_SNAPSHOT: result phase
                result_snapshot = _generate_result_snapshot(agent_name, output_preview)
                yield _format_sse(EventType.AGENT_RESULT_SNAPSHOT, _create_event(
                    EventType.AGENT_RESULT_SNAPSHOT,
                    run_id,
                    agent=agent_name,
                    phase="result",
                    content=result_snapshot,
                    text=result_snapshot
                ))
                await asyncio.sleep(0.05)
                
                # Agent end event
                yield _format_sse(EventType.AGENT_END, _create_event(
                    EventType.AGENT_END,
                    run_id,
                    agent=agent_name,
                    task=task_info[i]["description"] if i < len(task_info) else "",
                    content=f"{agent_name} completed",
                    data={
                        "step_number": i + 1,
                        "total_steps": total_tasks,
                        "output_preview": output_preview
                    }
                ))
                await asyncio.sleep(0.05)
                
                reasoning_steps.append(AgentStep(
                    agent_name=agent_name,
                    task_name=task_info[i]["description"][:100] if i < len(task_info) else "Analysis",
                    summary=summary,
                    output_preview=output_preview
                ))
            
            response_text = str(result)
            
            # Check for visualization in result
            if "visualization" in agents_needed:
                chart_data = _extract_chart_from_result(response_text)
                if chart_data:
                    charts.append(chart_data)
            
            # DISABLED: Evidence chart generation was causing long delays
            # TODO: Re-enable after optimizing chart generation performance
            # if any(agent in agents_needed for agent in ["holiday", "strategy"]):
            #     ... (chart generation code)
            # DISABLED - Evidence Visualizer was causing 8+ minute delays
        
        # RUN_END - Final response
        final_data = {
            "response": response_text,
            "routing_reasoning": reasoning,
            "agents_used": agents_needed,
            "reasoning_steps": [
                {
                    "agent_name": step.agent_name,
                    "task_name": step.task_name,
                    "summary": step.summary,
                    "output_preview": step.output_preview
                }
                for step in reasoning_steps
            ],
            "charts": [
                {
                    "chart_type": c.chart_type,
                    "title": c.title,
                    "image_base64": c.image_base64,
                    "image": c.image_base64,  # Alias for frontend compatibility
                    "chart_data": c.chart_data,  # Interactive chart data
                }
                for c in charts
            ] if charts else None
        }
        
        yield _format_sse(EventType.RUN_END, _create_event(
            EventType.RUN_END,
            run_id,
            content="Analysis complete",
            data=final_data
        ))
        
    except Exception as e:
        yield _format_sse(EventType.ERROR, _create_event(
            EventType.ERROR,
            run_id,
            content=str(e),
            data={"error_type": type(e).__name__}
        ))
    
    finally:
        emitter.close()


def _extract_chart_from_result(result_text: str) -> Optional[ChartData]:
    """Extract chart data from result text if present."""
    try:
        # Look for JSON with image data
        json_match = re.search(r'\{[^{}]*"image"\s*:\s*"[^"]+base64[^"]*"[^{}]*\}', result_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            if data.get("image"):
                return ChartData(
                    chart_type=data.get("chart_type", "visualization"),
                    title=data.get("title", "Chart"),
                    image_base64=data["image"]
                )
    except:
        pass
    return None
