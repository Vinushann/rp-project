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
        current_scroll = 0
        last_height = page.evaluate("() => document.body.scrollHeight")
        print(f"[AGENT] Starting slow scroll exploration (Max Height: {last_height}px)...")
        
        for i in range(max_scrolls):
            current_scroll += scroll_step
            page.evaluate(f"() => window.scrollTo(0, {current_scroll})")
            page.wait_for_timeout(wait_ms)
            
            # Check if we've reached the actual bottom
            new_height = page.evaluate("() => document.body.scrollHeight")
            if current_scroll >= new_height:
                # Try one more scroll to be sure
                page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(wait_ms * 2)
                print(f"[AGENT] Reached page bottom at {new_height}px")
                break
                
            if (i + 1) % 5 == 0:
                print(f"[AGENT] Scroll progress: {current_scroll}px / {new_height}px...")
                
        # Final pause at the bottom to let everything settle
        print("[AGENT] Settlement pause (3s)...")
        page.wait_for_timeout(3000)
        
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
        print(f"[AGENT] Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)
        
        try:
            print("[AGENT] Waiting for network to be idle (up to 30s)...")
            page.wait_for_load_state("networkidle", timeout=30000)
        except Exception:
            pass
            
        _scroll_page(page)
        
        # AGENTIC EXPLORATION PHASE
        print("[AGENT] Starting Agentic Exploration Loop...")
        try:
            # We need to run the async exploration loop in this sync context
            from playwright.async_api import async_playwright
            import asyncio
            
            async def _run_exploration():
                # Note: We can't easily share the sync page with async loop
                # So we just do a quick discovery and return links
                from .browser_tools import get_category_links
                # Bridging sync page to async is hard, so we'll do it manually here
                # or just use the sync version of discovery
                pass
            
            # Simple sync discovery for now
            category_links = page.evaluate('''() => {
                const results = [];
                const seen = new Set();
                const catRegex = /category|menu|section|product|type|kind|shop|catalogue/i;
                document.querySelectorAll('a').forEach(a => {
                    const href = a.href;
                    const text = a.innerText.trim();
                    if (href && text && !seen.has(href) && href.startsWith(window.location.origin) && href !== window.location.href) {
                        const isNav = a.closest('nav') || a.closest('.sidebar') || a.closest('.menu-container');
                        if (isNav || catRegex.test(href) || catRegex.test(text)) {
                            results.push({ href, text });
                            seen.add(href);
                        }
                    }
                });
                return results;
            }''')
            
            print(f"[AGENT] Discovered {len(category_links)} potential category sections.")
            
        except Exception as e:
            print(f"[WARNING] Exploration setup failed: {e}")
            category_links = []

        print("[AGENT] Final stabilization wait (5s)...")
        page.wait_for_timeout(5000)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # COLLECTION PHASE - ALL DISCOVERED PAGES
        all_raw_items = []
        all_body_text = ""
        urls_to_visit = [url] + [link['href'] for link in category_links[:12]] # Limit to top 12
        visited_urls = set()
        
        for page_idx, visit_url in enumerate(urls_to_visit):
            if visit_url in visited_urls: continue
            visited_urls.add(visit_url)
            
            print(f"\n[AGENT] Visiting Page {page_idx+1}: {visit_url}")
            try:
                page.goto(visit_url, wait_until="load", timeout=30000)
                page.wait_for_timeout(2000)
                _scroll_page(page, max_scrolls=10) # Quick scroll for subpages
                
                # Accumulate text for verification
                all_body_text += "\n" + page.evaluate("document.body.innerText")
            except Exception as e:
                print(f"[WARNING] Could not visit {visit_url}: {e}")
                continue

            # SEGMENTED COMPUTER VISION EXTRACTION
            print(f"[AGENT] Starting Segmented Vision Extraction for {visit_url}...")
            
            # We scroll and capture in chunks
            SEGMENT_HEIGHT = 1200
            page_height = page.evaluate("document.body.scrollHeight")
            
            for start_y in range(0, page_height, SEGMENT_HEIGHT):
                print(f"   -> Analyzing Segment at Y={start_y}...")
                page.evaluate(f"window.scrollTo(0, {start_y})")
                page.wait_for_timeout(800)
                
                segment_shot = os.path.join(output_dir, f"segment_{timestamp}_p{page_idx}_y{start_y}.png")
                page.screenshot(path=segment_shot)
                
                segment_layout = page.evaluate(f'''() => {{
                    const layout = [];
                    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, li, td, .menu-item, .price');
                    elements.forEach(el => {{
                        const rect = el.getBoundingClientRect();
                        const text = el.innerText.trim();
                        if (text && rect.width > 0 && rect.height > 0 && rect.y >= 0 && rect.y < {SEGMENT_HEIGHT} && text.length < 300) {{
                            layout.push({{ text, x: Math.round(rect.x), y: Math.round(rect.y), tag: el.tagName }});
                        }}
                    }});
                    return layout;
                }}''')
                
                chunk_layout_text = "\n".join([f"[{item['tag']} at {item['x']},{item['y']}] {item['text']}" for item in segment_layout])
                chunk_input = f"VISUAL SEGMENT:\n{chunk_layout_text}"
                
                chunk_data = _extract_segment_with_llm(chunk_input, segment_shot)
                if chunk_data:
                    all_raw_items.extend(chunk_data)
                    print(f"      Extracted {len(chunk_data)} items.")

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
            "EXTRACT MENU ITEMS FROM THIS VISUAL SEGMENT:\n"
            "Analyze the coordinates and text below to extract every menu item in this specific section.\n"
            "Return ONLY a JSON array of objects with fields: name, price, description, category.\n"
            "Rules:\n"
            "- Be very thorough. Extract all items in this segment.\n"
            "- The coordinates [TAG at X,Y] show the spatial layout.\n"
            "- Return valid JSON array only. If no items found, return [].\n\n"
            f"{chunk_input}"
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