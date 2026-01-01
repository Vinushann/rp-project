import json
import numpy as np
import pandas as pd
from datetime import datetime
import os
import joblib
from typing import Dict, List, Tuple
import warnings
warnings.filterwarnings('ignore')

# ML Models
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB

# Feature Extraction
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.feature_selection import chi2, mutual_info_classif, SelectKBest
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import MinMaxScaler

# Evaluation
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, 
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)

# Text preprocessing
import re
import nltk
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

class MenuCategoryClassifier:
    """
    Multi-model classifier for menu item categorization.
    Tests multiple ML models and feature extraction methods.
    """
    
    def __init__(self):
        self.models = {
            'SVM': SVC(kernel='linear', probability=True, random_state=42),
            'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
            'Multinomial Naive Bayes': MultinomialNB()
        }
        
        self.vectorizers = {
            'Bag-of-Words': CountVectorizer(max_features=1000, ngram_range=(1, 2)),
            'TF-IDF': TfidfVectorizer(max_features=1000, ngram_range=(1, 2)),
        }
        
        self.feature_selectors = {
            'Chi-Square': 'chi2',
            'Mutual Information': 'mutual_info',
            'LSA': 'lsa'
        }
        
        self.best_model = None
        self.best_vectorizer = None
        self.best_feature_selector = None
        self.best_selector_object = None
        self.best_score = 0
        self.results = []
        
        try:
            self.stop_words = set(stopwords.words('english'))
        except:
            self.stop_words = set()
    
    def preprocess_text(self, text: str) -> str:
        """Preprocess text: lowercase, remove special chars, remove stopwords"""
        if not text or not isinstance(text, str):
            return ""
        
        # Lowercase
        text = text.lower()
        
        # Remove special characters but keep spaces
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        
        # Remove extra spaces
        text = ' '.join(text.split())
        
        # Remove stopwords
        if self.stop_words:
            words = text.split()
            text = ' '.join([w for w in words if w not in self.stop_words])
        
        return text
    
    def load_training_data(self, json_file: str) -> Tuple[List[str], List[str]]:
        """Load and prepare training data from JSON file"""
        print(f"📖 Loading training data from: {json_file}")
        
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            raise ValueError("JSON file must contain a list of menu items")
        
        texts = []
        categories = []
        
        for item in data:
            # Use only name for classification (no description - POS items won't have it)
            # Handle None values explicitly
            name = (item.get('name') or '').strip()
            category = (item.get('category') or '').strip()
            
            if not name or not category:
                continue
            
            # Use only name for classification
            preprocessed = self.preprocess_text(name)
            
            if preprocessed:  # Only add if text is not empty after preprocessing
                texts.append(preprocessed)
                categories.append(category)
        
        print(f"✅ Loaded {len(texts)} items")
        print(f"📊 Categories found: {len(set(categories))}")
        print(f"   Categories: {', '.join(sorted(set(categories)))}")
        
        return texts, categories
    
    def apply_feature_selection(self, X_train, X_test, y_train, method: str, n_features: int = 500):
        """Apply feature selection method and return both transformed data and selector"""
        n_features = min(n_features, X_train.shape[1] - 1)
        
        if method == 'chi2':
            # Chi-Square - works with non-negative features
            selector = SelectKBest(chi2, k=n_features)
            X_train_selected = selector.fit_transform(X_train, y_train)
            X_test_selected = selector.transform(X_test)
            return X_train_selected, X_test_selected, selector
        
        elif method == 'mutual_info':
            # Mutual Information
            selector = SelectKBest(mutual_info_classif, k=n_features)
            X_train_selected = selector.fit_transform(X_train, y_train)
            X_test_selected = selector.transform(X_test)
            return X_train_selected, X_test_selected, selector
        
        elif method == 'lsa':
            # Latent Semantic Analysis
            n_components = min(100, X_train.shape[1] - 1, n_features)
            selector = TruncatedSVD(n_components=n_components, random_state=42)
            X_train_selected = selector.fit_transform(X_train)
            X_test_selected = selector.transform(X_test)
            return X_train_selected, X_test_selected, selector
        
        return X_train, X_test, None
    
    def ensure_non_negative(self, X):
        """Ensure features are non-negative for MultinomialNB"""
        if np.any(X < 0):
            # Scale to [0, 1] range
            scaler = MinMaxScaler()
            if hasattr(X, 'toarray'):
                X = X.toarray()
            X_scaled = scaler.fit_transform(X)
            return X_scaled, scaler
        return X, None
    
    def train_and_evaluate(self, texts: List[str], categories: List[str]) -> Dict:
        """Train all model combinations and find the best one"""
        
        print("\n" + "="*70)
        print("🤖 TRAINING MULTIPLE MODELS")
        print("="*70)
        
        # Split data
        X_train_text, X_test_text, y_train, y_test = train_test_split(
            texts, categories, test_size=0.2, random_state=42, stratify=categories
        )
        
        print(f"\n📊 Data split:")
        print(f"   Training: {len(X_train_text)} items")
        print(f"   Testing: {len(X_test_text)} items")
        
        results = []
        best_accuracy = 0
        best_config = None
        
        # Try all combinations
        total_combinations = len(self.vectorizers) * len(self.feature_selectors) * len(self.models)
        current = 0
        
        for vec_name, vectorizer in self.vectorizers.items():
            print(f"\n{'─'*70}")
            print(f"🔤 Feature Extraction: {vec_name}")
            print(f"{'─'*70}")
            
            # Vectorize
            X_train_vec = vectorizer.fit_transform(X_train_text)
            X_test_vec = vectorizer.transform(X_test_text)
            
            for fs_name, fs_method in self.feature_selectors.items():
                print(f"\n  🔍 Feature Selection: {fs_name}")
                
                # Apply feature selection
                X_train_selected, X_test_selected, selector = self.apply_feature_selection(
                    X_train_vec, X_test_vec, y_train, fs_method
                )
                
                for model_name, model in self.models.items():
                    current += 1
                    print(f"\n    🎯 Model {current}/{total_combinations}: {model_name}")
                    
                    try:
                        # Clone model
                        model_clone = self._clone_model(model)
                        
                        # Prepare data (ensure non-negative for MultinomialNB)
                        X_train_final = X_train_selected
                        X_test_final = X_test_selected
                        scaler = None
                        
                        if isinstance(model_clone, MultinomialNB):
                            X_train_final, scaler = self.ensure_non_negative(X_train_selected)
                            X_test_final, _ = self.ensure_non_negative(X_test_selected)
                        
                        # Train
                        model_clone.fit(X_train_final, y_train)
                        
                        # Predict
                        y_pred = model_clone.predict(X_test_final)
                        
                        # Evaluate
                        accuracy = accuracy_score(y_test, y_pred)
                        precision, recall, f1, _ = precision_recall_fscore_support(
                            y_test, y_pred, average='weighted', zero_division=0
                        )
                        
                        # Cross-validation score
                        cv_scores = cross_val_score(
                            model_clone, X_train_final, y_train, cv=min(5, len(set(y_train))), 
                            scoring='accuracy'
                        )
                        cv_mean = cv_scores.mean()
                        cv_std = cv_scores.std()
                        
                        result = {
                            'vectorizer': vec_name,
                            'feature_selector': fs_name,
                            'model': model_name,
                            'accuracy': accuracy,
                            'precision': precision,
                            'recall': recall,
                            'f1_score': f1,
                            'cv_mean': cv_mean,
                            'cv_std': cv_std,
                            'model_object': model_clone,
                            'vectorizer_object': vectorizer,
                            'selector_object': selector,
                            'scaler_object': scaler
                        }
                        
                        results.append(result)
                        
                        print(f"       ✓ Accuracy: {accuracy:.4f}")
                        print(f"       ✓ F1-Score: {f1:.4f}")
                        print(f"       ✓ CV Score: {cv_mean:.4f} (±{cv_std:.4f})")
                        
                        # Track best model
                        if accuracy > best_accuracy:
                            best_accuracy = accuracy
                            best_config = {
                                'model': model_clone,
                                'vectorizer': vectorizer,
                                'selector': selector,
                                'scaler': scaler,
                                'feature_selector': fs_method,
                                'result': result,
                                'X_test_text': X_test_text,
                                'y_test': y_test
                            }
                    
                    except Exception as e:
                        print(f"       ✗ Failed: {str(e)[:50]}")
                        continue
        
        # Store results
        self.results = sorted(results, key=lambda x: x['accuracy'], reverse=True)
        
        if best_config:
            self.best_model = best_config['model']
            self.best_vectorizer = best_config['vectorizer']
            self.best_feature_selector = best_config['feature_selector']
            self.best_selector_object = best_config['selector']
            self.best_scaler = best_config.get('scaler')
            self.best_score = best_accuracy
            
            # Get predictions for best model
            X_test_vec = self.best_vectorizer.transform(best_config['X_test_text'])
            
            if self.best_selector_object:
                X_test_selected = self.best_selector_object.transform(X_test_vec)
            else:
                X_test_selected = X_test_vec
            
            if self.best_scaler and isinstance(self.best_model, MultinomialNB):
                X_test_final, _ = self.ensure_non_negative(X_test_selected)
            else:
                X_test_final = X_test_selected
            
            y_pred = self.best_model.predict(X_test_final)
        else:
            y_pred = None
        
        return {
            'all_results': results,
            'best_config': best_config,
            'y_test': best_config['y_test'] if best_config else None,
            'y_pred': y_pred
        }
    
    def _clone_model(self, model):
        """Clone a model"""
        if isinstance(model, SVC):
            return SVC(kernel='linear', probability=True, random_state=42)
        elif isinstance(model, LogisticRegression):
            return LogisticRegression(max_iter=1000, random_state=42)
        elif isinstance(model, MultinomialNB):
            return MultinomialNB()
        return model
    
    def save_model(self, output_dir: str = "models", categories: List[str] = None):
        """Save the best model, vectorizer, and selector"""
        os.makedirs(output_dir, exist_ok=True)
        
        model_file = os.path.join(output_dir, "best_model.pkl")
        vectorizer_file = os.path.join(output_dir, "vectorizer.pkl")
        selector_file = os.path.join(output_dir, "selector.pkl")
        scaler_file = os.path.join(output_dir, "scaler.pkl")
        results_file = os.path.join(output_dir, "model_results.json")
        
        # Save model
        joblib.dump(self.best_model, model_file)
        
        # Save vectorizer
        joblib.dump(self.best_vectorizer, vectorizer_file)
        
        # Save selector (if exists)
        if self.best_selector_object:
            joblib.dump(self.best_selector_object, selector_file)
        
        # Save scaler (if exists)
        if hasattr(self, 'best_scaler') and self.best_scaler:
            joblib.dump(self.best_scaler, scaler_file)
        
        # Save results
        results_to_save = []
        for r in self.results:
            results_to_save.append({
                'vectorizer': r['vectorizer'],
                'feature_selector': r['feature_selector'],
                'model': r['model'],
                'accuracy': float(r['accuracy']),
                'precision': float(r['precision']),
                'recall': float(r['recall']),
                'f1_score': float(r['f1_score']),
                'cv_mean': float(r['cv_mean']),
                'cv_std': float(r['cv_std'])
            })
        
        with open(results_file, 'w', encoding='utf-8') as f:
            # Get f1_score from the best result
            best_result = self.results[0] if self.results else {}
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'best_model': {
                    'vectorizer': best_result.get('vectorizer', ''),
                    'feature_selector': best_result.get('feature_selector', ''),
                    'model': best_result.get('model', ''),
                    'accuracy': float(self.best_score),
                    'f1_score': float(best_result.get('f1_score', 0))
                },
                'categories': categories or [],
                'all_results': results_to_save
            }, f, indent=2)
        
        return model_file, vectorizer_file, results_file


