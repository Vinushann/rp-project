from dotenv import load_dotenv
import asyncio
import json
from datetime import datetime
import os
import re
import sys

try:
    from ollama import Client as OllamaClient
except Exception:
    OllamaClient = None

try:
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None

# Load .env from both the backend root and the module directory
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
load_dotenv(os.path.join(backend_dir, '.env'))

# Also try module-level .env as fallback
module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(module_dir, '.env'))


def _extract_json_array(text: str):
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    value = value.lower()
    value = re.sub(r"[^\w\s]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _trim_text_for_llm(text: str, max_chars: int = 20000) -> str:
    if len(text) <= max_chars:
        return text
    head = text[:12000]
    tail = text[-8000:]
    return f"{head}\n...\n{tail}"


def _scroll_page(page, max_scrolls: int = 24, wait_ms: int = 900) -> None:
    try:
        last_height = page.evaluate("() => document.body.scrollHeight")
    except Exception:
        return
    stable_rounds = 0
    for _ in range(max_scrolls):
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(wait_ms)
        try:
            new_height = page.evaluate("() => document.body.scrollHeight")
        except Exception:
            break
        if new_height == last_height:
            stable_rounds += 1
            if stable_rounds >= 2:
                break
        else:
            stable_rounds = 0
            last_height = new_height


def _clean_field(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _filter_items(data: list, match_text: str):
    normalized_text = _normalize_text(match_text)
    filtered = []
    dropped = []
    seen = set()
    for item in data:
        if not isinstance(item, dict):
            continue
        name = _clean_field(item.get("name"))
        if not name:
            continue
        normalized_name = _normalize_text(name)
        if not normalized_name or normalized_name in seen:
            continue
        if normalized_name not in normalized_text:
            dropped.append(name)
            continue
        seen.add(normalized_name)
        filtered.append({
            "name": name,
            "price": _clean_field(item.get("price")),
            "category": _clean_field(item.get("category")),
        })
    return filtered, dropped


def _extract_with_local_llm(url: str, output_dir: str, headless: bool) -> dict:
    if sync_playwright is None:
        return {
            "success": False,
            "file_path": None,
            "message": "Playwright is not available in this environment",
            "item_count": 0
        }
    if OllamaClient is None:
        return {
            "success": False,
            "file_path": None,
            "message": "Ollama client is not available in this environment",
            "item_count": 0
        }

    # Force visible browser for local agent flow
    headless = False

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        page.goto(url, wait_until="load", timeout=60000)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        _scroll_page(page)
        page.wait_for_timeout(1000)
        try:
            body_text = page.inner_text("body")
        except Exception:
            body_text = ""
        html = page.content()
        browser.close()

    match_text = body_text or html or ""
    text_input = (body_text or "").strip()
    if len(text_input) < 500:
        text_input = html or text_input
    text_input = _trim_text_for_llm(text_input, max_chars=20000)

    prompt = (
        "Extract menu items from the page content below. "
        "Return ONLY a JSON array of objects with fields name, price, category.\n"
        "Rules:\n"
        "- Only include items whose names appear in the page content.\n"
        "- Do not invent or infer items or prices.\n"
        "- If a field is missing, use an empty string.\n"
        "- Output valid JSON only.\n\n"
        "Page content:\n"
        f"{text_input}"
    )

    model = os.getenv("VISHVA_OLLAMA_MODEL", "qwen2.5:7b")
    host = os.getenv("OLLAMA_URL", "http://localhost:11434")
    client = OllamaClient(host=host)
    response = client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0}
    )

    content = ""
    if isinstance(response, dict):
        content = (response.get("message") or {}).get("content", "")
    else:
        message = getattr(response, "message", None)
        if message is not None:
            if isinstance(message, str):
                content = message
            else:
                content = getattr(message, "content", "") or ""

    # Ensure content is a string
    if not isinstance(content, str):
        content = str(content)


    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = os.path.join(output_dir, f"raw_output_{timestamp}.txt")
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(content)

    data = _extract_json_array(content)

    if data is None or not isinstance(data, list):
        return {
            "success": False,
            "file_path": output_filename,
            "message": "Local model returned invalid JSON",
            "item_count": 0
        }

    filtered, dropped = _filter_items(data, match_text)
    if not filtered:
        return {
            "success": False,
            "file_path": output_filename,
            "message": "No extracted items could be verified against the page text",
            "item_count": 0
        }

    normalized = json.dumps(filtered, ensure_ascii=False)
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(normalized)

    dropped_count = len(dropped)
    dropped_note = f" ({dropped_count} unverified items dropped)" if dropped_count else ""

    return {
        "success": True,
        "file_path": output_filename,
        "message": f"Successfully extracted data to {output_filename}{dropped_note}",
        "item_count": len(filtered),
        "data_length": len(normalized)
    }


def extract_menu_data(url: str, output_dir: str = "data/raw", headless: bool = False, llm_provider: str = "local") -> dict:
    """
    Tool to extract menu data from a website (synchronous version).
    NOTE: Only works when called from a standalone script (not inside an existing event loop).
    For use inside FastAPI/uvicorn, use extract_menu_data_async instead.
    
    Args:
        url: The URL to scrape
        output_dir: Directory to save raw output
        headless: Whether to run the browser in headless mode. False = visible browser window.
        
    Returns:
        dict with keys: success, file_path, message, item_count
    """
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print("[BOT] Starting extraction agent...")
    print(f"[URL] Target: {url}")
    print("-" * 50)
    
    try:
        return _extract_with_local_llm(url, output_dir, headless)
    except Exception as e:
        import traceback
        error_msg = f"Error: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")

        # Save error log
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        error_file = os.path.join(output_dir, f"error_{timestamp}.txt")

        with open(error_file, "w", encoding="utf-8") as f:
            f.write(f"Error at {datetime.now()}\n")
            f.write(f"Type: {type(e).__name__}\n")
            f.write(f"Details: {str(e)}\n")
            f.write(f"\nFull Traceback:\n{traceback.format_exc()}")

        return {
            "success": False,
            "file_path": error_file,
            "message": error_msg,
            "item_count": 0
        }


async def extract_menu_data_async(url: str, output_dir: str = "data/raw", headless: bool = False, llm_provider: str = "local") -> dict:
    """
    Async version of extract_menu_data. Safe to call from within an existing event loop
    (e.g. FastAPI/uvicorn). Runs the browser agent in a separate thread with its own
    ProactorEventLoop to avoid Windows subprocess issues.
    
    Args:
        url: The URL to scrape
        output_dir: Directory to save raw output
        headless: Whether to run the browser in headless mode. False = visible browser window.
        
    Returns:
        dict with keys: success, file_path, message, item_count
    """
    def _run_in_thread():
        # On Windows, ensure the thread uses ProactorEventLoop for subprocess support
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        return extract_menu_data(url, output_dir=output_dir, headless=headless, llm_provider=llm_provider)
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_in_thread)