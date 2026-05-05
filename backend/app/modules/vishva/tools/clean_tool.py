import json
import re
from datetime import datetime
import os

def clean_json_data(input_file: str, output_dir: str = "output") -> dict:
    """
    Tool to clean and parse JSON from raw extraction output.
    
    Args:
        input_file: Path to the raw output file
        output_dir: Directory to save cleaned JSON
        
    Returns:
        dict with keys: success, file_path, message, item_count
    """
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Starting JSON cleaner...")
    print(f"Reading file: {input_file}")
    print("-" * 50)
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        return {
            "success": False,
            "file_path": None,
            "message": f"File not found: {input_file}",
            "item_count": 0
        }
    
    print(f"File loaded ({len(content)} characters)")
    
    # Step 1: Normalize mixed quote escaping issues
    if r'\"' in content:
        print("    Detected escaped quotes, normalizing...")
        # Handle double-escaped quotes first: \\\"
        content = content.replace('\\\\\\"', '<<TRIPLE_QUOTE>>')
        content = content.replace('\\"', '"')
        content = content.replace('<<TRIPLE_QUOTE>>', '"')
    
    # Handle escaped newlines and other sequences
    if r'\n' in content:
        print("    Detected escaped newlines, unescaping...")
        content = content.replace(r'\n', '\n')
        content = content.replace(r'\/', '/')
        content = content.replace(r'\t', '\t')

    # Step 2: Advanced JSON repair logic
    def repair_json_content(text):
        """Robust cleaning for common LLM JSON errors."""
        
        # A) Fix unescaped quotes inside JSON string values
        # This matches "key": "value with "quotes" inside"
        # It's better than the line-by-line version as it handles minified JSON
        def quote_fixer(match):
            prefix = match.group(1)
            value = match.group(2)
            suffix = match.group(3)
            # Remove quotes from the value itself
            clean_value = value.replace('"', '')
            return prefix + clean_value + suffix
            
        # Match "key": "value" pattern globally
        text = re.sub(r'("[^"]+"\s*:\s*")(.*?)("\s*[,}\]])', quote_fixer, text, flags=re.DOTALL)
        
        # B) Remove trailing commas in arrays/objects
        text = re.sub(r',\s*([\]}])', r'\1', text)
        
        # C) Fix truncated JSON (CRITICAL for long extractions)
        if text.strip().startswith('['):
            # If it ends abruptly, try to close it
            text = text.strip()
            if not text.endswith(']'):
                print("    Detected truncated JSON array, attempting to repair...")
                # Find the last complete object "}"
                last_brace = text.rfind('}')
                if last_brace != -1:
                    # Keep everything up to the last complete object and close the array
                    text = text[:last_brace + 1] + "\n]"
                    print(f"    Repaired JSON by closing at last complete item.")
        
        return text

    content = repair_json_content(content)

    # Step 3: Try to parse as JSON directly
    data = None
    parse_method = None
    
    try:
        data = json.loads(content)
        parse_method = "direct"
        print("File is already valid JSON")
    except json.JSONDecodeError as e:
        print(f"    Direct parsing failed: {str(e)[:100]}")
    
    # Step 4: Try to extract JSON from markdown code blocks
    if not data:
        print("    Trying markdown extraction...")
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
        if not json_match:
            json_match = re.search(r'```\s*([\s\S]*?)\s*```', content)
            
        if json_match:
            try:
                extracted = repair_json_content(json_match.group(1))
                data = json.loads(extracted)
                parse_method = "markdown"
                print("Extracted JSON from markdown code block")
            except json.JSONDecodeError as e:
                print(f"    Markdown extraction failed: {str(e)[:100]}")
    
    # Step 5: Try to find JSON array anywhere in the text
    if not data:
        print("    Trying array extraction...")
        # Use DOTALL to match across lines
        json_array_match = re.search(r'\[\s*\{.*\}\s*\]', content, re.DOTALL)
        if not json_array_match:
            # If truncated, it might not have the closing ]
            json_array_match = re.search(r'\[\s*\{.*', content, re.DOTALL)
            
        if json_array_match:
            try:
                extracted = repair_json_content(json_array_match.group(0))
                data = json.loads(extracted)
                parse_method = "array_extraction"
                print("Extracted JSON array from text")
            except json.JSONDecodeError as e:
                print(f"    Array extraction failed: {str(e)[:100]}")
    
    # Step 6: Last resort - extremely aggressive cleaning
    if not data:
        print("    Attempting last-resort cleaning...")
        
        # Find first [ and last ]
        first_bracket = content.find('[')
        last_bracket = content.rfind(']')
        
        if first_bracket != -1:
            if last_bracket > first_bracket:
                cleaned_content = content[first_bracket:last_bracket + 1]
            else:
                # Truncated but starts with [
                cleaned_content = content[first_bracket:]
                last_brace = cleaned_content.rfind('}')
                if last_brace != -1:
                    cleaned_content = cleaned_content[:last_brace + 1] + "]"
            
            try:
                data = json.loads(cleaned_content)
                parse_method = "last_resort"
                print("JSON parsed after aggressive cleaning")
            except json.JSONDecodeError as e:
                print(f"  All parsing attempts failed: {str(e)[:100]}")
            
            # Save debug file with both original and cleaned content
            debug_file = os.path.join(output_dir, "debug_failed_parse.txt")
            with open(debug_file, "w", encoding="utf-8") as f:
                f.write(f"Parse attempt failed at {datetime.now()}\n")
                f.write(f"Error: {str(e)}\n")
                f.write(f"\n{'='*60}\n")
                f.write(f"ORIGINAL CONTENT (first 2000 chars):\n")
                f.write(f"{'='*60}\n")
                f.write(content[:2000])
                f.write(f"\n\n{'='*60}\n")
                f.write(f"CLEANED CONTENT (first 2000 chars):\n")
                f.write(f"{'='*60}\n")
                f.write(cleaned_content[:2000])
            
            return {
                "success": False,
                "file_path": input_file,
                "debug_file": debug_file,
                "message": f"Failed to parse JSON: {str(e)[:100]}",
                "item_count": 0
            }
    
    # Step 6: Validate and clean the parsed data
    if isinstance(data, list):
        print(f"    Validating {len(data)} items...")
        
        # Remove any null or invalid items
        original_count = len(data)
        data = [item for item in data if item and isinstance(item, dict)]
        
        if len(data) < original_count:
            print(f"    Removed {original_count - len(data)} invalid items")
        
        # Clean up each item
        for item in data:
            # Ensure all required fields exist (name, price, category only - no description needed for POS)
            if 'name' not in item:
                item['name'] = ''
            if 'price' not in item:
                item['price'] = ''
            if 'category' not in item:
                item['category'] = ''
            # Ensure description exists
            if 'description' not in item:
                item['description'] = ''
            
            # Clean up whitespace in all fields
            for key in item:
                if isinstance(item[key], str):
                    item[key] = item[key].strip()
    
    # Step 7: Save cleaned JSON
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = os.path.join(output_dir, f"menu_data_{timestamp}.json")
    
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Also save as main file
    main_filename = os.path.join(output_dir, "menu_data.json")
    with open(main_filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    item_count = len(data) if isinstance(data, list) else 1
    
    print(f"\nClean JSON saved to: {output_filename}")
    print(f"Main file saved to: {main_filename}")
    print(f"Total items: {item_count}")
    print(f"Parse method: {parse_method}")
    
    if isinstance(data, list) and len(data) > 0:
        print(f"\nSample items (first 3):")
        for item in data[:3]:
            name = item.get('name', 'N/A')
            price = item.get('price', 'N/A')
            category = item.get('category', 'N/A')
            print(f"     {name} - {price} ({category})")
    
    return {
        "success": True,
        "file_path": output_filename,
        "main_file": main_filename,
        "message": f"Successfully cleaned and saved {item_count} items",
        "item_count": item_count,
        "parse_method": parse_method
    }