"""
Streaming Chat Service - Real-time reasoning updates via Server-Sent Events.
Provides ChatGPT-like streaming of agent reasoning steps.
"""

import json
import os
import re
from calendar import month_name
from datetime import datetime
from typing import AsyncGenerator, List

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Disable CrewAI telemetry prompts before importing
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
)
from .models import Message, AgentStep, ChatResponse, ChartData

load_dotenv()


def _format_sse(event_type: str, data: dict) -> str:
    """Format data as Server-Sent Event."""
    json_data = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {json_data}\n\n"


def _handle_conversational_message(message: str, history: List[Message]) -> str:
    """Handle non-business conversational messages directly with LLM."""
    llm = ChatOpenAI(
        model=os.getenv("MODEL", "gpt-4o-mini"),
        temperature=0.7,
        timeout=30,
    )
    
    business_name = os.getenv("BUSINESS_NAME", "Rossmann Coffee Shop")
    
    messages = [
        {
            "role": "system",
            "content": f"""You are a friendly AI assistant for {business_name}, a coffee shop in Sri Lanka.
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
    return response.content


def _handle_visualization_directly(message: str) -> tuple:
    """Handle visualization requests directly without CrewAI."""
    message_lower = message.lower()
    charts = []
    explanation = ""
    
    try:
        if any(word in message_lower for word in ["trend", "over time", "sales trend", "monthly sales"]):
            item = None
            for food in ["coffee", "latte", "cappuccino", "espresso", "tea", "cake", "muffin", "sandwich", "croissant"]:
                if food in message_lower:
                    item = food
                    break
            result = create_sales_trend_chart(item_name=item, months=6, group_by="month")
        elif any(word in message_lower for word in ["top", "best selling", "popular", "most sold"]):
            result = create_top_items_chart(top_n=10)
        elif any(word in message_lower for word in ["daily", "hourly", "pattern", "hour", "time of day"]):
            result = create_daily_pattern_chart()
        elif any(word in message_lower for word in ["year", "compare", "yearly", "annual", "yoy"]):
            result = create_monthly_comparison_chart()
        elif any(word in message_lower for word in ["category", "pie", "distribution", "breakdown"]):
            result = create_category_pie_chart()
        elif any(word in message_lower for word in ["weather", "rain", "temperature", "sunny"]):
            result = create_weather_impact_chart()
        elif any(word in message_lower for word in ["holiday", "festival", "special day", "event"]):
            result = create_holiday_impact_chart()
        else:
            result = create_sales_trend_chart(months=6, group_by="month")
        
        if result and result.get("image"):
            charts.append(ChartData(
                image=result["image"],
                title=result.get("title", "Sales Chart"),
                explanation=result.get("explanation", ""),
                chart_data=result.get("chart_data"),
            ))
            explanation = result.get("explanation", "Here's the visualization you requested.")
        else:
            explanation = "I couldn't generate the chart. Please try a different request."
            
    except Exception as e:
        explanation = f"Error generating visualization: {str(e)}"
    
    return explanation, charts


def _extract_month_from_message(message: str) -> tuple:
    """Extract month and year from message, or use defaults."""
    today = datetime.now()
    default_month = 1 if today.month == 12 else today.month + 1
    default_year = today.year + 1 if today.month == 12 else today.year
    
    message_lower = message.lower()
    
    for idx in range(1, 13):
        if month_name[idx].lower() in message_lower:
            year_match = re.search(r"(20\d{2})", message)
            year = int(year_match.group(1)) if year_match else default_year
            return idx, year
    
    if "next month" in message_lower:
        return default_month, default_year
    if "this month" in message_lower:
        return today.month, today.year
    
    return default_month, default_year


def _build_context_from_history(history: List[Message]) -> str:
    """Build context string from conversation history."""
    if not history:
        return ""
    
    recent = history[-6:]
    formatted = []
    for msg in recent:
        role = "Manager" if msg.role == "user" else "Assistant"
        content = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
        formatted.append(f"{role}: {content}")
    
    return "\n".join(formatted)


async def stream_chat_response(
    message: str,
    conversation_history: List[Message]
) -> AsyncGenerator[str, None]:
    """
    Stream chat response with real-time reasoning updates.
    Yields Server-Sent Events for each step of the process.
    """
    
    # Step 1: Route the question
    yield _format_sse("status", {"message": "Analyzing your question..."})
    
    routing_result = route_question(message)
    agents_needed = routing_result.get("agents_needed", [])
    
    # Step 2: Send routing decision
    yield _format_sse("routing", {
        "reasoning": routing_result.get("reasoning", ""),
        "agents_needed": agents_needed,
        "is_comprehensive": routing_result.get("is_comprehensive", False)
    })
    
    # Step 3: Handle conversational messages
    if not agents_needed or len(agents_needed) == 0:
        yield _format_sse("status", {"message": "Generating response..."})
        
        try:
            response_text = _handle_conversational_message(message, conversation_history)
        except Exception:
            response_text = "Hello! I'm your Coffee Shop AI Assistant. I can help you with sales analysis, demand forecasting, holiday planning, and weather impact on your business."
        
        yield _format_sse("final_response", {
            "response": response_text,
            "agents_used": [],
            "reasoning_steps": [],
            "routing_reasoning": routing_result.get("reasoning", ""),
            "charts": []
        })
        return
    
    # Step 4: Handle visualization requests directly
    if agents_needed == ["visualization"]:
        yield _format_sse("agent_start", {
            "agent_name": "Visualization Specialist",
            "task_name": "chart_generation",
            "description": "Creating visual representation of sales data..."
        })
        
        explanation, charts = _handle_visualization_directly(message)
        
        yield _format_sse("agent_complete", {
            "agent_name": "Visualization Specialist",
            "task_name": "chart_generation",
            "summary": "Generated chart from sales data",
            "output_preview": explanation[:200] if explanation else None
        })
        
        yield _format_sse("final_response", {
            "response": explanation,
            "agents_used": ["visualization"],
            "reasoning_steps": [{
                "agent_name": "Visualization Specialist",
                "task_name": "chart_generation",
                "summary": "Generated chart directly from sales data",
                "output_preview": None
            }],
            "routing_reasoning": routing_result.get("reasoning", ""),
            "charts": [c.model_dump() for c in charts]
        })
        return
    
    # Step 5: Process with CrewAI agents
    target_month, target_year = _extract_month_from_message(message)
    history_context = _build_context_from_history(conversation_history)
    
    business_name = os.getenv("BUSINESS_NAME", "Rossmann Coffee Shop")
    location = os.getenv("BUSINESS_LOCATION", "Katunayake / Negombo, Sri Lanka")
    years_back = int(os.getenv("HISTORY_YEARS", "4"))
    
    enhanced_question = message
    if history_context:
        enhanced_question = f"""Previous conversation:
{history_context}

Current question: {message}"""
    
    inputs = {
        "business_name": business_name,
        "location": location,
        "target_month": target_month,
        "target_year": target_year,
        "target_month_name": month_name[target_month],
        "years_back": years_back,
        "user_question": enhanced_question,
    }
    
    # Agent descriptions for better UX
    agent_descriptions = {
        "historical": {
            "name": "Coffee shop sales historian",
            "task": "historical_analysis",
            "description": "Analyzing historical sales patterns and trends..."
        },
        "forecasting": {
            "name": "Daily demand forecaster", 
            "task": "demand_forecasting",
            "description": "Predicting future demand using statistical models..."
        },
        "holiday": {
            "name": "Holiday context analyst",
            "task": "holiday_analysis", 
            "description": "Analyzing holiday and festival impacts on sales..."
        },
        "weather": {
            "name": "Weather impact analyst",
            "task": "weather_analysis",
            "description": "Evaluating weather effects on product demand..."
        },
        "strategy": {
            "name": "Strategic advisor",
            "task": "strategy_synthesis",
            "description": "Synthesizing insights into actionable recommendations..."
        }
    }
    
    # Emit agent_start events for each agent
    reasoning_steps = []
    for agent_key in agents_needed:
        if agent_key in agent_descriptions:
            desc = agent_descriptions[agent_key]
            yield _format_sse("agent_start", {
                "agent_name": desc["name"],
                "task_name": desc["task"],
                "description": desc["description"]
            })
    
    # Build and run the crew
    builder = DynamicCrewBuilder()
    crew = builder.build_crew(
        agents_needed=agents_needed,
        inputs=inputs,
        is_comprehensive=routing_result["is_comprehensive"],
    )
    
    charts = []
    try:
        result = crew.kickoff(inputs=inputs)
        
        # Extract reasoning steps and emit agent_complete events
        tasks_output = getattr(result, "tasks_output", [])
        
        for idx, task in enumerate(tasks_output):
            agent_name = getattr(task, "agent", "Unknown Agent")
            task_name = getattr(task, "name", "")
            summary = getattr(task, "summary", None)
            raw = getattr(task, "raw", "") or ""
            
            preview = raw[:300].strip() if raw else None
            if preview and len(raw) > 300:
                preview += "..."
            
            step = AgentStep(
                agent_name=agent_name,
                task_name=task_name or "analysis",
                summary=summary,
                output_preview=preview
            )
            reasoning_steps.append(step)
            
            yield _format_sse("agent_complete", {
                "agent_name": agent_name,
                "task_name": task_name or "analysis",
                "summary": summary,
                "output_preview": preview,
                "step_number": idx + 1,
                "total_steps": len(tasks_output)
            })
        
        response_text = result.raw if hasattr(result, "raw") else str(result)
        
        # Extract charts if visualization was included
        if "visualization" in agents_needed:
            # Try to extract chart data from response
            pass
            
    except Exception as e:
        response_text = f"I encountered an issue while processing your request. Please try rephrasing your question or try again later. Error: {str(e)}"
        yield _format_sse("error", {"message": str(e)})
    
    # Final response
    yield _format_sse("final_response", {
        "response": response_text,
        "agents_used": agents_needed,
        "reasoning_steps": [s.model_dump() for s in reasoning_steps],
        "routing_reasoning": routing_result.get("reasoning"),
        "charts": [c.model_dump() for c in charts] if charts else []
    })