def train_category_classifier(training_file: str, output_dir: str = "models") -> Dict:
    """
    Tool to train menu category classifier with multiple models.
    
    Args:
        training_file: Path to training JSON file (e.g., menu_data.json)
        output_dir: Directory to save trained models
        
    Returns:
        dict with training results and best model info
    """
    
    print("🤖 MENU CATEGORY CLASSIFIER TRAINING")
    print("="*70)
    print(f"📁 Training file: {training_file}")
    print(f"📁 Output directory: {output_dir}")
    print("="*70)
    
    try:
        # Initialize classifier
        classifier = MenuCategoryClassifier()
        
        # Load data
        texts, categories = classifier.load_training_data(training_file)
        
        if len(texts) == 0:
            return {
                "success": False,
                "message": "No valid training data found",
                "error": "Empty dataset after preprocessing"
            }
        
        if len(set(categories)) < 2:
            return {
                "success": False,
                "message": "Need at least 2 categories for classification",
                "error": f"Only found {len(set(categories))} category"
            }
        
        # Train all models
        training_results = classifier.train_and_evaluate(texts, categories)
        
        if not classifier.results:
            return {
                "success": False,
                "message": "All model training attempts failed",
                "error": "No successful model configurations"
            }
        
        # Print results summary
        print("\n" + "="*70)
        print("📊 FINAL RESULTS SUMMARY")
        print("="*70)
        
        print("\n🏆 TOP 5 MODEL CONFIGURATIONS:")
        print(f"{'Rank':<6} {'Vectorizer':<20} {'Feature Selector':<20} {'Model':<25} {'Accuracy':<10}")
        print("─"*95)
        
        for i, result in enumerate(classifier.results[:5], 1):
            print(f"{i:<6} {result['vectorizer']:<20} {result['feature_selector']:<20} "
                  f"{result['model']:<25} {result['accuracy']:.4f}")
        
        # Best model details
        best = classifier.results[0]
        print(f"\n{'='*70}")
        print("🥇 BEST MODEL SELECTED")
        print(f"{'='*70}")
        print(f"   Vectorizer: {best['vectorizer']}")
        print(f"   Feature Selector: {best['feature_selector']}")
        print(f"   Model: {best['model']}")
        print(f"   Accuracy: {best['accuracy']:.4f}")
        print(f"   Precision: {best['precision']:.4f}")
        print(f"   Recall: {best['recall']:.4f}")
        print(f"   F1-Score: {best['f1_score']:.4f}")
        print(f"   CV Score: {best['cv_mean']:.4f} (±{best['cv_std']:.4f})")
        
        # Save model with categories
        print(f"\n💾 Saving best model...")
        unique_categories = list(set(categories))
        model_file, vec_file, results_file = classifier.save_model(output_dir, unique_categories)
        
        print(f"✅ Model saved to: {model_file}")
        print(f"✅ Vectorizer saved to: {vec_file}")
        print(f"✅ Results saved to: {results_file}")
        
        # Confusion matrix for best model
        if training_results['y_pred'] is not None:
            print(f"\n📊 Classification Report (Best Model):")
            print("─"*70)
            print(classification_report(
                training_results['y_test'], 
                training_results['y_pred'],
                zero_division=0
            ))
        
        return {
            "success": True,
            "message": f"Successfully trained {len(classifier.results)} model configurations",
            "best_model": {
                "name": best['model'],
                "vectorizer": best['vectorizer'],
                "feature_selector": best['feature_selector'],
                "accuracy": float(best['accuracy']),
                "f1_score": float(best['f1_score']),
                "cv_score": float(best['cv_mean'])
            },
            "model_file": model_file,
            "vectorizer_file": vec_file,
            "results_file": results_file,
            "total_models_tested": len(classifier.results),
            "categories": list(set(categories)),
            "n_samples": len(texts)
        }
        
    except Exception as e:
        import traceback
        error_msg = f"Training failed: {str(e)}"
        print(f"\n❌ {error_msg}")
        print(traceback.format_exc())
        
        return {
            "success": False,
            "message": error_msg,
            "error": traceback.format_exc()
        }