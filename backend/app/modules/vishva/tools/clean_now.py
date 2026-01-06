import json
import re
from datetime import datetime
import os

def clean_escaped_json(input_file="output.txt", output_file="menu_data.json"):
    """Quick script to clean escaped JSON output"""
    
    print("🔧 Cleaning escaped JSON...")
    print(f"📖 Reading: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"✅ Loaded {len(content)} characters")
    
    # Unescape the content
    if r'\n' in content:
        print("ℹ️  Unescaping newlines...")
        content = content.replace(r'\n', '\n')
        content = content.replace(r'\"', '"')
        content = content.replace(r'\/', '/')
    
    # Try to parse
    try:
        data = json.loads(content)
        print("✅ Parsed successfully")
    except json.JSONDecodeError:
        # Try to extract just the array
        match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', content, re.DOTALL)
        if match:
            content = match.group(0)
            data = json.loads(content)
            print("✅ Extracted and parsed array")
        else:
            raise
    
    # Clean the data
    if isinstance(data, list):
        for item in data:
            for key in item:
                if isinstance(item[key], str):
                    item[key] = item[key].strip()
    
    # Save
    os.makedirs("output", exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Saved to: {output_file}")
    print(f"📊 Total items: {len(data)}")
    
    # Show samples
    print("\n📋 Sample items:")
    for item in data[:3]:
        print(f"   • {item['name']} - {item['price']} ({item['category']})")
    
    return data

if __name__ == "__main__":
    clean_escaped_json()