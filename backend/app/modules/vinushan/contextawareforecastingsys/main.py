#!/usr/bin/env python
import os
import re
import sys
import warnings
from calendar import month_abbr, month_name
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from contextawareforecastingsys import REPORTS_DIR
from contextawareforecastingsys.crew import Contextawareforecastingsys
from contextawareforecastingsys.router import route_question, format_routing_decision
from contextawareforecastingsys.dynamic_crew import DynamicCrewBuilder

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")
load_dotenv()


def _ensure_directories() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def _get_default_period() -> tuple[int, int]:
    """Calculate default target period (next month)."""
    today = datetime.now()
    default_month = 1 if today.month == 12 else today.month + 1
    default_year = today.year + 1 if today.month == 12 else today.year
    return default_month, default_year


def _build_default_inputs() -> dict:
    """Provide default inputs for non-interactive flows (e.g., triggers)."""
    target_month, target_year = _get_default_period()
    years_back = int(os.getenv("HISTORY_YEARS", "4"))
    business_name = os.getenv("BUSINESS_NAME", "Rossmann Coffee Shop")
    location = os.getenv("BUSINESS_LOCATION", "Katunayake / Negombo, Sri Lanka")
    default_question = os.getenv(
        "DEFAULT_MANAGER_QUESTION",
        f"What should I do in {month_name[target_month]}?",
    )
    return {
        "business_name": business_name,
        "location": location,
        "target_month": target_month,
        "target_year": target_year,
        "target_month_name": month_name[target_month],
        "years_back": years_back,
        "user_question": default_question,
    }


def _show_example_questions() -> None:
    """Display example questions the user can ask."""
    print("\n" + "=" * 60)
    print("📋 EXAMPLE QUESTIONS YOU CAN ASK:")
    print("=" * 60)
    examples = [
        "What should I do in {month}?",
        "How should I prepare for {month}?",
        "What items should I stock up on for {month}?",
        "What promotions should I run in {month}?",
        "How many staff do I need in {month}?",
        "What are the risks for {month}?",
        "Give me a complete business plan for {month}",
        "What holidays affect sales in {month}?",
        "How does weather impact my sales in {month}?",
        "Which products are declining and need attention?",
    ]
    for i, q in enumerate(examples, 1):
        print(f"  {i}. {q}")
    print("=" * 60 + "\n")


def _find_month_in_text(question: str) -> int | None:
    """Return the month number if the question explicitly names a month."""
    lowered = question.lower()
    for idx in range(1, 13):
        if month_name[idx].lower() in lowered:
            return idx
        if month_abbr[idx].lower() in lowered:
            return idx
    return None


def _find_year_in_text(question: str) -> int | None:
    """Extract a 4-digit year if the manager provided one."""
    match = re.search(r"(20\d{2})", question)
    return int(match.group(1)) if match else None


def _shift_month(offset: int) -> tuple[int, int]:
    """Return month/year offset from current month (e.g., +1 for next month)."""
    today = datetime.now()
    month_val = today.month + offset
    year_val = today.year
    while month_val > 12:
        month_val -= 12
        year_val += 1
    while month_val < 1:
        month_val += 12
        year_val -= 1
    return month_val, year_val


def _detect_relative_month(question: str) -> tuple[int | None, int | None, str | None]:
    """Detect phrases like 'next month' or 'this month' in the question."""
    lowered = question.lower()
    relative_keywords: dict[str, int] = {
        "next month": 1,
        "upcoming month": 1,
        "coming month": 1,
        "following month": 1,
        "this month": 0,
        "current month": 0,
    }
    for phrase, offset in relative_keywords.items():
        if phrase in lowered:
            month_val, year_val = _shift_month(offset)
            return month_val, year_val, phrase
    return None, None, None


def _confirm_assumed_month(month_val: int, year_val: int, phrase: str) -> bool:
    """Ask the manager to confirm inferred month/year."""
    prompt = (
        f"🤖 You mentioned '{phrase}'. Should I plan for {month_name[month_val]} {year_val}? "
        "[y/N]: "
    )
    answer = input(prompt).strip().lower()
    return answer in {"y", "yes"}


def _prompt_for_month(default_month: int) -> int:
    """Ask the manager to pick a month when we cannot infer it."""
    while True:
        response = input(
            f"📅 Enter target month (1-12) [default: {default_month} - {month_name[default_month]}]: "
        ).strip()
        if not response:
            return default_month
        if response.isdigit() and 1 <= int(response) <= 12:
            return int(response)
        print("❌ Invalid month. Please enter a number between 1 and 12.")


