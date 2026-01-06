from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import joblib
import numpy as np
from scipy.sparse import hstack


# Resolve model path relative to the Ayathma module so it
# does not depend on the process working directory.
_BASE_DIR = Path(__file__).resolve().parents[2] / "ml"
_BASE_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = _BASE_DIR / "kpi_recommender.joblib"


def recommend_pack_and_cards(features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        bundle = joblib.load(str(MODEL_PATH))
    except Exception:
        return None  # model not trained yet

    tfidf = bundle["tfidf"]
    scaler = bundle["scaler"]
    pack_clf = bundle["pack_clf"]
    cards_clf = bundle["cards_clf"]
    card_labels = bundle["card_labels"]
    num_cols = bundle["num_cols"]

    text = features["column_names_text"]
    X_text = tfidf.transform([text])

    X_num = scaler.transform([[features.get(c, 0.0) for c in num_cols]])
    X = hstack([X_text, X_num])

    pack = pack_clf.predict(X)[0]
    pack_prob = float(np.max(pack_clf.predict_proba(X))) if hasattr(pack_clf, "predict_proba") else None

    probs = cards_clf.predict_proba(X)[0]
    ranked = sorted(zip(card_labels, probs), key=lambda x: x[1], reverse=True)

    # choose top cards above threshold, up to 10
    chosen = [c for c, p in ranked if p >= 0.35][:10]
    if not chosen:
        chosen = [ranked[0][0]] if ranked else []

    return {
        "pack": pack,
        "pack_confidence": pack_prob,
        "cards_selected": chosen,
        "cards_ranked": [{"card": c, "score": float(p)} for c, p in ranked[:15]],
    }
