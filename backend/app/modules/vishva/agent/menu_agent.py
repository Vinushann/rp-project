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
2. clean_extracted_data(raw_file_path) — Clean raw extracted data into structured JSON. Input: the file_path from extract_menu. Returns JSON with success, file_path (if failed), clean_file (if success), item_count.
3. read_raw_file(file_path) — Read the content of a file (useful when cleaning fails). Returns first 2000 characters.
4. solve_cleaning_issue(broken_content, error_message) — Use your internal logic to fix malformed JSON/text data. Returns success status and fixed item count.
5. train_classifier(training_file) — Train ML models to categorize menu items.
6. predict_category(item_name) — Predict category for a single item.
7. predict_multiple_items(item_names_json) — Predict categories for multiple items.
8. get_model_status() — Check if a model exists.
9. get_menu_data() — View current menu training data.

STRATEGY & TRANSPARENCY:
- ALWAYS treat Extraction and Cleaning as TWO DIFFERENT STEPS.
- When a user provides a URL:
    a. First call extract_menu(url).
    b. Report that extraction is finished and show the raw data location.
    c. THEN ask or proceed to call clean_extracted_data(raw_file_path).
- IF CLEANING FAILS:
    a. Report the error to the user.
    b. Use read_raw_file(file_path) to see what went wrong.
    c. Show the user a sample of the raw/broken data so they see what was extracted.
    d. Use solve_cleaning_issue(content, error) to attempt to fix it dynamically.
    e. Let the user know you are solving the issue yourself.
- After each tool call, read the actual JSON result and report what it says.

RULES:
- NEVER make up or guess tool results. You MUST call the tool and use its actual output.
- NEVER invent menu items or categories.
- Keep responses short and factual. Report numbers from tool results, not guesses."""


def _create_llm(model: str = "qwen2.5:7b", base_url: str = "http://localhost:11434"):
    """Create a ChatOllama instance pointing at the local Qwen model."""
    return ChatOllama(
        model=model,
        base_url=base_url,
        temperature=0,
    )


import sys
import io
import asyncio
import contextvars
from contextlib import redirect_stdout

# Context variable to store the log collector for the current task
log_collector_var = contextvars.ContextVar("log_collector", default=None)

class ThreadSafeStringList:
    def __init__(self):
        self.items = []
        self.lock = asyncio.Lock()

    async def append(self, item):
        async with self.lock:
            self.items.append(item)

    async def pop_all(self):
        async with self.lock:
            res = self.items[:]
            self.items = []
            return res

class LogInterceptor(io.TextIOBase):
    def __init__(self, original_stdout):
        self.original_stdout = original_stdout

    def write(self, s):
        self.original_stdout.write(s)
        collector = log_collector_var.get()
        if collector and s.strip() and ("[AGENT]" in s or "[BOT]" in s or "[ERROR]" in s):
            try:
                # Use call_soon_threadsafe if we might be in a different thread
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(collector.append(s.strip()))
            except:
                pass
        return len(s)

    def flush(self):
        self.original_stdout.flush()

# Global interceptor
_original_stdout = sys.stdout
sys.stdout = LogInterceptor(_original_stdout)


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
        log_collector = ThreadSafeStringList()
        token = log_collector_var.set(log_collector)

        try:
            async for event in self.graph.astream_events(
                {"messages": [HumanMessage(content=user_message)]},
                config={"configurable": {"thread_id": thread_id}},
                version="v2",
            ):
                # Periodically flush logs as thoughts
                logs = await log_collector.pop_all()
                for log in logs:
                    yield {"type": "thought", "content": f"\n{log}"}

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
                    
                    tool_name = event.get("name", "")
                    yield {
                        "type": "tool_start",
                        "tool": tool_name,
                        "input": str(event.get("data", {}).get("input", ""))[:500],
                    }

                elif kind == "on_tool_end":
                    # Final log flush after tool finishes
                    logs = await log_collector.pop_all()
                    for log in logs:
                        yield {"type": "thought", "content": f"\n{log}"}
                        
                    output = event.get("data", {}).get("output", "")
                    yield {
                        "type": "tool_result",
                        "tool": event.get("name", ""),
                        "result": str(output)[:5000], # Increased limit to 5000
                    }

            # Final flushes
            logs = await log_collector.pop_all()
            for log in logs:
                yield {"type": "thought", "content": f"\n{log}"}
        finally:
            log_collector_var.reset(token)

        if thought_buffer:
            yield {"type": "thought", "content": "".join(thought_buffer)}
        yield {"type": "done"}

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
