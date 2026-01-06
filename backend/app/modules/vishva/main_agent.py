from dotenv import load_dotenv
from tools import extract_menu_data, clean_json_data
import os
from datetime import datetime

load_dotenv()

def run_menu_extraction_pipeline(url: str):
    """
    Agentic pipeline to extract and clean menu data.
    
    Steps:
    1. Extract raw data using browser agent
    2. Clean and format the data to JSON
    """
    
    print("=" * 60)
    print("🚀 MENU EXTRACTION PIPELINE")
    print("=" * 60)
    print(f"🎯 Target URL: {url}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Step 1: Extract data
    print("\n📥 STEP 1: EXTRACTING DATA")
    print("-" * 60)
    
    extraction_result = extract_menu_data(url, output_dir="data/raw")
    
    if not extraction_result["success"]:
        print(f"\n❌ PIPELINE FAILED at extraction step")
        print(f"   Error: {extraction_result['message']}")
        return {
            "success": False,
            "step_failed": "extraction",
            "error": extraction_result['message']
        }
    
    print(f"\n✅ Extraction completed successfully")
    print(f"   📁 Raw file: {extraction_result['file_path']}")
    print(f"   📊 Data size: {extraction_result['data_length']} characters")
    if extraction_result['item_count'] > 0:
        print(f"   📋 Detected items: {extraction_result['item_count']}")
    
    # Step 2: Clean data
    print("\n🧹 STEP 2: CLEANING DATA")
    print("-" * 60)
    
    cleaning_result = clean_json_data(
        input_file=extraction_result['file_path'],
        output_dir="output"
    )
    
    if not cleaning_result["success"]:
        print(f"\n❌ PIPELINE FAILED at cleaning step")
        print(f"   Error: {cleaning_result['message']}")
        return {
            "success": False,
            "step_failed": "cleaning",
            "error": cleaning_result['message'],
            "raw_file": extraction_result['file_path']
        }
    
    print(f"\n✅ Cleaning completed successfully")
    print(f"   📁 Clean file: {cleaning_result['file_path']}")
    print(f"   📁 Main file: {cleaning_result['main_file']}")
    print(f"   📋 Total items: {cleaning_result['item_count']}")
    print(f"   🔧 Parse method: {cleaning_result['parse_method']}")
    
    # Final summary
    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 60)
    print(f"📥 Raw extraction: {extraction_result['file_path']}")
    print(f"📤 Clean output: {cleaning_result['main_file']}")
    print(f"📊 Items extracted: {cleaning_result['item_count']}")
    print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    return {
        "success": True,
        "raw_file": extraction_result['file_path'],
        "clean_file": cleaning_result['file_path'],
        "main_file": cleaning_result['main_file'],
        "item_count": cleaning_result['item_count'],
        "parse_method": cleaning_result['parse_method']
    }

if __name__ == "__main__":
    # Run the pipeline
    result = run_menu_extraction_pipeline("https://streetburger.lk/our-menu/")
    
    # Exit with appropriate code
    exit(0 if result["success"] else 1)