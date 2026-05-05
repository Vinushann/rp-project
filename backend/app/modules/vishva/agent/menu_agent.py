"""
Menu Intelligence Agent
=======================
ReAct agent powered by local Qwen model (via Ollama) that autonomously
orchestrates menu extraction, cleaning, training, and prediction.

Uses a reasoning loop: Think → Act → Observe → Repeat
"""

import json
from typing import AsyncIterator
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.prebuilt import create_react_agent


SYSTEM_PROMPT = """You are the Athena Menu Intelligence Agent. You help restaurant owners extract, classify, and manage menu items for POS systems.

You have these tools:
1. extract_menu(url) — Scrape menu items from a restaurant website URL. Returns JSON with success, file_path, item_count.
2. clean_extracted_data(raw_file_path) — Clean raw extracted data into structured JSON. Input: the file_path from extract_menu. Returns JSON with success, clean_file, item_count.
3. train_classifier(training_file) — Train ML models to categorize menu items. Optional training_file parameter. Returns JSON with best_model, accuracy, f1_score.
4. predict_category(item_name) — Predict the category of a single menu item name string. Returns JSON with category, confidence.
5. predict_multiple_items(item_names_json) — Predict categories for multiple items. Input: a JSON array string like '["Chicken Kottu", "Lime Juice"]'. Returns JSON array of predictions.
6. get_model_status() — Check if a trained model exists and its metrics. No arguments.
7. get_menu_data() — View current menu training data and statistics. No arguments.

RULES:
- NEVER make up or guess tool results. You MUST call the tool and use its actual output.
- NEVER invent menu items, categories, prices, or any other data.
- When a user gives a URL: call extract_menu → use the returned file_path to call clean_extracted_data → report results.
- Before training: call get_menu_data to check data exists.
- Before predicting: call get_model_status to check a model exists.
- After each tool call, read the actual JSON result and report what it says.
- If a tool returns an error, report the exact error message.
- Do NOT describe what you "would" do — actually call the tools.
- Keep responses short and factual. Report numbers from tool results, not guesses."""


def _create_llm(model: str = "qwen2.5:7b", base_url: str = "http://localhost:11434"):
    """Create a ChatOllama instance pointing at the local Qwen model."""
    return ChatOllama(
        model=model,
        base_url=base_url,
        temperature=0,
    )


class MenuAgent:
    """Wrapper around the LangGraph ReAct agent for menu intelligence."""

    def __init__(self, model: str = "qwen2.5:7b", base_url: str = "http://localhost:11434"):
        from .tools import ALL_TOOLS

        self.llm = _create_llm(model=model, base_url=base_url)
        self.tools = ALL_TOOLS
        self.graph = create_react_agent(
            self.llm,
            self.tools,
            prompt=SystemMessage(content=SYSTEM_PROMPT),
        )

    def invoke(self, user_message: str, thread_id: str = "default") -> dict:
        """
        Send a message to the agent and get a response (synchronous).

        Returns dict with keys:
          - reply: str (the agent's final text response)
          - tools_used: list[str] (names of tools the agent called)
          - steps: list[dict] (intermediate reasoning steps for UI)
        """
        result = self.graph.invoke(
            {"messages": [HumanMessage(content=user_message)]},
            config={"configurable": {"thread_id": thread_id}},
        )
        return self._parse_result(result)

    async def ainvoke(self, user_message: str, thread_id: str = "default") -> dict:
        """Async version of invoke."""
        result = await self.graph.ainvoke(
            {"messages": [HumanMessage(content=user_message)]},
            config={"configurable": {"thread_id": thread_id}},
        )
        return self._parse_result(result)

    async def astream(self, user_message: str, thread_id: str = "default") -> AsyncIterator[dict]:
        """
        Stream agent events for real-time UI updates.

        Yields dicts with 'type' key:
          - thought: agent reasoning text (buffered into complete chunks)
          - tool_start: tool about to be called
          - tool_result: tool returned a result
          - response: final agent reply
        """
        thought_buffer = []

        async for event in self.graph.astream_events(
            {"messages": [HumanMessage(content=user_message)]},
            config={"configurable": {"thread_id": thread_id}},
            version="v2",
        ):
            kind = event.get("event", "")

            if kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    thought_buffer.append(chunk.content)
                    # Flush on sentence-ending punctuation or newlines
                    buffered = "".join(thought_buffer)
                    if buffered.rstrip().endswith((".", "!", "?", ":", "\n")) or len(buffered) > 120:
                        yield {"type": "thought", "content": buffered}
                        thought_buffer = []

            elif kind == "on_chat_model_end":
                # Flush remaining thought buffer when the LLM finishes
                if thought_buffer:
                    yield {"type": "thought", "content": "".join(thought_buffer)}
                    thought_buffer = []

            elif kind == "on_tool_start":
                # Flush any buffered thought before tool events
                if thought_buffer:
                    yield {"type": "thought", "content": "".join(thought_buffer)}
                    thought_buffer = []
                yield {
                    "type": "tool_start",
                    "tool": event.get("name", ""),
                    "input": str(event.get("data", {}).get("input", ""))[:500],
                }

            elif kind == "on_tool_end":
                output = event.get("data", {}).get("output", "")
                yield {
                    "type": "tool_result",
                    "tool": event.get("name", ""),
                    "result": str(output)[:1000],
                }

        # Flush any remaining buffer
        if thought_buffer:
            yield {"type": "thought", "content": "".join(thought_buffer)}
        yield {"type": "done"}

    @staticmethod
    def _parse_result(result: dict) -> dict:
        """Extract the final reply and tool usage from a LangGraph result."""
        messages = result.get("messages", [])
        tools_used = []
        steps = []

        for msg in messages:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tools_used.append(tc["name"])
                    steps.append({
                        "type": "tool_call",
                        "tool": tc["name"],
                        "input": str(tc.get("args", ""))[:500],
                    })
            if hasattr(msg, "name") and msg.name:
                # This is a tool result message
                steps.append({
                    "type": "tool_result",
                    "tool": msg.name,
                    "result": str(msg.content)[:500],
                })

        # Last AI message is the final reply
        reply = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                reply = msg.content
                break

        return {
            "reply": reply,
            "tools_used": tools_used,
            "steps": steps,
        }
