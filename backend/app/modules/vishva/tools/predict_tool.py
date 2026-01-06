import json
import numpy as np
import joblib
import os
from typing import List, Dict, Union
from datetime import datetime
import re

# Text preprocessing
try:
    from nltk.corpus import stopwords
    STOP_WORDS = set(stopwords.words('english'))
except:
    STOP_WORDS = set()


def preprocess_text(text: str) -> str:
    """Preprocess text same way as training"""
    if not text or not isinstance(text, str):
        return ""
    
    # Lowercase
    text = text.lower()
    
    # Remove special characters but keep spaces
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    
    # Remove extra spaces
    text = ' '.join(text.split())
    
    # Remove stopwords
    if STOP_WORDS:
        words = text.split()
        text = ' '.join([w for w in words if w not in STOP_WORDS])
    
    return text


def load_model_components(model_dir: str = "models"):
    """Load trained model, vectorizer, and other components"""
    
    model_file = os.path.join(model_dir, "best_model.pkl")
    vectorizer_file = os.path.join(model_dir, "vectorizer.pkl")
    selector_file = os.path.join(model_dir, "selector.pkl")
    scaler_file = os.path.join(model_dir, "scaler.pkl")
    results_file = os.path.join(model_dir, "model_results.json")
    
    # Check if model exists
    if not os.path.exists(model_file):
        raise FileNotFoundError(f"Model not found: {model_file}. Please train the model first using train_model.py")
    
    # Load model
    model = joblib.load(model_file)
    
    # Load vectorizer
    vectorizer = joblib.load(vectorizer_file)
    
    # Load selector (if exists)
    selector = None
    if os.path.exists(selector_file):
        selector = joblib.load(selector_file)
    
    # Load scaler (if exists)
    scaler = None
    if os.path.exists(scaler_file):
        scaler = joblib.load(scaler_file)
    
    # Load model info
    model_info = {}
    if os.path.exists(results_file):
        with open(results_file, 'r', encoding='utf-8') as f:
            model_info = json.load(f)
    
    return {
        'model': model,
        'vectorizer': vectorizer,
        'selector': selector,
        'scaler': scaler,
        'info': model_info
    }


def predict_single_item(item: Dict, components: Dict) -> Dict:
    """Predict category for a single menu item"""
    
    # Extract text - use only name for prediction (same as training, no description needed for POS)
    name = (item.get('name') or '').strip()
    price = (item.get('price') or '').strip()
    
    if not name:
        return {
            'name': name,
            'price': price,
            'predicted_category': 'Unknown',
            'confidence': 0.0,
            'error': 'Item name is required'
        }
    
    # Use only name for prediction (same as training)
    preprocessed = preprocess_text(name)
    
    if not preprocessed:
        return {
            'name': name,
            'price': price,
            'predicted_category': 'Unknown',
            'confidence': 0.0,
            'error': 'No valid text after preprocessing'
        }
    
    # Vectorize
    X = components['vectorizer'].transform([preprocessed])
    
    # Apply feature selection if exists
    if components['selector']:
        X = components['selector'].transform(X)
    
    # Apply scaling if exists (for MultinomialNB)
    if components['scaler']:
        if hasattr(X, 'toarray'):
            X = X.toarray()
        X = components['scaler'].transform(X)
    
    # Predict
    prediction = components['model'].predict(X)[0]
    
    # Get confidence (probability)
    if hasattr(components['model'], 'predict_proba'):
        probabilities = components['model'].predict_proba(X)[0]
        confidence = float(max(probabilities))
        
        # Get all category probabilities
        classes = components['model'].classes_
        all_probs = {cls: float(prob) for cls, prob in zip(classes, probabilities)}
    else:
        confidence = 1.0
        all_probs = {prediction: 1.0}
    
    return {
        'name': name,
        'price': price,
        'predicted_category': prediction,
        'confidence': confidence,
        'all_probabilities': all_probs
    }


