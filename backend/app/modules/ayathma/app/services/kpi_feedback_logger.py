from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


# Store KPI feedback alongside other ML assets under the ayathma/ml folder
_BASE_DIR = Path(__file__).resolve().parents[2] / "ml"
_BASE_DIR.mkdir(parents=True, exist_ok=True)
FEEDBACK_PATH = _BASE_DIR / "kpi_feedback.jsonl"


def append_kpi_feedback(example: Dict[str, Any]) -> None:
    """Append a single KPI feedback example as JSONL.

    Expected minimal structure (fields are not rigidly enforced here):
        {
          "dataset_id": str,
          "kpi_id": str,           # stable id for this KPI instance
          "card_id": str,          # e.g. "top_dimension_by_measure"
          "measure_col": str|null,
          "dimension_col": str|null,
          "time_col": str|null,
          "prompt_text": str,      # human-readable KPI description
          "liked": bool,           # True if user kept/liked, False if rejected
          "user_text": str|null,   # free-text KPI typed by user, if any
          ...                       # any extra fields are preserved
        }
    The example dict is enriched with a UTC timestamp.
    """
    record = dict(example)
    record["saved_at"] = datetime.utcnow().isoformat()

    with FEEDBACK_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_kpi_feedback() -> List[Dict[str, Any]]:
    """Load all KPI feedback examples.

    Returns an empty list if the file does not exist yet.
    """
    if not FEEDBACK_PATH.exists():
        return []

    items: List[Dict[str, Any]] = []
    with FEEDBACK_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except Exception:
                # Skip malformed lines
                continue
    return items
