import json
import os
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score

from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.feature_selection import SelectKBest, chi2, mutual_info_classif
from sklearn.decomposition import TruncatedSVD

from sklearn.svm import LinearSVC
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB

# --------------------------------------------------
# Paths
# --------------------------------------------------
DATA_PATH = "data/menu_data.json"
MODEL_DIR = "ml/models"
os.makedirs(MODEL_DIR, exist_ok=True)

# --------------------------------------------------
# Load data
# --------------------------------------------------
with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

df = pd.DataFrame(data)

df["text"] = (
    df["name"].fillna("") + " " +
    df["description"].fillna("")
)

X = df["text"]
y = df["category"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# --------------------------------------------------
# Models
# --------------------------------------------------
models = {
    "SVM": LinearSVC(),
    "LogisticRegression": LogisticRegression(max_iter=1000),
    "MultinomialNB": MultinomialNB()
}

# --------------------------------------------------
# Vectorizers
# --------------------------------------------------
vectorizers = {
    "BoW": CountVectorizer(ngram_range=(1,2), stop_words="english"),
    "TFIDF": TfidfVectorizer(ngram_range=(1,2), stop_words="english")
}

# --------------------------------------------------
# Feature selectors
# --------------------------------------------------
selectors = {
    "chi2": SelectKBest(chi2, k=1000),
    "mutual_info": SelectKBest(mutual_info_classif, k=1000),
    "lsa": TruncatedSVD(n_components=100, random_state=42)
}

# --------------------------------------------------
# Training loop
# --------------------------------------------------
results = []
best_pipeline = None
best_score = 0
best_name = None

for model_name, model in models.items():
    for vec_name, vectorizer in vectorizers.items():
        for sel_name, selector in selectors.items():

            # NB + LSA is invalid
            if model_name == "MultinomialNB" and sel_name == "lsa":
                continue

            pipeline = Pipeline([
                ("vectorizer", vectorizer),
                ("selector", selector),
                ("classifier", model)
            ])

            try:
                pipeline.fit(X_train, y_train)
                preds = pipeline.predict(X_test)

                acc = accuracy_score(y_test, preds)
                f1 = f1_score(y_test, preds, average="weighted")

                results.append({
                    "model": model_name,
                    "vectorizer": vec_name,
                    "selector": sel_name,
                    "accuracy": round(acc, 4),
                    "f1": round(f1, 4)
                })

                print(f"✅ {model_name} | {vec_name} | {sel_name} → F1={f1:.4f}")

                if f1 > best_score:
                    best_score = f1
                    best_pipeline = pipeline
                    best_name = f"{model_name}_{vec_name}_{sel_name}"

            except Exception as e:
                print(f"❌ {model_name} | {vec_name} | {sel_name} FAILED → {e}")

# --------------------------------------------------
# Save best model
# --------------------------------------------------
joblib.dump(best_pipeline, f"{MODEL_DIR}/best_model.joblib")

# Save leaderboard
with open(f"{MODEL_DIR}/leaderboard.json", "w", encoding="utf-8") as f:
    json.dump(sorted(results, key=lambda x: x["f1"], reverse=True), f, indent=2)

print("\n🏆 BEST MODEL")
print(best_name)
print("F1:", round(best_score, 4))
print("📦 Saved to ml/models/best_model.joblib")