def predict_categories(
    items: Union[List[Dict], str], 
    model_dir: str = "models",
    output_file: str = None
) -> Dict:
    """
    Predict categories for a list of menu items or a JSON file.
    
    Args:
        items: List of item dictionaries OR path to JSON file
        model_dir: Directory containing trained model
        output_file: Optional path to save predictions
        
    Returns:
        dict with predictions and statistics
    """
    
    print("🔮 MENU CATEGORY PREDICTION")
    print("="*70)
    
    try:
        # Load model components
        print(f"📦 Loading model from: {model_dir}")
        components = load_model_components(model_dir)
        
        model_info = components['info'].get('best_model', {})
        print(f"✅ Model loaded:")
        print(f"   Model: {model_info.get('model', 'Unknown')}")
        print(f"   Vectorizer: {model_info.get('vectorizer', 'Unknown')}")
        print(f"   Feature Selector: {model_info.get('feature_selector', 'Unknown')}")
        print(f"   Accuracy: {model_info.get('accuracy', 0):.2%}")
        
        # Load items
        if isinstance(items, str):
            print(f"\n📖 Loading items from: {items}")
            with open(items, 'r', encoding='utf-8') as f:
                items = json.load(f)
        
        if not isinstance(items, list):
            raise ValueError("Items must be a list of dictionaries")
        
        print(f"✅ Loaded {len(items)} items to categorize")
        
        # Predict categories
        print(f"\n🔍 Predicting categories...")
        print("-"*70)
        
        predictions = []
        category_counts = {}
        
        for i, item in enumerate(items, 1):
            prediction = predict_single_item(item, components)
            predictions.append(prediction)
            
            # Count categories
            category = prediction['predicted_category']
            category_counts[category] = category_counts.get(category, 0) + 1
            
            # Print progress
            if i % 10 == 0 or i == len(items):
                print(f"   Processed {i}/{len(items)} items...")
        
        print("✅ Predictions complete")
        
        # Calculate statistics
        avg_confidence = np.mean([p['confidence'] for p in predictions])
        low_confidence = [p for p in predictions if p['confidence'] < 0.5]
        
        # Print summary
        print(f"\n{'='*70}")
        print("📊 PREDICTION SUMMARY")
        print(f"{'='*70}")
        print(f"   Total items: {len(predictions)}")
        print(f"   Average confidence: {avg_confidence:.2%}")
        print(f"   Low confidence items: {len(low_confidence)}")
        print(f"\n📋 Category Distribution:")
        for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(predictions)) * 100
            print(f"   • {category}: {count} items ({percentage:.1f}%)")
        
        # Show sample predictions
        print(f"\n📝 Sample Predictions (first 5):")
        print("-"*70)
        for pred in predictions[:5]:
            print(f"   • {pred['name']}")
            print(f"     Category: {pred['predicted_category']} (Confidence: {pred['confidence']:.2%})")
        
        # Show low confidence items if any
        if low_confidence:
            print(f"\n⚠️  Low Confidence Predictions (confidence < 50%):")
            print("-"*70)
            for pred in low_confidence[:5]:
                print(f"   • {pred['name']}")
                print(f"     Category: {pred['predicted_category']} (Confidence: {pred['confidence']:.2%})")
                print(f"     Top alternatives: {sorted(pred['all_probabilities'].items(), key=lambda x: x[1], reverse=True)[:3]}")
        
        # Save to file if requested
        if output_file:
            output_data = {
                'timestamp': datetime.now().isoformat(),
                'model_info': model_info,
                'statistics': {
                    'total_items': len(predictions),
                    'average_confidence': float(avg_confidence),
                    'low_confidence_count': len(low_confidence),
                    'category_distribution': category_counts
                },
                'predictions': predictions
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Predictions saved to: {output_file}")
        
        return {
            "success": True,
            "predictions": predictions,
            "statistics": {
                "total_items": len(predictions),
                "average_confidence": float(avg_confidence),
                "low_confidence_count": len(low_confidence),
                "category_distribution": category_counts
            },
            "model_info": model_info,
            "output_file": output_file
        }
        
    except Exception as e:
        import traceback
        error_msg = f"Prediction failed: {str(e)}"
        print(f"\n❌ {error_msg}")
        print(traceback.format_exc())
        
        return {
            "success": False,
            "message": error_msg,
            "error": traceback.format_exc()
        }