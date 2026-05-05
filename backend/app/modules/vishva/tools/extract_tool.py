from dotenv import load_dotenv
import asyncio
import json
from datetime import datetime
import os
import re
import sys
import time

try:
    from ollama import Client as OllamaClient
except Exception:
    OllamaClient = None

from .exploration import run_exploration_loop

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


def _scroll_page(page, max_scrolls: int = 40, scroll_step: int = 800, wait_ms: int = 1200) -> None:
    """
    Slowly scroll down the page in increments to ensure lazy-loaded content 
    and dynamic elements are properly triggered and captured.
    """
    try:
        last_height = page.evaluate("() => document.body.scrollHeight")
        print(f"[AGENT] Starting slow scroll exploration (Max Height: {last_height}px)...")
        
        for i in range(max_scrolls):
            current_y = page.evaluate("window.scrollY")
            target_y = (i + 1) * scroll_step
            
            page.evaluate(f"window.scrollTo(0, {target_y})")
            page.wait_for_timeout(wait_ms)
            
            # Check if we are actually moving
            new_y = page.evaluate("window.scrollY")
            new_height = page.evaluate("document.body.scrollHeight")
            
            if new_y == current_y and target_y < new_height:
                # We might be stuck, try scrolling to a specific element
                print(f"   [!] Scroll stuck at {new_y}px, attempting force scroll...")
                page.evaluate("window.scrollBy(0, 100)")
            
            if new_y >= new_height - 100:
                print(f"[AGENT] Reached page bottom at {new_height}px")
                break
                
            if (i + 1) % 10 == 0:
                print(f"[AGENT] Scroll progress: {new_y}px / {new_height}px...")
                
        # Final return to top if this was a discovery scroll
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1000)
        
    except Exception as e:
        print(f"[WARNING] Scroll error: {e}")

def _capture_screenshot(page, output_dir: str, timestamp: str) -> str:
    """Capture a full-page screenshot for visual context."""
    try:
        screenshot_path = os.path.join(output_dir, f"screenshot_{timestamp}.png")
        print(f"[AGENT] Capturing full-page screenshot: {screenshot_path}")
        page.screenshot(path=screenshot_path, full_page=True)
        return screenshot_path
    except Exception as e:
        print(f"[WARNING] Screenshot failed: {e}")
        return None


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
            "description": _clean_field(item.get("description")),
            "category": _clean_field(item.get("category")),
        })
    return filtered, dropped


