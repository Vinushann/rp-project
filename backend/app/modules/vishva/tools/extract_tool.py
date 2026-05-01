from dotenv import load_dotenv
from browser_use import Agent
from browser_use.browser.browser import Browser, BrowserConfig

try:
    from browser_use.llm.browser_use.chat import ChatBrowserUse
except Exception:
    ChatBrowserUse = None

try:
    from browser_use.llm.ollama.chat import ChatOllama
except Exception:
    ChatOllama = None
import asyncio
import json
from datetime import datetime
import os
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


def _build_llm(llm_provider: str = "auto"):
    provider = (llm_provider or "auto").lower()

    if provider in ("browser-use", "browser"):
        if ChatBrowserUse is None:
            raise RuntimeError("BrowserUse LLM is not available in this environment")
        api_key = os.getenv("BROWSER_USE_API_KEY")
        if not api_key:
            raise RuntimeError("BROWSER_USE_API_KEY is not set")
        return ChatBrowserUse(api_key=api_key)

    if provider in ("ollama", "local"):
        if ChatOllama is None:
            raise RuntimeError("browser_use ollama client is not available")
        model = os.getenv("VISHVA_OLLAMA_MODEL", "qwen2.5:7b")
        host = os.getenv("OLLAMA_URL", "http://localhost:11434")
        return ChatOllama(model=model, host=host)

    # auto: prefer BrowserUse if available and configured, otherwise use Ollama
    if ChatBrowserUse is not None and os.getenv("BROWSER_USE_API_KEY"):
        return ChatBrowserUse(api_key=os.getenv("BROWSER_USE_API_KEY"))
    if ChatOllama is not None:
        model = os.getenv("VISHVA_OLLAMA_MODEL", "qwen2.5:7b")
        host = os.getenv("OLLAMA_URL", "http://localhost:11434")
        return ChatOllama(model=model, host=host)

    raise RuntimeError("No LLM available for browser agent. Configure BROWSER_USE_API_KEY or install langchain_ollama.")


def _extract_json_array(text: str):
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


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

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        page.goto(url, wait_until="load", timeout=60000)
        page.wait_for_timeout(1000)
        try:
            body_text = page.inner_text("body")
        except Exception:
            body_text = ""
        html = page.content()
        browser.close()

    text_input = body_text or html
    if len(text_input) > 15000:
        text_input = text_input[:15000]

    prompt = (
        "Extract all menu items with fields name, price, category (if visible). "
        "Return ONLY a JSON array of objects.\n\n"
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
            content = getattr(message, "content", "") or ""

    data = _extract_json_array(content)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = os.path.join(output_dir, f"raw_output_{timestamp}.txt")
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(content)

    if data is None or not isinstance(data, list):
        return {
            "success": False,
            "file_path": output_filename,
            "message": "Local model returned invalid JSON",
            "item_count": 0
        }

    normalized = json.dumps(data, ensure_ascii=False)
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(normalized)

    return {
        "success": True,
        "file_path": output_filename,
        "message": f"Successfully extracted data to {output_filename}",
        "item_count": len(data),
        "data_length": len(normalized)
    }


def extract_menu_data(url: str, output_dir: str = "data/raw", headless: bool = False, llm_provider: str = "auto") -> dict:
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
    
    provider = (llm_provider or "auto").lower()
    if provider in ("ollama", "local", "local-ollama"):
        return _extract_with_local_llm(url, output_dir, headless)

    llm = _build_llm(llm_provider)
    use_vision = True
    if str(getattr(llm, "provider", "")).lower() == "ollama":
        use_vision = False
    if os.getenv("VISHVA_EXTRACT_USE_VISION") is not None:
        use_vision = os.getenv("VISHVA_EXTRACT_USE_VISION", "true").lower() in ("1", "true", "yes")

    browser = Browser(config=BrowserConfig(headless=headless))

    agent = Agent(
        task=f"""
        Visit {url}
        
        CRITICAL: Your response MUST be the actual data, not a summary.
        
        Steps:
        1. Wait for the page to fully load
        2. Scroll down slowly until all items are loaded (handle pagination if needed)
        3. Extract ALL menu items with these exact fields:
           - name: (the item name)
           - price: (the price as shown)
           - category: (if visible)
        
        OUTPUT FORMAT REQUIREMENT:
        You MUST return ONLY a JSON array of objects. Nothing else.
        Do NOT include any summary, explanation, or status message.
        Do NOT say "Successfully extracted" or "Here is the data".
        
        Return EXACTLY this format:
        [
          {{
            "name": "Item Name",
            "price": "Rs. XXX",
            "category": "Category name"
          }},
          ...
        ]
        
        Include ALL items in the JSON array.
        Your entire response should be valid JSON that starts with [ and ends with ].
        """,
        llm=llm,
        browser=browser,
        use_vision=use_vision,
    )
    
    try:
        # Run agent synchronously - this opens a local browser
        result = agent.run_sync()
        
        # Extract content
        text_output = None
        
        if hasattr(result, 'final_result'):
            try:
                text_output = result.final_result()
                print("[OK] Used final_result() method")
            except Exception as e:
                print(f"[WARN] final_result() failed: {e}")
        
        if not text_output and hasattr(result, 'history'):
            try:
                history = result.history
                if history:
                    last_item = history[-1]
                    if hasattr(last_item, 'result'):
                        text_output = last_item.result
                    elif hasattr(last_item, 'content'):
                        text_output = last_item.content
                    else:
                        text_output = str(last_item)
                    print("[OK] Used history attribute")
            except Exception as e:
                print(f"[WARN] history access failed: {e}")
        
        if not text_output:
            try:
                result_list = list(result)
                if result_list:
                    last_item = result_list[-1]
                    if hasattr(last_item, 'content'):
                        text_output = last_item.content
                    elif hasattr(last_item, 'result'):
                        text_output = last_item.result
                    else:
                        text_output = str(last_item)
                    print("[OK] Converted to list")
            except Exception as e:
                print(f"[WARN] list conversion failed: {e}")
        
        if not text_output:
            text_output = str(result)
            print("[OK] Used string conversion (fallback)")
        
        if text_output:
            if isinstance(text_output, (list, dict)):
                text_output = json.dumps(text_output, ensure_ascii=False)

            # Generate timestamp and filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = os.path.join(output_dir, f"raw_output_{timestamp}.txt")
            
            # Save to text file
            with open(output_filename, "w", encoding="utf-8") as f:
                f.write(text_output)
            
            print(f"[OK] Output saved to {output_filename} ({len(text_output)} characters)")
            
            # Try to count items if it looks like JSON
            item_count = 0
            try:
                data = json.loads(text_output)
                if isinstance(data, list):
                    item_count = len(data)
            except:
                pass
            
            return {
                "success": True,
                "file_path": output_filename,
                "message": f"Successfully extracted data to {output_filename}",
                "item_count": item_count,
                "data_length": len(text_output)
            }
        else:
            return {
                "success": False,
                "file_path": None,
                "message": "Could not extract text output from result",
                "item_count": 0
            }
            
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


async def extract_menu_data_async(url: str, output_dir: str = "data/raw", headless: bool = False, llm_provider: str = "auto") -> dict:
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