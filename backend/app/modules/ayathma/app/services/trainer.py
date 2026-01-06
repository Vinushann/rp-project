from __future__ import annotations

from typing import Any, Dict, List
import json

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import StandardScaler
from scipy.sparse import hstack

from .training_logger import load_training_examples
from .ml_recommender import MODEL_PATH


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


def train_recommender_from_jsonl() -> Dict[str, Any]:
  """Train the KPI recommender model from JSONL training data.

  Writes the model bundle to MODEL_PATH and returns a small summary
  describing the training set and label coverage.
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

  # Single-label pack classifier
  pack_clf = LogisticRegression(max_iter=2000)
  pack_clf.fit(X, packs)

  # Multi-label cards classifier
  cards_clf = OneVsRestClassifier(LogisticRegression(max_iter=2000))
  cards_clf.fit(X, Y_cards)

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

  summary = {
    "n_examples": int(len(texts)),
    "n_cards": int(len(card_labels)),
    "card_labels": card_labels,
  }
  return summary
