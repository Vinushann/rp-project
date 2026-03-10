# import torch
# from transformers import BertTokenizer, BertForSequenceClassification

# class SentimentAnalyzer:
#     def __init__(self, model_path="./my_sentiment_model"):
#         print("Loading AI Model... (This takes a few seconds)")
#         try:
#             self.tokenizer = BertTokenizer.from_pretrained(model_path)
#             self.model = BertForSequenceClassification.from_pretrained(model_path)
#             self.model.eval()
#             print("Model Loaded Successfully!")
#         except Exception as e:
#             print(f"CRITICAL ERROR: Model not found at {model_path}")
#             raise e

#     def predict(self, text):
#         # Tokenize
#         inputs = self.tokenizer(
#             text, return_tensors="pt", truncation=True, padding=True, max_length=128
#         )
        
#         # Inference
#         with torch.no_grad():
#             outputs = self.model(**inputs)
        
#         # Calculate Probabilities
#         probs = torch.sigmoid(outputs.logits).squeeze().tolist()
        
#         # Create Result Dictionary
#         labels = ['Positive', 'Negative', 'Neutral']
#         results = {labels[i]: round(prob, 4) for i, prob in enumerate(probs)}
        
#         # Determine dominant tags (>50%)
#         active_tags = [label for label, score in results.items() if score > 0.5]
        
#         return {
#             "text": text,
#             "sentiment": active_tags if active_tags else ["Neutral"],
#             "scores": results
#         }


import torch
import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from deep_translator import GoogleTranslator

HF_REPO_ID = "NandikA123/xlm-roberta-sinhala-sentiment"

class SentimentAnalyzer:
    def __init__(self, model_path="./my_sentiment_model_Roberta_1"):
        # If local model folder is missing or incomplete, download from Hugging Face Hub.
        has_dir = os.path.isdir(model_path)
        has_files = has_dir and bool(os.listdir(model_path))
        has_weights = has_dir and (
            os.path.exists(os.path.join(model_path, "model.safetensors"))
            or os.path.exists(os.path.join(model_path, "pytorch_model.bin"))
        )

        if (not has_dir) or (not has_files) or (not has_weights):
            print(f"⬇️  Local model not found at '{model_path}'")
            print(f"⬇️  Downloading from Hugging Face: {HF_REPO_ID} ...")
            from huggingface_hub import snapshot_download
            snapshot_download(
                repo_id=HF_REPO_ID,
                local_dir=model_path,
            )
            print(f"✅ Model downloaded to: {model_path}")

        print(f"Loading Model from {model_path}...")
        try:
            # CHANGED: Use Auto classes for XLM-RoBERTa support
            self.tokenizer = AutoTokenizer.from_pretrained(model_path)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
            self.model.eval()
            
            # Initialize the Translator
            self.translator = GoogleTranslator(source='auto', target='en')
            print("✅ Model & Translator Loaded Successfully!")
            
        except OSError:
            print(f"❌ CRITICAL ERROR: Model not found at '{model_path}'")
            print("Make sure the folder name matches exactly!")
            raise

    def predict(self, text):
        # --- STEP 1: TRANSLATION ---
        # This is your "Thesis Method" (Translation-Based Transfer Learning)
        try:
            # Ensure text is a string
            text_str = str(text)
            if not text_str.strip():
                translated_text = "neutral"
            else:
                translated_text = self.translator.translate(text_str)
                
            if translated_text is None: # Safety check
                translated_text = text_str
                
        except Exception as e:
            print(f"Translation failed: {e}")
            translated_text = str(text) # Fallback to original

        # --- STEP 2: INFERENCE ---
        inputs = self.tokenizer(
            translated_text, 
            return_tensors="pt", 
            truncation=True, 
            padding=True, 
            max_length=128
        )
        
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        # Calculate Probabilities
        probs = torch.sigmoid(outputs.logits).squeeze().tolist()
        
        # --- STEP 3: SMART THRESHOLDING ---
        # Mapping: 0=Positive, 1=Negative, 2=Neutral (Adjust based on your training config!)
        labels = ['Positive', 'Negative', 'Neutral']
        
        results = {labels[i]: round(prob, 4) for i, prob in enumerate(probs)}
        
        # Thesis Logic: Boost Negative Recall
        # If Negative score > 0.4, force it to be a tag, even if others are higher
        active_tags = []
        
        # Check Negative first (Index 1)
        if probs[1] > 0.4:
            active_tags.append("Negative")
        
        # Then check others with standard 0.5 threshold
        if probs[0] > 0.5: active_tags.append("Positive")
        if probs[2] > 0.5: active_tags.append("Neutral")
        
        # Deduplicate and handle empty
        active_tags = list(set(active_tags))
        if not active_tags:
            active_tags = ["Neutral"]

        return {
            "original_text": text,
            "translated_text": translated_text, # Useful for debugging/demo
            "sentiment": active_tags,
            "scores": results
        }