"""
Dynamic Router - Uses OpenAI to decide which agents to call based on the manager's question.
"""

import json
import os
from typing import List

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


# Available capabilities and their agent mappings
AGENT_CAPABILITIES = {
    "historical": {
        "description": "Analyze past sales data, food trends, top-selling items, declining items, discount patterns",
        "keywords": ["trend", "past", "history", "sold", "selling", "popular", "declining", "discount", "last month", "previous"],
        "agent_name": "historical_analyst",
        "task_name": "historical_task",
    },
    "forecasting": {
        "description": "Predict future demand using trained Prophet ML model, daily sales forecast, busiest days, staffing needs",
        "keywords": ["forecast", "predict", "future", "demand", "expect", "next month", "next week", "upcoming", "staff", "busy", "busiest", "projection", "anticipate", "what will", "how much will", "estimate"],
        "agent_name": "forecasting_specialist", 
        "task_name": "forecasting_task",
    },
    "holiday": {
        "description": "Analyze holiday effects on sales, festival impacts, Poya days, special events",
        "keywords": ["holiday", "festival", "poya", "event", "celebration", "special day", "public holiday"],
        "agent_name": "holiday_analyst",
        "task_name": "holiday_task",
    },
    "weather": {
        "description": "Analyze weather impact on sales, rain effects, temperature effects on hot/cold drinks",
        "keywords": ["weather", "rain", "temperature", "hot", "cold", "climate", "monsoon", "sunny"],
        "agent_name": "weather_analyst",
        "task_name": "weather_task",
    },
    "strategy": {
        "description": "Create comprehensive business plans, combine all insights, provide actionable recommendations",
        "keywords": ["plan", "strategy", "recommend", "should I do", "prepare", "business plan", "complete", "comprehensive"],
        "agent_name": "strategy_planner",
        "task_name": "strategy_task",
    },
    "visualization": {
        "description": "Create charts, graphs, and visual representations of sales data, trends, comparisons",
        "keywords": ["chart", "graph", "plot", "visualize", "show me", "display", "visual", "picture", "diagram", "compare visually", "trend chart", "bar chart", "pie chart", "line graph"],
        "agent_name": "visualization_specialist",
        "task_name": "visualization_task",
    },
}


def _build_routing_prompt(question: str) -> str:
    """Build the prompt for the routing LLM."""
    capabilities_desc = "\n".join([
        f"- {key}: {info['description']}"
        for key, info in AGENT_CAPABILITIES.items()
    ])
    
    return f"""You are a smart router for a coffee shop analytics system. 
Based on the manager's question, decide which analysis agents should be called.

Available agents and their capabilities:
{capabilities_desc}

Manager's question: "{question}"

Instructions:
1. First, determine if this is a BUSINESS question that requires data analysis, OR a CONVERSATIONAL message (greeting, small talk, general questions)
2. For CONVERSATIONAL messages (like "hello", "hi", "how are you", "thanks", "bye", general questions not about the coffee shop business), return an EMPTY agents_needed list
3. For BUSINESS questions, select ONLY the agents that are needed to answer this specific question
4. If it's a simple question (e.g., "what are food trends?"), select only 1-2 relevant agents
5. If it's a comprehensive question (e.g., "what should I do next month?"), select multiple agents
6. The "strategy" agent should ONLY be included if the question asks for recommendations, plans, or "what should I do"
7. The "visualization" agent should be selected when the manager asks for charts, graphs, visual representations, or uses words like "show me", "visualize", "chart", "graph", "plot", "compare visually"
8. If visualization is requested, ONLY select the visualization agent (it handles everything needed for charts)

Respond with a JSON object:
{{
    "reasoning": "Brief explanation of why you selected these agents (or why none are needed for conversational messages)",
    "agents_needed": ["list", "of", "agent", "keys"],  // Empty list [] for conversational messages
    "is_comprehensive": true/false (whether this needs a final strategy summary),
    "is_conversational": true/false (whether this is just a greeting or general conversation)
}}

Only return valid JSON, no other text."""


