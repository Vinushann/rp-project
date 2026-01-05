import json
from pathlib import Path

import numpy as np
import joblib
from scipy.sparse import hstack

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler, MultiLabelBinarizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

TRAIN_PATH = Path("ml/training_data.jsonl")
OUT_PATH = Path("ml/kpi_recommender.joblib")

NUM_COLS = [
    "rows", "cols",
    "n_numeric", "n_categorical", "n_datetime",
    "avg_missing_rate",
    "money_word_count", "cost_word_count", "qty_word_count",
    "time_word_count", "product_word_count", "payment_word_count",
    "channel_word_count", "finance_word_count", "inventory_word_count",
]


def load_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def extract_text(d: dict) -> str:
    """
    Robust text extraction.
    Priority:
      1) d["features"]["column_names_text"]
      2) " ".join(d["columns"])
      3) dataset_id fallback
    """
    features = d.get("features") or {}
    txt = features.get("column_names_text")
    if isinstance(txt, str) and txt.strip():
        return txt.strip()

    cols = d.get("columns") or []
    if isinstance(cols, list) and len(cols) > 0:
        return " ".join(str(c).lower().strip() for c in cols if c)

    return str(d.get("dataset_id", "unknown")).lower()


def extract_num(d: dict) -> list:
    """
    Robust numeric extraction from d["features"] with 0.0 fallbacks.
    """
    features = d.get("features") or {}
    out = []
    for c in NUM_COLS:
        v = features.get(c, 0.0)
        try:
            out.append(float(v))
        except (TypeError, ValueError):
            out.append(0.0)
    return out


def main():
    if not TRAIN_PATH.exists():
        raise SystemExit("ml/training_data.jsonl not found")

    data = load_jsonl(TRAIN_PATH)
    if len(data) < 10:
        raise SystemExit("Need at least ~10 labeled examples to train a baseline.")

    X_text_raw = [extract_text(d) for d in data]
    X_num = np.array([extract_num(d) for d in data], dtype=float)

    y_pack = [d.get("pack", "UNKNOWN") for d in data]
    y_cards = [d.get("cards", []) for d in data]

    tfidf = TfidfVectorizer(ngram_range=(1, 2), max_features=6000, min_df=1)
    X_text = tfidf.fit_transform(X_text_raw)

    scaler = StandardScaler(with_mean=False)
    X_num_scaled = scaler.fit_transform(X_num)

    X = hstack([X_text, X_num_scaled])

    mlb = MultiLabelBinarizer()
    Y_cards = mlb.fit_transform(y_cards)

    X_train, X_test, y_pack_train, y_pack_test, Yc_train, Yc_test = train_test_split(
        X, y_pack, Y_cards, test_size=0.2, random_state=42
    )

    pack_clf = LogisticRegression(max_iter=2500)
    pack_clf.fit(X_train, y_pack_train)

    print("\nPACK CLASSIFIER REPORT")
    print(classification_report(y_pack_test, pack_clf.predict(X_test), zero_division=0))

    cards_clf = OneVsRestClassifier(LogisticRegression(max_iter=2500))
    cards_clf.fit(X_train, Yc_train)

    pred = cards_clf.predict(X_test)
    print("\nCARD RECOMMENDER REPORT")
    print(classification_report(Yc_test, pred, target_names=mlb.classes_, zero_division=0))

    bundle = {
        "tfidf": tfidf,
        "scaler": scaler,
        "pack_clf": pack_clf,
        "cards_clf": cards_clf,
        "card_labels": list(mlb.classes_),
        "num_cols": NUM_COLS,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, OUT_PATH)
    print(f"\nSaved model to {OUT_PATH}")


if __name__ == "__main__":
    main()
