"""
Chat Service - Integrates CrewAI with the API layer.
Handles routing, crew execution, and response formatting.
"""

import json
import os
import re
import sys
from calendar import month_name
from datetime import datetime
from typing import List, Optional, Tuple

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


def _handle_conversational_message(message: str, history: List[Message]) -> str:
    """
    Handle non-business conversational messages directly with LLM.
    This is for greetings, general questions, etc.
    """
    llm = ChatOpenAI(
        model=os.getenv("MODEL", "gpt-4o-mini"),
        temperature=0.7,
        timeout=30,
    )
    
    business_name = os.getenv("BUSINESS_NAME", "Rossmann Coffee Shop")
    
    # Build conversation context
    messages = [
        {
            "role": "system",
            "content": f"""You are a friendly AI assistant for {business_name}, a coffee shop in Sri Lanka.
You help the shop manager with business questions about sales, forecasting, inventory, and planning.

When responding to greetings or general conversation:
- Be friendly and welcoming
- Briefly mention what you can help with (sales analysis, forecasting, holiday planning, weather impacts)
- Keep responses concise and natural

When the user asks non-business questions:
- Politely redirect them to business-related topics you can help with
- Stay helpful and friendly

You have access to:
- Historical sales data analysis
- Demand forecasting
- Holiday and festival impact analysis  
- Weather impact on sales"""
        }
    ]
    
    # Add recent conversation history
    for msg in history[-4:]:
        messages.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content[:500]
        })
    
    # Add current message
    messages.append({"role": "user", "content": message})
    
    response = llm.invoke(messages)
    return response.content


def _handle_visualization_directly(message: str) -> Tuple[str, List[ChartData]]:
    """
    Handle visualization requests directly without CrewAI for fast response.
    Returns explanation text and list of charts.
    """
    message_lower = message.lower()
    charts = []
    explanation = ""
    
    try:
        # Determine which chart to create based on keywords
        if any(word in message_lower for word in ["trend", "over time", "sales trend", "monthly sales"]):
            # Check if specific item mentioned
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
            # Default to sales trend
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


def _extract_month_from_message(message: str) -> tuple[int, int]:
    """Extract month and year from message, or use defaults."""
    today = datetime.now()
    default_month = 1 if today.month == 12 else today.month + 1
    default_year = today.year + 1 if today.month == 12 else today.year
    
    message_lower = message.lower()
    
    # Check for month names
    for idx in range(1, 13):
        if month_name[idx].lower() in message_lower:
            # Check if year is mentioned
            year_match = re.search(r"(20\d{2})", message)
            year = int(year_match.group(1)) if year_match else default_year
            return idx, year
    
    # Check for relative terms
    if "next month" in message_lower:
        return default_month, default_year
    if "this month" in message_lower:
        return today.month, today.year
    
    # Default to next month
    return default_month, default_year


def _build_context_from_history(history: List[Message]) -> str:
    """Build context string from conversation history."""
    if not history:
        return ""
    
    # Take last 6 messages for context
    recent = history[-6:]
    formatted = []
    for msg in recent:
        role = "Manager" if msg.role == "user" else "Assistant"
        # Truncate long messages
        content = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
        formatted.append(f"{role}: {content}")
    
    return "\n".join(formatted)


def _extract_reasoning_steps(result) -> List[AgentStep]:
    """Extract agent steps from crew result."""
    steps = []
    tasks_output = getattr(result, "tasks_output", [])
    
    for task in tasks_output:
        agent_name = getattr(task, "agent", "Unknown Agent")
        task_name = getattr(task, "name", "")
        summary = getattr(task, "summary", None)
        raw = getattr(task, "raw", "") or ""
        
        # Get preview of output
        preview = raw[:300].strip() if raw else None
        if preview and len(raw) > 300:
            preview += "..."
        
        steps.append(AgentStep(
            agent_name=agent_name,
            task_name=task_name or "analysis",
            summary=summary,
            output_preview=preview
        ))
    
    return steps


