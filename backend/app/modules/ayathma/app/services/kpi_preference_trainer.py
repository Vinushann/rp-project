from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

import json

import joblib
import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from .kpi_feedback_logger import load_kpi_feedback
from .ml_recommender import MODEL_PATH as BASE_MODEL_PATH


# Store KPI preference model alongside the main recommender
PREF_MODEL_PATH = BASE_MODEL_PATH.parent / "kpi_preference.joblib"
PREF_METRICS_PATH = BASE_MODEL_PATH.parent / "kpi_preference_metrics.json"


def _build_training_matrices() -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """Build feature matrix X and label vector y from KPI feedback.

    Features combine:
      - dataset-level text (column_names_text if available)
      - KPI text (prompt_text and/or user_text)
    Label is binary: liked (1) vs not liked (0).
    """
    rows = load_kpi_feedback()
    texts: List[str] = []
    labels: List[int] = []

    for rec in rows:
        liked = rec.get("liked")
        if liked is None:
            continue

        # KPI text: prompt_text + user_text if any
        prompt = str(rec.get("prompt_text") or "").strip()
        user_txt = str(rec.get("user_text") or "").strip()
        kpi_text = " ".join(t for t in [prompt, user_txt] if t).strip()
        if not kpi_text:
            continue

        # Dataset context: allow caller to pass a precomputed text blob
        dataset_text = str(rec.get("dataset_text") or "").strip()

        full_text = " | ".join(t for t in [dataset_text, kpi_text] if t)
        if not full_text:
            continue

        texts.append(full_text)
        labels.append(1 if bool(liked) else 0)

    if not texts:
        raise ValueError("No usable KPI feedback examples found for training.")

    # For now we use pure text features; can be extended to numeric later
    tfidf = TfidfVectorizer(ngram_range=(1, 2), max_features=6000, min_df=1)
    X_text = tfidf.fit_transform(texts)

    # Dummy numeric block (all zeros) to keep shape extensible
    X_num = np.zeros((len(texts), 1), dtype=float)
    scaler = StandardScaler(with_mean=False)
    X_num_scaled = scaler.fit_transform(X_num)

    X = hstack([X_text, X_num_scaled])
    y = np.array(labels, dtype=int)

    bundle_meta = {
        "tfidf": tfidf,
        "scaler": scaler,
    }
    return X, y, bundle_meta


def train_kpi_preference(test_size: float = 0.2) -> Dict[str, Any]:
    """Train a binary KPI preference model from feedback JSONL.

    The model predicts P(liked | dataset, kpi_text).
    """
    X, y, meta = _build_training_matrices()

    metrics: Dict[str, Any] = {
        "n_examples": int(len(y)),
        "test_size": float(test_size),
    }

    if len(y) >= 5 and 0 < test_size < 0.9:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
    else:
        X_train, y_train = X, y
        X_test, y_test = None, None

    clf = LogisticRegression(max_iter=2000)
    clf.fit(X_train, y_train)

    if X_test is not None and y_test is not None and len(y_test) > 0:
        y_pred = clf.predict(X_test)
        metrics.update(
            {
                "accuracy": float(accuracy_score(y_test, y_pred)),
                "precision": float(precision_score(y_test, y_pred, zero_division=0)),
                "recall": float(recall_score(y_test, y_pred, zero_division=0)),
                "f1": float(f1_score(y_test, y_pred, zero_division=0)),
                "support": int(len(y_test)),
            }
        )
    else:
        metrics["note"] = "Not enough data for a held-out test split; trained on all examples."

    # Persist model bundle
    bundle = {
        "tfidf": meta["tfidf"],
        "scaler": meta["scaler"],
        "clf": clf,
    }
    PREF_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, str(PREF_MODEL_PATH))

    with PREF_METRICS_PATH.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    return metrics


def score_kpi_preference(dataset_text: str, kpi_text: str) -> float:
    """Score how likely a KPI is to be liked (0-1).

    Returns 0.5 if no model is available.
    """
    if not PREF_MODEL_PATH.exists():
        return 0.5

    try:
        bundle = joblib.load(str(PREF_MODEL_PATH))
    except Exception:
        return 0.5

    tfidf = bundle["tfidf"]
    scaler = bundle["scaler"]
    clf = bundle["clf"]

    text_parts = []
    if dataset_text:
        text_parts.append(str(dataset_text))
    if kpi_text:
        text_parts.append(str(kpi_text))
    full_text = " | ".join(text_parts).strip()
    if not full_text:
        return 0.5

    X_text = tfidf.transform([full_text])
    X_num = np.zeros((1, 1), dtype=float)
    X_num_scaled = scaler.transform(X_num)
    X = hstack([X_text, X_num_scaled])

    if hasattr(clf, "predict_proba"):
        prob = float(clf.predict_proba(X)[0, 1])
    else:
        # fall back to decision function mapped to [0,1]
        score = float(clf.decision_function(X)[0])
        prob = 1.0 / (1.0 + np.exp(-score))

    return prob