def _suggest_year_for_month(month_val: int) -> int:
    """Default year: current year unless the month already passed (then next year)."""
    today = datetime.now()
    year_val = today.year
    if month_val < today.month:
        year_val += 1
    return year_val


def _prompt_for_year(default_year: int) -> int:
    """Ask the manager to confirm or override the target year."""
    while True:
        response = input(f"📅 Enter target year [default: {default_year}]: ").strip()
        if not response:
            return default_year
        if response.isdigit() and len(response) == 4:
            return int(response)
        print("❌ Invalid year. Please enter a 4-digit year (e.g., 2026).")


def _interactive_inputs() -> dict:
    """Interactively collect inputs, clarifying month/year from the manager's question."""
    print("\n" + "🚀" * 20)
    print("  CONTEXT-AWARE FORECASTING SYSTEM")
    print("  Rossmann Coffee Shop - Strategic Planner")
    print("🚀" * 20 + "\n")

    defaults = _build_default_inputs()
    business_name = defaults["business_name"]
    location = defaults["location"]
    years_back = defaults["years_back"]
    fallback_month = defaults["target_month"]
    fallback_year = defaults["target_year"]

    _show_example_questions()
    print("Manager, type your question below (anything you'd ask in chat).")
    question_input = input("❓ Your question: ").strip()
    if not question_input:
        question_input = defaults["user_question"]

    target_month = _find_month_in_text(question_input)
    target_year = _find_year_in_text(question_input)

    if target_month is None:
        inferred_month, inferred_year, phrase = _detect_relative_month(question_input)
        if inferred_month and phrase:
            if _confirm_assumed_month(inferred_month, inferred_year or fallback_year, phrase):
                target_month = inferred_month
                target_year = inferred_year

    if target_month is None:
        target_month = _prompt_for_month(fallback_month)

    if target_year is None:
        default_year = _suggest_year_for_month(target_month)
        target_year = _prompt_for_year(default_year)

    target_month_name = month_name[target_month]

    print(f"\n✅ Planning for: {target_month_name} {target_year}")
    print(f"✅ Question: {question_input}")
    print(f"✅ Business: {business_name} ({location})")
    print("\n" + "-" * 60 + "\n")

    return {
        "business_name": business_name,
        "location": location,
        "target_month": target_month,
        "target_year": target_year,
        "target_month_name": target_month_name,
        "years_back": years_back,
        "user_question": question_input,
    }


def _print_reasoning_trace(result) -> None:
    """Print a clean, formatted trace of how the agents worked."""
    # Agent emoji mapping for visual distinction
    agent_icons = {
        "historical": "📜",
        "forecast": "📈",
        "holiday": "🎉",
        "weather": "🌦️",
        "strategy": "🧠",
    }

    def _get_icon(agent_name: str) -> str:
        lower = agent_name.lower()
        for key, icon in agent_icons.items():
            if key in lower:
                return icon
        return "🤖"

    print("\n")
    print("╔" + "═" * 70 + "╗")
    print("║" + " 🔍  HOW THE SYSTEM WORKED (REASONING TRACE)".center(70) + "║")
    print("╚" + "═" * 70 + "╝")

    tasks_output = getattr(result, "tasks_output", [])
    if not tasks_output:
        print("\n  (No detailed task output available)\n")
        return

    for idx, task in enumerate(tasks_output, 1):
        agent_name = getattr(task, "agent", "Unknown Agent")
        task_name = getattr(task, "name", f"Task {idx}")
        summary = getattr(task, "summary", None)
        raw_output = getattr(task, "raw", "") or ""

        icon = _get_icon(agent_name)

        # Header for each step
        print("\n" + "─" * 72)
        print(f"  STEP {idx}: {icon}  {agent_name}")
        print("─" * 72)

        # Task description
        if task_name:
            print(f"  📋 Task: {task_name}")

        # What the agent thought/did
        if summary:
            print(f"  💭 Summary: {summary}")

        # Show a snippet of the output (first 500 chars)
        if raw_output:
            preview = raw_output[:500].strip()
            if len(raw_output) > 500:
                preview += "..."
            print(f"\n  📤 Output Preview:")
            for line in preview.split("\n"):
                print(f"     {line}")

        # Show if agent passed info to next
        if idx < len(tasks_output):
            next_agent = getattr(tasks_output[idx], "agent", "next agent")
            next_icon = _get_icon(next_agent)
            print(f"\n  ➡️  Passing findings to {next_icon} {next_agent}")

    # Token usage if available
    usage = getattr(result, "token_usage", None)
    if usage:
        print("\n" + "─" * 72)
        print("  📊 TOKEN USAGE")
        print("─" * 72)
        if hasattr(usage, "total_tokens"):
            print(f"     Total tokens: {usage.total_tokens:,}")
        if hasattr(usage, "prompt_tokens"):
            print(f"     Prompt tokens: {usage.prompt_tokens:,}")
        if hasattr(usage, "completion_tokens"):
            print(f"     Completion tokens: {usage.completion_tokens:,}")

    print("\n" + "═" * 72)
    print("  ✅ ALL AGENTS COMPLETED THEIR WORK")
    print("═" * 72 + "\n")


