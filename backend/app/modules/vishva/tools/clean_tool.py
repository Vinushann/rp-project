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
    
    print(f"🔧 Starting JSON cleaner...")
    print(f"📖 Reading file: {input_file}")
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
    
    print(f"✅ File loaded ({len(content)} characters)")
    
    # Step 1: Unescape the content if it contains literal \n
    if r'\n' in content:
        print("ℹ️  Detected escaped newlines, unescaping...")
        # Replace literal \n with actual newlines
        content = content.replace(r'\n', '\n')
        # Also handle other common escape sequences
        content = content.replace(r'\"', '"')
        content = content.replace(r'\/', '/')
        content = content.replace(r'\t', '\t')
    
    # Step 2: Try to parse as JSON directly
    data = None
    parse_method = None
    
    try:
        data = json.loads(content)
        parse_method = "direct"
        print("✅ File is already valid JSON")
    except json.JSONDecodeError as e:
        print(f"⚠️  Direct parsing failed: {str(e)[:100]}")
    
    # Step 3: Try to extract JSON from markdown code blocks
    if not data:
        print("ℹ️  Trying markdown extraction...")
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
        if json_match:
            try:
                extracted = json_match.group(1)
                data = json.loads(extracted)
                parse_method = "markdown"
                print("✅ Extracted JSON from markdown code block")
            except json.JSONDecodeError as e:
                print(f"⚠️  Markdown extraction failed: {str(e)[:100]}")
    
    # Step 4: Try to find JSON array anywhere in the text
    if not data:
        print("ℹ️  Trying array extraction...")
        json_array_match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', content, re.DOTALL)
        if json_array_match:
            try:
                extracted = json_array_match.group(0)
                data = json.loads(extracted)
                parse_method = "array_extraction"
                print("✅ Extracted JSON array from text")
            except json.JSONDecodeError as e:
                print(f"⚠️  Array extraction failed: {str(e)[:100]}")
    
    # Step 5: Try to clean common JSON formatting issues
    if not data:
        print("ℹ️  Attempting to fix common JSON issues...")
        
        cleaned_content = content
        
        # Remove any text before the first [
        first_bracket = cleaned_content.find('[')
        if first_bracket != -1:
            cleaned_content = cleaned_content[first_bracket:]
        
        # Remove any text after the last ]
        last_bracket = cleaned_content.rfind(']')
        if last_bracket != -1:
            cleaned_content = cleaned_content[:last_bracket + 1]
        
        # Remove any leading/trailing whitespace
        cleaned_content = cleaned_content.strip()
        
        try:
            data = json.loads(cleaned_content)
            parse_method = "cleaned"
            print("✅ JSON parsed after cleaning")
        except json.JSONDecodeError as e:
            print(f"❌ All parsing attempts failed: {str(e)[:100]}")
            
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
                "file_path": debug_file,
                "message": f"Failed to parse JSON: {str(e)[:100]}",
                "item_count": 0
            }
    
    # Step 6: Validate and clean the parsed data
    if isinstance(data, list):
        print(f"ℹ️  Validating {len(data)} items...")
        
        # Remove any null or invalid items
        original_count = len(data)
        data = [item for item in data if item and isinstance(item, dict)]
        
        if len(data) < original_count:
            print(f"⚠️  Removed {original_count - len(data)} invalid items")
        
        # Clean up each item
        for item in data:
            # Ensure all required fields exist
            if 'name' not in item:
                item['name'] = ''
            if 'price' not in item:
                item['price'] = ''
            if 'description' not in item:
                item['description'] = ''
            if 'category' not in item:
                item['category'] = ''
            
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
    
    print(f"\n✅ Clean JSON saved to: {output_filename}")
    print(f"✅ Main file saved to: {main_filename}")
    print(f"📊 Total items: {item_count}")
    print(f"🔧 Parse method: {parse_method}")
    
    # Display sample items
    if isinstance(data, list) and len(data) > 0:
        print(f"\n📋 Sample items (first 3):")
        for item in data[:3]:
            name = item.get('name', 'N/A')
            price = item.get('price', 'N/A')
            category = item.get('category', 'N/A')
            print(f"   • {name} - {price} ({category})")
    
    return {
        "success": True,
        "file_path": output_filename,
        "main_file": main_filename,
        "message": f"Successfully cleaned and saved {item_count} items",
        "item_count": item_count,
        "parse_method": parse_method
    }