"""
Dynamic Router - Uses OpenAI to decide which agents to call based on the manager's question.
"""

import json
import os
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import List

import pandas as pd
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


# ── Product catalogue (loaded once) ──────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_DATASET_PATH = _DATA_DIR / "the_rossmann_coffee_shop_sales_dataset.csv"


@lru_cache(maxsize=1)
def _load_product_names() -> set:
    """Return the set of unique product names from the dataset."""
    try:
        df = pd.read_csv(_DATASET_PATH, usecols=["food_name"])
        return set(df["food_name"].dropna().unique())
    except Exception:
        return set()


@lru_cache(maxsize=1)
def _load_product_categories() -> set:
    """Return unique category prefixes (first word of food_name)."""
    return {name.split()[0].lower() for name in _load_product_names() if name.strip()}


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

    # Build a compact product category list for the LLM
    categories = sorted(_load_product_categories())
    category_line = ", ".join(categories) if categories else "burger, chicken, dessert, drink, pasta, pizza, roll, sandwich"

    today = datetime.now().strftime("%A, %B %d, %Y")

    return f"""You are a smart router for a coffee shop analytics system called ATHENA.
Today's date is {today}.
Based on the manager's question, decide which analysis agents should be called.

Available agents and their capabilities:
{capabilities_desc}

Product categories sold by this shop: {category_line}
(Each category has variants such as "Classic Burger", "Spicy Pasta 12", "Veggie Roll 9", etc.)

Manager's question: "{question}"

CLASSIFICATION — pick exactly ONE of these five categories:

A) BUSINESS_DATA — needs data analysis agents (sales trends, forecasting, holiday analysis, weather analysis, strategy, charts).
   → Set agents_needed to the required agent keys. Set is_conversational, is_irrelevant, is_knowledge_query all to false.

B) KNOWLEDGE — questions about ATHENA itself, its methodology, models, how it works, its limitations, OR general domain advice (best practices, staffing tips, operational advice) that need knowledge-base retrieval but NOT data analysis.
   Examples: "How does ATHENA generate forecasts?", "What model does ATHENA use?", "How does ATHENA explain decisions?", "What are ATHENA's limitations?", "How can I trust this recommendation?"
   → Set agents_needed to EMPTY list []. Set is_knowledge_query=true. Set needs_rag=true.

C) CONVERSATIONAL — greetings, thanks, farewells, small talk, OR meta-requests about a previous response (e.g. "summarize that", "make it shorter", "explain like a beginner", "can you help me?").
   → Set agents_needed to EMPTY list []. Set is_conversational=true.

D) IRRELEVANT — clearly NOT about this coffee shop business or ATHENA (e.g. "capital of France", "write a poem", "explain quantum physics", sports, politics, coding help).
   → Set agents_needed to EMPTY list []. Set is_irrelevant=true.

E) UNKNOWN_PRODUCT — the question IS business-related but mentions a specific food product that does NOT exist in our categories above (e.g. "ice cream", "sushi", "steak", "tacos", "milkshakes", "noodles"). Generic terms like "items", "products", "food", "sales" are NOT unknown products — only flag specific food names absent from our catalogue.
   → Set agents_needed to EMPTY list []. Set unknown_product to the product name mentioned.

AGENT SELECTION RULES (only for BUSINESS_DATA):
1. Select ONLY the agents needed for the specific question.
2. Simple questions → 1-2 agents. Comprehensive questions → multiple agents.
3. Include "strategy" ONLY if the question asks for recommendations, plans, or "what should I do".
4. For visualization (charts/graphs/plots/"show me"/"visualize"):
   - Pure visualization of historical data → select ONLY "visualization"
   - Visualization that ALSO needs forecasting or analysis → select BOTH the data agent AND "visualization"
   - Example: "Show me a chart of forecasted demand" → ["forecasting", "visualization"]
   - Example: "Show sales trend chart" → ["visualization"]
5. Set is_comprehensive=true when multiple agents work together for a planning question.

RAG RULES:
- Set needs_rag=true for: product recommendations, promotional strategies, best practices, holiday tips, weather strategies, how ATHENA works, domain advice.
- Set needs_rag=false for: pure data queries like "top sellers last month" or "forecast demand for June".

Respond with ONLY this JSON object:
{{
    "reasoning": "Brief explanation",
    "agents_needed": [],
    "is_comprehensive": false,
    "is_conversational": false,
    "is_irrelevant": false,
    "is_knowledge_query": false,
    "unknown_product": null,
    "needs_rag": false
}}"""


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
            return {
                "agents_needed": [],
                "reasoning": result.get("reasoning", "This is a conversational message."),
                "is_comprehensive": False,
                "is_conversational": True,
                "is_irrelevant": False,
                "is_knowledge_query": False,
                "unknown_product": None,
                "needs_visualization": False,
                "needs_rag": result.get("needs_rag", False),
            }
        
        # Check if this is a knowledge/methodology query
        is_knowledge_query = result.get("is_knowledge_query", False)
        
        if is_knowledge_query:
            return {
                "agents_needed": [],
                "reasoning": result.get("reasoning", "This is a knowledge question about the system or domain."),
                "is_comprehensive": False,
                "is_conversational": False,
                "is_irrelevant": False,
                "is_knowledge_query": True,
                "unknown_product": None,
                "needs_visualization": False,
                "needs_rag": True,
            }
        
        # Check if this is an irrelevant question
        is_irrelevant = result.get("is_irrelevant", False)
        
        if is_irrelevant:
            return {
                "agents_needed": [],
                "reasoning": result.get("reasoning", "This question is not related to the coffee shop business."),
                "is_comprehensive": False,
                "is_conversational": False,
                "is_irrelevant": True,
                "is_knowledge_query": False,
                "unknown_product": None,
                "needs_visualization": False,
                "needs_rag": False,
            }
        
        # Check for unknown product
        unknown_product = result.get("unknown_product", None)
        
        if unknown_product:
            return {
                "agents_needed": [],
                "reasoning": result.get("reasoning", ""),
                "is_comprehensive": False,
                "is_conversational": False,
                "is_irrelevant": False,
                "is_knowledge_query": False,
                "unknown_product": unknown_product,
                "needs_visualization": False,
                "needs_rag": False,
            }
        
        # ── BUSINESS_DATA path ──
        valid_agents = [a for a in result.get("agents_needed", []) if a in AGENT_CAPABILITIES]
        
        # If no valid agents, default to historical
        if not valid_agents:
            valid_agents = ["historical"]
        
        needs_visualization = "visualization" in valid_agents
        needs_rag = result.get("needs_rag", False)
        
        return {
            "agents_needed": valid_agents,
            "reasoning": result.get("reasoning", ""),
            "is_comprehensive": result.get("is_comprehensive", False),
            "is_conversational": False,
            "is_irrelevant": False,
            "is_knowledge_query": False,
            "unknown_product": None,
            "needs_visualization": needs_visualization,
            "needs_rag": needs_rag,
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
    
    # Check if RAG would help based on keywords
    rag_keywords = [
        "recommend", "suggest", "advice", "best practice", "strategy",
        "promote", "promotion", "how does", "how do", "explain",
        "staffing", "inventory", "what product", "pair", "bundle",
        "methodology", "system", "how athena", "approach",
    ]
    needs_rag = any(kw in question_lower for kw in rag_keywords)
    
    return {
        "agents_needed": agents_needed,
        "reasoning": "Matched based on keywords in question",
        "is_comprehensive": is_comprehensive,
        "is_conversational": False,
        "is_irrelevant": False,
        "is_knowledge_query": False,
        "unknown_product": None,
        "needs_visualization": needs_visualization,
        "needs_rag": needs_rag,
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