def run():
    """Run the crew interactively with intelligent routing."""
    _ensure_directories()
    inputs = _interactive_inputs()
    user_question = inputs.get("user_question", "")

    # Step 1: Route the question to determine which agents are needed
    print("\n" + "─" * 60)
    print("  🧠 Analyzing your question to determine the best approach...")
    print("─" * 60)

    routing_result = route_question(user_question)
    
    # Display the routing decision
    print(format_routing_decision(routing_result))

    # Step 2: Build a dynamic crew with only the needed agents
    print("  ⏳ Running selected agents...")
    print("  🤖 Agents are analyzing data and collaborating...")
    print("─" * 60 + "\n")

    try:
        builder = DynamicCrewBuilder()
        crew = builder.build_crew(
            agents_needed=routing_result["agents_needed"],
            inputs=inputs,
            is_comprehensive=routing_result["is_comprehensive"],
        )
        
        result = crew.kickoff(inputs=inputs)

        # Print the reasoning trace
        _print_reasoning_trace(result)

        # Print final answer with appropriate header
        if routing_result["is_comprehensive"]:
            header = "📊  STRATEGIC PLAN"
        else:
            header = "💬  ANSWER TO YOUR QUESTION"
        
        print("╔" + "═" * 70 + "╗")
        print("║" + f" {header}".center(70) + "║")
        print("╚" + "═" * 70 + "╝")
        print()
        print(result.raw if hasattr(result, "raw") else str(result))
        print()

    except Exception as exc:
        raise Exception(f"An error occurred while running the crew: {exc}") from exc


def run_full():
    """Run ALL agents (original behavior) - for comprehensive planning."""
    _ensure_directories()
    inputs = _interactive_inputs()

    print("\n" + "─" * 60)
    print("  ⏳ Running FULL analysis with all 5 agents...")
    print("  🤖 Agents are analyzing data and collaborating...")
    print("─" * 60 + "\n")

    try:
        result = Contextawareforecastingsys().crew().kickoff(inputs=inputs)

        # Print the reasoning trace
        _print_reasoning_trace(result)

        # Print final answer
        print("╔" + "═" * 70 + "╗")
        print("║" + " 📊  FULL STRATEGIC PLAN".center(70) + "║")
        print("╚" + "═" * 70 + "╝")
        print()
        print(result.raw if hasattr(result, "raw") else str(result))
        print()

    except Exception as exc:
        raise Exception(f"An error occurred while running the crew: {exc}") from exc


def train():
    """Train the crew for a given number of iterations."""
    _ensure_directories()
    inputs = _interactive_inputs()
    try:
        Contextawareforecastingsys().crew().train(
            n_iterations=int(sys.argv[1]),
            filename=sys.argv[2],
            inputs=inputs,
        )
    except Exception as exc:
        raise Exception(f"An error occurred while training the crew: {exc}") from exc


def replay():
    """Replay the crew execution from a specific task."""
    try:
        Contextawareforecastingsys().crew().replay(task_id=sys.argv[1])
    except Exception as exc:
        raise Exception(f"An error occurred while replaying the crew: {exc}") from exc


def test():
    """Test the crew execution and return the results."""
    _ensure_directories()
    inputs = _interactive_inputs()
    try:
        Contextawareforecastingsys().crew().test(
            n_iterations=int(sys.argv[1]),
            eval_llm=sys.argv[2],
            inputs=inputs,
        )
    except Exception as exc:
        raise Exception(f"An error occurred while testing the crew: {exc}") from exc


def run_with_trigger():
    """Run the crew with trigger payload."""
    import json

    if len(sys.argv) < 2:
        raise Exception("No trigger payload provided. Please provide JSON payload as argument.")

    try:
        trigger_payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as exc:
        raise Exception("Invalid JSON payload provided as argument") from exc

    inputs = {**_build_default_inputs(), **trigger_payload}

    _ensure_directories()
    try:
        result = Contextawareforecastingsys().crew().kickoff(inputs=inputs)
        return result
    except Exception as exc:
        raise Exception(f"An error occurred while running the crew with trigger: {exc}") from exc