def _extract_with_local_llm(url: str, output_dir: str, headless: bool) -> dict:
    if sync_playwright is None:
        return {"success": False, "message": "Playwright not available", "item_count": 0}
    if OllamaClient is None:
        return {"success": False, "message": "Ollama client not available", "item_count": 0}

    headless = False  # Keep visible for monitoring

    with sync_playwright() as p:
        print("[AGENT] Launching browser...")
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        # 1. INITIAL LOAD & SCROLL
        print(f"[AGENT] Navigating to {url}...")
        try:
            page.goto(url, wait_until="load", timeout=60000)
            page.wait_for_load_state("networkidle", timeout=30000)
        except Exception:
            print("[AGENT] Load state timed out, proceeding anyway...")
            
        # Robust full scroll to trigger all dynamic content and collect text
        print("[AGENT] Initial full scroll for discovery and text collection...")
        _scroll_page(page, max_scrolls=50, scroll_step=800, wait_ms=1000)
        
        # 2. DISCOVERY PHASE (AT THE TOP)
        print("[AGENT] Returning to top for navigation discovery...")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(2000)
        
        # Use keywords and layout to find category/menu links
        category_links = page.evaluate('''() => {
            const results = [];
            const seen = new Set();
            const currentOrigin = window.location.origin;
            const catRegex = /category|menu|section|product|type|kind|shop|catalogue|item|list|food|drink|lunch|dinner|breakfast/i;
            const blockRegex = /about|story|contact|history|location|privacy|terms|cart|account|login|signup|news|blog|event|career|job|help|faq|policy/i;
            
            document.querySelectorAll('a').forEach(a => {
                const href = a.href;
                const text = a.innerText.trim();
                
                if (href && text && !seen.has(href) && href.startsWith(currentOrigin) && href !== window.location.href) {
                    const isNav = a.closest('nav') || a.closest('.nav') || a.closest('.navigation') || a.closest('.sidebar') || a.closest('.menu-container') || a.closest('header');
                    const hasKeyword = catRegex.test(href) || catRegex.test(text);
                    const isBlocked = blockRegex.test(href) || blockRegex.test(text);
                    
                    if (!isBlocked && (isNav || hasKeyword) && text.length < 50) {
                        results.push({ href, text });
                        seen.add(href);
                    }
                }
            });
            return results;
        }''')
        
        print(f"[AGENT] Discovered {len(category_links)} potential category sections.")
        
        # 3. EXTRACTION PHASE - ALL RELEVANT PAGES
        all_raw_items = []
        all_body_text = page.evaluate("document.body.innerText")
        urls_to_visit = [url] + [link['href'] for link in category_links[:15]] # Up to 15 pages
        visited_urls = {url}
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        for page_idx, visit_url in enumerate(urls_to_visit):
            if page_idx > 0: # Already did first page scroll
                if visit_url in visited_urls: continue
                visited_urls.add(visit_url)
                
                print(f"\n[AGENT] Visiting Section {page_idx+1}: {visit_url}")
                try:
                    page.goto(visit_url, wait_until="load", timeout=30000)
                    page.wait_for_load_state("networkidle", timeout=10000)
                    page.wait_for_timeout(2000)
                    _scroll_page(page, max_scrolls=15) # Shorter scroll for subpages
                    all_body_text += "\n" + page.evaluate("document.body.innerText")
                except Exception as e:
                    print(f"[WARNING] Could not visit {visit_url}: {e}")
                    continue

            # TEXT-BASED EXTRACTION FOR THIS PAGE
            print(f"[AGENT] Extracting menu items from text for {visit_url}...")
            
            # Get the page text and layout summary
            page_text = page.evaluate("document.body.innerText")
            
            # Clean text to remove huge chunks of non-menu noise
            # (e.g. footers, headers, social media blocks)
            # We'll take a large chunk but LLMs have limits
            truncated_text = _trim_text_for_llm(page_text, max_chars=15000)
            
            prompt = (
                "### TASK: EXTRACT MENU ITEMS FROM TEXT\n"
                "Analyze the following text from a restaurant website and extract all menu items (dishes, drinks, etc.).\n\n"
                "### WEBSITE CONTENT:\n"
                f"{truncated_text}\n\n"
                "### RULES:\n"
                "1. Extract the name, price, description, and category for each item.\n"
                "2. If an item doesn't have a price or description, use an empty string.\n"
                "3. Return ONLY a valid JSON array of objects.\n"
                "4. If no items are found, return exactly: []\n\n"
                "### OUTPUT FORMAT (JSON ONLY):"
            )
            
            try:
                model_name = os.getenv('VISHVA_OLLAMA_MODEL', 'qwen2.5:7b')
                host = os.getenv('OLLAMA_URL', 'http://localhost:11434')
                client = OllamaClient(host=host)
                
                response = client.chat(model=model_name, messages=[{'role': 'user', 'content': prompt}])
                content = response.get("message", {}).get("content", "")
                
                chunk_data = _extract_json_array(content)
                if chunk_data:
                    all_raw_items.extend(chunk_data)
                    print(f"      Found {len(chunk_data)} items on this page.")
            except Exception as e:
                print(f"      [WARNING] Text extraction failed for {visit_url}: {e}")

        print(f"[AGENT] Total items found across all sections: {len(all_raw_items)}")
        
        # Consolidate and deduplicate
        final_data = []
        seen_names = set()
        for item in all_raw_items:
            name = str(item.get('name', '')).strip().lower()
            if name and name not in seen_names:
                final_data.append(item)
                seen_names.add(name)

        output_filename = os.path.join(output_dir, f"raw_output_{timestamp}.txt")
        
        # Final verification against full content
        print(f"[AGENT] Verifying {len(final_data)} items against all collected page text...")
        filtered, dropped = _filter_items(final_data, all_body_text)
        
        normalized = json.dumps(filtered, ensure_ascii=False, indent=2)
        with open(output_filename, "w", encoding="utf-8") as f:
            f.write(normalized)

        print("[AGENT] Browser task complete, closing browser.")
        browser.close()

        return {
            "success": True,
            "file_path": output_filename,
            "message": f"Successfully extracted {len(filtered)} items using Computer Vision",
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


def _extract_segment_with_llm(chunk_input: str, screenshot_path: str = None) -> list:
    """Helper to extract a single visual segment."""
    try:
        model_name = os.getenv('VISHVA_OLLAMA_MODEL', 'minicpm-v')
        host = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        client = OllamaClient(host=host)

        prompt = (
            "### TASK: EXTRACT MENU ITEMS FROM VISUAL SEGMENT\n"
            "You are an expert menu data extractor. Analyze the provided text layout and screenshot to find menu items.\n\n"
            "### CONTEXT:\n"
            f"Segment Y-offset: {chunk_input.split('(Y=')[1].split('):')[0] if '(Y=' in chunk_input else '0'}px\n"
            "Text Layout (Tag at X,Y coordinates):\n"
            f"{chunk_input}\n\n"
            "### RULES:\n"
            "1. ONLY extract items that are CLEARLY VISUALIZED in the text layout or screenshot.\n"
            "2. Each item MUST have a 'name'. If 'price' or 'description' is missing, leave as empty string.\n"
            "3. DO NOT HALLUCINATE or make up items that are not there.\n"
            "4. DO NOT include navigation elements, footers, or headers as menu items.\n"
            "5. Return a JSON array of objects with fields: name, price, description, category.\n"
            "6. If no items are found, return exactly: []\n\n"
            "### OUTPUT FORMAT (JSON ONLY):"
        )

        messages = [{'role': 'user', 'content': prompt}]
        # Attachment for vision support
        if screenshot_path and os.path.exists(screenshot_path):
            messages[0]['images'] = [screenshot_path]

        response = client.chat(model=model_name, messages=messages)
        content = response.get("message", {}).get("content", "")
        
        return _extract_json_array(content)
    except Exception as e:
        print(f"   -> Error in segment extraction: {e}")
        return []


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