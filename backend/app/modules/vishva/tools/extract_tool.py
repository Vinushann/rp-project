from dotenv import load_dotenv
from browser_use import Agent, ChatBrowserUse
import json
from datetime import datetime
import os

# Load .env from both the backend root and the module directory
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
load_dotenv(os.path.join(backend_dir, '.env'))

# Also try module-level .env as fallback
module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(module_dir, '.env'))


def extract_menu_data(url: str, output_dir: str = "data/raw") -> dict:
    """
    Tool to extract menu data from a website.
    
    Args:
        url: The URL to scrape
        output_dir: Directory to save raw output
        
    Returns:
        dict with keys: success, file_path, message, item_count
    """
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print("[BOT] Starting extraction agent...")
    print(f"[URL] Target: {url}")
    print("-" * 50)
    
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
        llm=ChatBrowserUse(),
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