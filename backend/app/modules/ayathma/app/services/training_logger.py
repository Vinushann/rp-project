from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


# Resolve training data file relative to this module so it works
# regardless of the FastAPI working directory.
_BASE_DIR = Path(__file__).resolve().parents[2] / "ml"
_BASE_DIR.mkdir(parents=True, exist_ok=True)
TRAIN_PATH = _BASE_DIR / "training_data.jsonl"


def append_training_example(example: Dict[str, Any]) -> None:
    """Append a single training example as JSONL.

    The example dict is enriched with a UTC timestamp.
    """
    example = dict(example)
    example["saved_at"] = datetime.utcnow().isoformat()

    with TRAIN_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(example, ensure_ascii=False) + "\n")


def load_training_examples() -> List[Dict[str, Any]]:
    """Load all training examples from the JSONL file.

    Returns an empty list if the file does not exist yet.
    """
    if not TRAIN_PATH.exists():
        return []

    examples: List[Dict[str, Any]] = []
    with TRAIN_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                examples.append(json.loads(line))
            except Exception:
                # Skip malformed lines but keep the rest
                continue
    return examples


def delete_training_examples_for_dataset(dataset_id: str) -> int:
    """Delete all training examples matching a given dataset_id.

    Returns the number of removed examples.
    """
    examples = load_training_examples()
    if not examples:
        return 0

    kept = [e for e in examples if str(e.get("dataset_id")) != str(dataset_id)]
    removed = len(examples) - len(kept)

    if removed > 0:
        with TRAIN_PATH.open("w", encoding="utf-8") as f:
            for ex in kept:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    return removed