def _extract_charts_from_response(response_text: str) -> Tuple[str, List[ChartData]]:
    """
    Extract chart data (base64 images) from the response text.
    Returns cleaned response text and list of charts.
    """
    charts = []
    cleaned_text = response_text
    
    # Try to find JSON blocks containing chart data
    json_pattern = r'\{[^{}]*"image"[^{}]*"title"[^{}]*"explanation"[^{}]*\}'
    
    # More flexible pattern to find chart JSON in the response
    patterns = [
        r'```json\s*(\{[^`]*?"image"[^`]*?\})\s*```',  # JSON in code blocks
        r'(\{[^{}]*"image"\s*:\s*"[^"]*"[^{}]*"title"[^{}]*"explanation"[^{}]*\})',  # Direct JSON
        r'(\{[^{}]*"title"[^{}]*"image"\s*:\s*"[^"]*"[^{}]*"explanation"[^{}]*\})',  # Different order
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, response_text, re.DOTALL | re.IGNORECASE)
        for match in matches:
            try:
                # Clean up the JSON string
                json_str = match.strip()
                data = json.loads(json_str)
                
                if data.get("image"):
                    charts.append(ChartData(
                        image=data.get("image"),
                        title=data.get("title", "Chart"),
                        explanation=data.get("explanation", "")
                    ))
                    # Remove the JSON from the response
                    cleaned_text = cleaned_text.replace(match, "")
                    cleaned_text = cleaned_text.replace("```json", "").replace("```", "")
            except (json.JSONDecodeError, TypeError):
                continue
    
    # Also try to extract from the raw output if it looks like JSON
    if not charts:
        try:
            # Sometimes the whole response is JSON
            data = json.loads(response_text)
            if isinstance(data, dict) and data.get("image"):
                charts.append(ChartData(
                    image=data.get("image"),
                    title=data.get("title", "Chart"),
                    explanation=data.get("explanation", "")
                ))
                cleaned_text = data.get("explanation", "")
        except (json.JSONDecodeError, TypeError):
            pass
    
    # Clean up the text
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    cleaned_text = re.sub(r'^\s*[\[\]{}]\s*$', '', cleaned_text, flags=re.MULTILINE)
    
    # If we extracted charts and have explanation, use that
    if charts and charts[0].explanation and not cleaned_text.strip():
        cleaned_text = charts[0].explanation
    
    return cleaned_text, charts


def process_chat_message(
    message: str,
    conversation_history: List[Message]
) -> ChatResponse:
    """
    Process a chat message from the manager.
    
    Args:
        message: The user's message
        conversation_history: Previous messages in the conversation
        
    Returns:
        ChatResponse with the assistant's response and metadata
    """
    # Step 1: Route the question to determine which agents are needed
    routing_result = route_question(message)
    
    # Step 2: Check if this is a conversational message (no agents needed)
    agents_needed = routing_result.get("agents_needed", [])
    
    if not agents_needed or len(agents_needed) == 0:
        # Handle conversational messages directly without CrewAI
        try:
            response_text = _handle_conversational_message(message, conversation_history)
        except Exception as e:
            response_text = "Hello! I'm your Coffee Shop AI Assistant. I can help you with sales analysis, demand forecasting, holiday planning, and weather impact on your business. What would you like to know?"
        
        return ChatResponse(
            response=response_text,
            agents_used=[],
            reasoning_steps=[],
            routing_reasoning=routing_result.get("reasoning", "This is a conversational message - no business analysis needed."),
            charts=[]
        )
    
    # Step 3: Handle visualization requests DIRECTLY (fast path - no CrewAI)
    if agents_needed == ["visualization"]:
        explanation, charts = _handle_visualization_directly(message)
        return ChatResponse(
            response=explanation,
            agents_used=["visualization"],
            reasoning_steps=[AgentStep(
                agent_name="Visualization Agent",
                task_name="chart_generation",
                summary="Generated chart directly from sales data",
                output_preview=None
            )],
            routing_reasoning=routing_result.get("reasoning", "Visualization request - generating chart directly."),
            charts=charts
        )
    
    # Step 4: Extract month/year context for business queries
    target_month, target_year = _extract_month_from_message(message)
    
    # Step 5: Build context from history
    history_context = _build_context_from_history(conversation_history)
    
    # Step 6: Prepare inputs for CrewAI
    business_name = os.getenv("BUSINESS_NAME", "Rossmann Coffee Shop")
    location = os.getenv("BUSINESS_LOCATION", "Katunayake / Negombo, Sri Lanka")
    years_back = int(os.getenv("HISTORY_YEARS", "4"))
    
    # Enhance the question with conversation context
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
    
    # Step 7: Build and run the dynamic crew
    builder = DynamicCrewBuilder()
    crew = builder.build_crew(
        agents_needed=agents_needed,
        inputs=inputs,
        is_comprehensive=routing_result["is_comprehensive"],
    )
    
    charts = []
    try:
        result = crew.kickoff(inputs=inputs)
        
        # Step 8: Extract the response and reasoning steps
        response_text = result.raw if hasattr(result, "raw") else str(result)
        reasoning_steps = _extract_reasoning_steps(result)
        
        # Step 9: Extract any charts from the response (for visualization requests)
        if "visualization" in agents_needed:
            response_text, charts = _extract_charts_from_response(response_text)
            
    except Exception as e:
        # Handle crew execution errors gracefully
        response_text = f"I encountered an issue while processing your request. Please try rephrasing your question or try again later. Error: {str(e)}"
        reasoning_steps = []
    
    # Step 10: Build the response
    return ChatResponse(
        response=response_text,
        agents_used=agents_needed,
        reasoning_steps=reasoning_steps,
        routing_reasoning=routing_result.get("reasoning"),
        charts=charts
    )
