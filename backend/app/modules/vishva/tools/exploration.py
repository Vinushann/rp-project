import asyncio
import httpx
import json
from .browser_tools import get_visible_text, scroll_page, click_element

async def get_available_models() -> list[str]:
    """Call Ollama API: GET /api/tags and return list of model names."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []
    return []

def select_best_model(models: list[str]) -> str:
    """Rules: Prefer Qwen models. Priority order: qwen2.5:14b, qwen2.5:7b, any qwen model, fallback: first available."""
    priority = ["qwen2.5:14b", "qwen2.5:7b"]
    for p in priority:
        if p in models:
            return p
    for m in models:
        if "qwen" in m.lower():
            return m
    return models[0] if models else "qwen2.5:7b"

async def decide_next_action(state: dict, model: str) -> dict:
    """LLM decision function using Ollama POST /api/generate."""
    prompt = f"""You are a web browsing agent.

Given the current page state, decide the next action.

Available actions:
- click
- scroll
- finish

Rules:
1. Click if a button likely reveals menu content
2. Scroll if more content may exist
3. Finish only if menu appears fully visible and no more actions are useful
4. Do NOT repeat useless actions

Current Page State:
Headings: {state.get('headings', [])}
Buttons: {state.get('buttons', [])}
Text Sample: {state.get('visible_text_sample', '')}

Return ONLY JSON:
{{
"thought": "brief reasoning",
"action": "click|scroll|finish",
"action_input": "button text if clicking"
}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            if response.status_code == 200:
                result = response.json()
                raw_response = result.get("response", "")
                return json.loads(raw_response)
    except Exception:
        pass
    
    return {"thought": "Error or invalid output, falling back to scroll", "action": "scroll", "action_input": ""}

async def run_exploration_loop(page) -> dict:
    """Main exploration loop using LLM-driven reasoning."""
    models = await get_available_models()
    model = select_best_model(models)
    
    actions_taken = []
    clicked_buttons = set()
    no_new_content_count = 0
    
    for i in range(10):
        state = await get_visible_text(page)
        decision = await decide_next_action(state, model)
        
        action = decision.get("action", "scroll")
        action_input = decision.get("action_input", "")
        thought = decision.get("thought", "No thought provided")

        if action not in ["click", "scroll", "finish"]:
            action = "scroll"

        if action == "click":
            # Safety rule: Track clicked buttons → do not repeat
            if action_input and action_input in clicked_buttons:
                action = "scroll"
            else:
                result = await click_element(page, action_input)
                if result.get("clicked"):
                    clicked_buttons.add(action_input)
                    actions_taken.append({
                        "step": i + 1, 
                        "action": "click", 
                        "input": action_input, 
                        "thought": thought
                    })
                else:
                    action = "scroll" # Fallback if click failed

        if action == "scroll":
            result = await scroll_page(page)
            new_content = result.get("new_content", False)
            actions_taken.append({
                "step": i + 1, 
                "action": "scroll", 
                "new_content": new_content, 
                "thought": thought
            })
            
            # Safety rule: Stop if scroll returns no new content twice
            if not new_content:
                no_new_content_count += 1
            else:
                no_new_content_count = 0
                
            if no_new_content_count >= 2:
                break

        elif action == "finish":
            actions_taken.append({
                "step": i + 1, 
                "action": "finish", 
                "thought": thought
            })
            break
            
    final_state = await get_visible_text(page)
    return {
        "success": True,
        "actions_taken": actions_taken,
        "final_state": final_state,
        "model_used": model
    }
