"""
Agent Tool Definitions
======================
Wraps existing vishva tools as LangChain tools for the agentic reasoning loop.
All original tools remain untouched — these are thin wrappers.
"""

import os
import json
from langchain_core.tools import tool
from typing import Optional

# Resolve paths relative to the vishva module directory
MODULE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(MODULE_DIR, "output")
MODELS_DIR = os.path.join(MODULE_DIR, "models")
RAW_DIR = os.path.join(MODULE_DIR, "data", "raw")


@tool
async def extract_menu(url: str) -> str:
    """Extract menu items from a restaurant website URL using browser automation.
    Use this when the user provides a URL and wants to scrape menu data from it.
    Returns a JSON string with the extraction result including file path and item count."""
    from app.modules.vishva.tools.extract_tool import extract_menu_data_async

    result = await extract_menu_data_async(url, output_dir=RAW_DIR)
    return json.dumps(result, default=str)


@tool
def clean_extracted_data(raw_file_path: str) -> str:
    """Clean and normalize raw extracted menu data into structured JSON.
    Use this after extract_menu to clean the raw output.
    Input: the raw file path returned by extract_menu.
    Returns a JSON string with the cleaning result including clean file path and item count."""
    from app.modules.vishva.tools import clean_json_data

    result = clean_json_data(input_file=raw_file_path, output_dir=OUTPUT_DIR)
    return json.dumps(result, default=str)


@tool
def train_classifier(training_file: Optional[str] = None) -> str:
    """Train ML classification models on menu data to learn category prediction.
    Tests SVM, Logistic Regression, and Naive Bayes with multiple feature extraction methods.
    If training_file is not provided, uses the default menu_data.json from previous extraction.
    Returns a JSON string with training results including best model name, accuracy, and f1 score."""
    from app.modules.vishva.tools import train_category_classifier

    if not training_file:
        training_file = os.path.join(OUTPUT_DIR, "menu_data.json")

    if not os.path.exists(training_file):
        return json.dumps({"success": False, "message": f"Training file not found: {training_file}. Run extraction and cleaning first."})

    result = train_category_classifier(
        training_file=training_file,
        output_dir=MODELS_DIR,
    )
    # Remove non-serializable objects from result before returning
    serializable = {k: v for k, v in result.items() if k not in ("model_object", "vectorizer_object", "selector_object", "scaler_object")}
    if "best_model" in serializable and isinstance(serializable["best_model"], dict):
        serializable["best_model"] = {k: v for k, v in serializable["best_model"].items() if k not in ("model_object", "vectorizer_object", "selector_object", "scaler_object")}
    return json.dumps(serializable, default=str)


@tool
def predict_category(item_name: str) -> str:
    """Predict the menu category for a single item name using the trained model.
    Use this when the user asks what category a menu item belongs to.
    Returns a JSON string with predicted category, confidence score, and probability distribution."""
    from app.modules.vishva.tools.predict_tool import load_model_components, predict_single_item

    if not os.path.exists(os.path.join(MODELS_DIR, "best_model.pkl")):
        return json.dumps({"success": False, "message": "No trained model found. Train the model first."})

    components = load_model_components(MODELS_DIR)
    result = predict_single_item({"name": item_name, "price": ""}, components)
    return json.dumps(result, default=str)


@tool
def predict_multiple_items(item_names_json: str) -> str:
    """Predict categories for multiple menu items at once.
    Input: a JSON array of item name strings, e.g. '["Chicken Kottu", "Lime Juice", "Chocolate Cake"]'
    Returns a JSON string with predictions for all items."""
    from app.modules.vishva.tools.predict_tool import load_model_components, predict_single_item

    if not os.path.exists(os.path.join(MODELS_DIR, "best_model.pkl")):
        return json.dumps({"success": False, "message": "No trained model found. Train the model first."})

    try:
        names = json.loads(item_names_json)
    except json.JSONDecodeError:
        return json.dumps({"success": False, "message": "Invalid JSON. Provide a JSON array of strings."})

    components = load_model_components(MODELS_DIR)
    predictions = []
    for name in names:
        result = predict_single_item({"name": name, "price": ""}, components)
        predictions.append(result)
    return json.dumps(predictions, default=str)


@tool
def get_model_status() -> str:
    """Check whether a trained classification model exists and return its metrics.
    Returns model name, accuracy, f1 score, categories, and training timestamp.
    Use this to understand the current state of the system before deciding next steps."""
    model_file = os.path.join(MODELS_DIR, "best_model.pkl")
    results_file = os.path.join(MODELS_DIR, "model_results.json")

    if not os.path.exists(model_file):
        return json.dumps({"model_exists": False, "message": "No trained model found."})

    info = {}
    if os.path.exists(results_file):
        with open(results_file, "r", encoding="utf-8") as f:
            info = json.load(f)

    best = info.get("best_model", {})
    return json.dumps({
        "model_exists": True,
        "model_name": best.get("model", "Unknown"),
        "vectorizer": best.get("vectorizer", "Unknown"),
        "feature_selector": best.get("feature_selector", "Unknown"),
        "accuracy": best.get("accuracy"),
        "f1_score": best.get("f1_score"),
        "categories": info.get("categories", []),
        "trained_at": info.get("timestamp"),
    })


@tool
def get_menu_data() -> str:
    """Get the current extracted and cleaned menu training data.
    Returns the list of menu items with their names, prices, and categories.
    Also returns category statistics. Use this to understand what data is available."""
    menu_file = os.path.join(OUTPUT_DIR, "menu_data.json")

    if not os.path.exists(menu_file):
        return json.dumps({"success": False, "message": "No menu data found. Run extraction first.", "items": []})

    with open(menu_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    categories = {}
    for item in data:
        cat = item.get("category", "Uncategorized")
        categories[cat] = categories.get(cat, 0) + 1

    return json.dumps({
        "success": True,
        "total_items": len(data),
        "categories": categories,
        "sample_items": data[:10],
    })


# Registry of all tools for the agent
ALL_TOOLS = [
    extract_menu,
    clean_extracted_data,
    train_classifier,
    predict_category,
    predict_multiple_items,
    get_model_status,
    get_menu_data,
]
