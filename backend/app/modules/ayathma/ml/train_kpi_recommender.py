import json
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.metrics import classification_report
from scipy.sparse import hstack
import joblib

# Expected training file format:
# dataset_id, column_names_text, n_numeric, n_categorical, n_datetime, avg_missing_rate, pack, cards_json
# cards_json is like: ["revenue_over_time","top_products_revenue",...]

TRAIN_PATH = "ml/training_data.csv"
MODEL_OUT = "ml/kpi_recommender.joblib"

df = pd.read_csv(TRAIN_PATH)

# text feature
X_text = df["column_names_text"].fillna("")

# numeric features
num_cols = ["n_numeric", "n_categorical", "n_datetime", "avg_missing_rate"]
X_num = df[num_cols].fillna(0)

# label 1: pack (single label)
y_pack = df["pack"].astype(str)

# label 2: cards (multi-label)
all_cards = sorted({c for row in df["cards_json"] for c in json.loads(row)})
card_to_idx = {c:i for i,c in enumerate(all_cards)}

Y_cards = np.zeros((len(df), len(all_cards)), dtype=int)
for i, row in enumerate(df["cards_json"]):
    cards = json.loads(row)
    for c in cards:
        Y_cards[i, card_to_idx[c]] = 1

# Vectorizer + scaler
tfidf = TfidfVectorizer(ngram_range=(1,2), min_df=1, max_features=5000)
scaler = StandardScaler(with_mean=False)

X_text_vec = tfidf.fit_transform(X_text)
X_num_scaled = scaler.fit_transform(X_num.values)
X = hstack([X_text_vec, X_num_scaled])

X_train, X_test, y_pack_train, y_pack_test, Yc_train, Yc_test = train_test_split(
    X, y_pack, Y_cards, test_size=0.2, random_state=42
)

pack_clf = LogisticRegression(max_iter=2000)
pack_clf.fit(X_train, y_pack_train)
print("PACK REPORT")
print(classification_report(y_pack_test, pack_clf.predict(X_test)))

cards_clf = OneVsRestClassifier(LogisticRegression(max_iter=2000))
cards_clf.fit(X_train, Yc_train)
pred = cards_clf.predict(X_test)
print("CARDS REPORT")
print(classification_report(Yc_test, pred, target_names=all_cards, zero_division=0))

joblib.dump(
    {
        "tfidf": tfidf,
        "scaler": scaler,
        "pack_clf": pack_clf,
        "cards_clf": cards_clf,
        "card_labels": all_cards,
        "num_cols": num_cols,
    },
    MODEL_OUT
)

print(f"Saved model to {MODEL_OUT}")
