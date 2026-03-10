from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime
from pathlib import Path
import json

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
)
from scipy.sparse import hstack

from .training_logger import load_training_examples
from .ml_recommender import MODEL_PATH

# Path for storing model metrics
METRICS_PATH = MODEL_PATH.parent / "model_metrics.json"


def _prepare_training_data() -> Dict[str, Any]:
  """Load JSONL training examples and prepare matrices and labels.

  Each example is expected to look roughly like:

      {
        "dataset_id": str,
        "pack": str,
        "features": {"column_names_text": str, ...},
        "cards": [card_id, ...],
      }

  Examples missing required pieces are skipped.
  """
  examples = load_training_examples()
  texts: List[str] = []
  packs: List[str] = []
  cards_per_example: List[List[str]] = []

  num_cols = ["n_numeric", "n_categorical", "n_datetime", "avg_missing_rate"]
  X_num_rows: List[List[float]] = []

  for ex in examples:
    pack = ex.get("pack")
    feats = ex.get("features") or {}
    cards = ex.get("cards") or []

    text = (feats.get("column_names_text") or "").strip()
    if not pack or not text:
      continue

    texts.append(text)
    packs.append(str(pack))
    cards_per_example.append([str(c) for c in cards])

    row = [float(feats.get(c, 0.0) or 0.0) for c in num_cols]
    X_num_rows.append(row)

  if not texts:
    raise ValueError("No usable training examples found in training_data.jsonl")

  # Build card label space
  all_cards = sorted({c for row in cards_per_example for c in row})
  if not all_cards:
    raise ValueError("Training data has no card labels; cannot train multi-label classifier.")

  card_to_idx = {c: i for i, c in enumerate(all_cards)}
  Y_cards = np.zeros((len(texts), len(all_cards)), dtype=int)
  for i, row in enumerate(cards_per_example):
    for c in row:
      j = card_to_idx.get(c)
      if j is not None:
        Y_cards[i, j] = 1

  return {
    "texts": texts,
    "packs": np.array(packs, dtype=str),
    "X_num": np.array(X_num_rows, dtype=float),
    "Y_cards": Y_cards,
    "num_cols": num_cols,
    "card_labels": all_cards,
  }


def train_recommender_from_jsonl(test_size: float = 0.2) -> Dict[str, Any]:
  """Train the KPI recommender model from JSONL training data.

  Writes the model bundle to MODEL_PATH and returns a summary
  including training metrics (accuracy, precision, recall, F1).
  
  Args:
      test_size: Fraction of data to use for testing (0-1). Set to 0 to train on all data.
  """
  data = _prepare_training_data()

  texts = data["texts"]
  packs = data["packs"]
  X_num = data["X_num"]
  Y_cards = data["Y_cards"]
  num_cols = data["num_cols"]
  card_labels = data["card_labels"]

  # Text and numeric feature pipelines
  tfidf = TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=5000)
  scaler = StandardScaler(with_mean=False)

  X_text_vec = tfidf.fit_transform(texts)
  X_num_scaled = scaler.fit_transform(X_num)
  X = hstack([X_text_vec, X_num_scaled])

  metrics = {
    "trained_at": datetime.utcnow().isoformat(),
    "n_examples": len(texts),
    "n_cards": len(card_labels),
    "test_size": test_size,
  }

  # Split data for evaluation if we have enough examples
  if test_size > 0 and len(texts) >= 5:
    X_train, X_test, y_pack_train, y_pack_test, Yc_train, Yc_test = train_test_split(
        X, packs, Y_cards, test_size=test_size, random_state=42
    )
    
    # Train pack classifier
    pack_clf = LogisticRegression(max_iter=2000)
    pack_clf.fit(X_train, y_pack_train)
    
    # Evaluate pack classifier
    pack_pred = pack_clf.predict(X_test)
    metrics["pack_classifier"] = {
      "accuracy": float(accuracy_score(y_pack_test, pack_pred)),
      "precision": float(precision_score(y_pack_test, pack_pred, average='weighted', zero_division=0)),
      "recall": float(recall_score(y_pack_test, pack_pred, average='weighted', zero_division=0)),
      "f1": float(f1_score(y_pack_test, pack_pred, average='weighted', zero_division=0)),
      "support": int(len(y_pack_test)),
    }
    
    # Train cards classifier
    cards_clf = OneVsRestClassifier(LogisticRegression(max_iter=2000))
    cards_clf.fit(X_train, Yc_train)
    
    # Evaluate cards classifier (multi-label)
    cards_pred = cards_clf.predict(X_test)
    metrics["cards_classifier"] = {
      "accuracy": float(accuracy_score(Yc_test, cards_pred)),  # Exact match ratio
      "precision": float(precision_score(Yc_test, cards_pred, average='weighted', zero_division=0)),
      "recall": float(recall_score(Yc_test, cards_pred, average='weighted', zero_division=0)),
      "f1": float(f1_score(Yc_test, cards_pred, average='weighted', zero_division=0)),
      "support": int(len(Yc_test)),
    }
    
    # Per-class metrics for cards (detailed breakdown)
    per_class_metrics = []
    for i, label in enumerate(card_labels):
      y_true = Yc_test[:, i]
      y_pred = cards_pred[:, i]
      if y_true.sum() > 0:  # Only if there are positive examples
        per_class_metrics.append({
          "label": label,
          "precision": float(precision_score(y_true, y_pred, zero_division=0)),
          "recall": float(recall_score(y_true, y_pred, zero_division=0)),
          "f1": float(f1_score(y_true, y_pred, zero_division=0)),
          "support": int(y_true.sum()),
        })
    metrics["per_class_metrics"] = per_class_metrics
    
    # Retrain on full data for deployment
    pack_clf = LogisticRegression(max_iter=2000)
    pack_clf.fit(X, packs)
    
    cards_clf = OneVsRestClassifier(LogisticRegression(max_iter=2000))
    cards_clf.fit(X, Y_cards)
    
  else:
    # Not enough data for split - train on all, no metrics
    pack_clf = LogisticRegression(max_iter=2000)
    pack_clf.fit(X, packs)
    
    cards_clf = OneVsRestClassifier(LogisticRegression(max_iter=2000))
    cards_clf.fit(X, Y_cards)
    
    metrics["pack_classifier"] = {"note": "Not enough data for train/test split"}
    metrics["cards_classifier"] = {"note": "Not enough data for train/test split"}

  bundle = {
    "tfidf": tfidf,
    "scaler": scaler,
    "pack_clf": pack_clf,
    "cards_clf": cards_clf,
    "card_labels": card_labels,
    "num_cols": num_cols,
  }

  MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
  joblib.dump(bundle, str(MODEL_PATH))
  
  # Save metrics to JSON file
  with METRICS_PATH.open("w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2, ensure_ascii=False)

  summary = {
    "n_examples": int(len(texts)),
    "n_cards": int(len(card_labels)),
    "card_labels": card_labels,
    "metrics": metrics,
  }
  return summary


def get_model_metrics() -> Optional[Dict[str, Any]]:
  """Load and return saved model metrics.
  
  Returns None if no metrics file exists.
  """
  if not METRICS_PATH.exists():
    return None
  
  with METRICS_PATH.open("r", encoding="utf-8") as f:
    return json.load(f)