def route_question(question: str) -> dict:
    """
    Use OpenAI to determine which agents are needed for this question.
    
    Returns:
        dict with keys:
            - agents_needed: list of agent keys
            - reasoning: explanation
            - is_comprehensive: whether to synthesize all results
    """
    llm = ChatOpenAI(
        model=os.getenv("MODEL", "gpt-4o-mini"),
        temperature=0.1,
        timeout=30,
    )
    
    prompt = _build_routing_prompt(question)
    
    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        
        # Parse JSON response
        # Handle potential markdown code blocks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
        
        result = json.loads(content)
        
        # Check if this is a conversational message
        is_conversational = result.get("is_conversational", False)
        
        if is_conversational:
            # Return empty agents for conversational messages
            return {
                "agents_needed": [],
                "reasoning": result.get("reasoning", "This is a conversational message - no business analysis needed."),
                "is_comprehensive": False,
                "is_conversational": True,
                "needs_visualization": False,
            }
        
        # Validate agents for business questions
        valid_agents = [a for a in result.get("agents_needed", []) if a in AGENT_CAPABILITIES]
        
        # If no valid agents but not conversational, default to historical
        if not valid_agents:
            valid_agents = ["historical"]
        
        # Check if visualization is requested
        needs_visualization = "visualization" in valid_agents
        
        return {
            "agents_needed": valid_agents,
            "reasoning": result.get("reasoning", ""),
            "is_comprehensive": result.get("is_comprehensive", False),
            "is_conversational": False,
            "needs_visualization": needs_visualization,
        }
        
    except Exception as e:
        # Fallback: use keyword matching
        print(f"  ⚠️  Router fallback due to: {e}")
        return _keyword_fallback(question)


def _keyword_fallback(question: str) -> dict:
    """Fallback routing based on keywords when LLM fails."""
    question_lower = question.lower()
    agents_needed = []
    
    for agent_key, info in AGENT_CAPABILITIES.items():
        for keyword in info["keywords"]:
            if keyword in question_lower:
                if agent_key not in agents_needed:
                    agents_needed.append(agent_key)
                break
    
    # Default to historical if nothing matched
    if not agents_needed:
        agents_needed = ["historical"]
    
    # Check if comprehensive
    is_comprehensive = "strategy" in agents_needed or any(
        phrase in question_lower 
        for phrase in ["should i do", "plan", "recommend", "prepare"]
    )
    
    # Check if visualization is requested
    needs_visualization = "visualization" in agents_needed
    
    return {
        "agents_needed": agents_needed,
        "reasoning": "Matched based on keywords in question",
        "is_comprehensive": is_comprehensive,
        "is_conversational": False,
        "needs_visualization": needs_visualization,
    }


def get_agent_info(agent_key: str) -> dict:
    """Get agent configuration info."""
    return AGENT_CAPABILITIES.get(agent_key, {})


def format_routing_decision(routing_result: dict) -> str:
    """Format the routing decision for terminal display."""
    lines = []
    lines.append("\n╔" + "═" * 70 + "╗")
    lines.append("║" + " 🧠  INTELLIGENT ROUTING DECISION".center(70) + "║")
    lines.append("╚" + "═" * 70 + "╝")
    lines.append("")
    lines.append(f"  💭 Reasoning: {routing_result['reasoning']}")
    lines.append("")
    lines.append("  📋 Agents that will be called:")
    
    agent_icons = {
        "historical": "📜",
        "forecasting": "📈", 
        "holiday": "🎉",
        "weather": "🌦️",
        "strategy": "🧠",
    }
    
    for agent in routing_result["agents_needed"]:
        icon = agent_icons.get(agent, "🤖")
        info = AGENT_CAPABILITIES.get(agent, {})
        desc = info.get("description", "")[:60]
        lines.append(f"     {icon}  {agent}: {desc}...")
    
    lines.append("")
    
    if routing_result["is_comprehensive"]:
        lines.append("  ✨ Will synthesize a comprehensive answer")
    else:
        lines.append("  ⚡ Quick focused answer (no full strategy synthesis)")
    
    lines.append("")
    lines.append("─" * 72)
    
    return "\n".join(lines)
