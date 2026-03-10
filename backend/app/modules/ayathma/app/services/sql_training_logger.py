"""
SQL Training Logger
===================

Stores user corrections to generated SQL queries for future learning.
This enables the system to improve its SQL generation over time.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


# Resolve training data file relative to this module
_BASE_DIR = Path(__file__).resolve().parents[2] / "ml"
_BASE_DIR.mkdir(parents=True, exist_ok=True)
SQL_TRAIN_PATH = _BASE_DIR / "sql_training_data.jsonl"


def append_sql_correction(
    card_id: str,
    card_title: str,
    chart_type: str,
    x_column: Optional[str],
    y_column: Optional[str],
    original_sql: str,
    corrected_sql: str,
    dataset_name: str,
    columns: List[str],
    feedback: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Save a SQL correction example for training.
    
    Args:
        card_id: Unique identifier for the insight card type
        card_title: Human-readable title of the card
        chart_type: Type of chart (bar, line, etc.)
        x_column: X-axis column name
        y_column: Y-axis column name (measure)
        original_sql: The system-generated SQL
        corrected_sql: The user-corrected SQL
        dataset_name: Name of the dataset file
        columns: List of all column names in the dataset
        feedback: Optional user feedback about what was wrong
        
    Returns:
        The saved example dict
    """
    example = {
        "card_id": card_id,
        "card_title": card_title,
        "chart_type": chart_type,
        "x_column": x_column,
        "y_column": y_column,
        "original_sql": original_sql,
        "corrected_sql": corrected_sql,
        "dataset_name": dataset_name,
        "columns": columns,
        "feedback": feedback,
        "saved_at": datetime.utcnow().isoformat(),
    }
    
    with SQL_TRAIN_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(example, ensure_ascii=False) + "\n")
    
    return example


def load_sql_corrections() -> List[Dict[str, Any]]:
    """Load all SQL correction examples from the JSONL file."""
    if not SQL_TRAIN_PATH.exists():
        return []
    
    examples: List[Dict[str, Any]] = []
    with SQL_TRAIN_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                examples.append(json.loads(line))
            except Exception:
                continue
    return examples


def get_corrections_for_card_type(card_id: str) -> List[Dict[str, Any]]:
    """Get all corrections for a specific card type."""
    all_corrections = load_sql_corrections()
    return [c for c in all_corrections if c.get("card_id") == card_id]


def find_similar_correction(
    card_id: str,
    chart_type: str,
    x_column: Optional[str],
    y_column: Optional[str],
) -> Optional[str]:
    """
    Find a previously corrected SQL that matches the current card context.
    
    This is a simple lookup - can be enhanced with ML matching later.
    
    Returns:
        The corrected SQL if a match is found, None otherwise
    """
    corrections = load_sql_corrections()
    
    for correction in reversed(corrections):  # Most recent first
        if (
            correction.get("card_id") == card_id
            and correction.get("chart_type") == chart_type
            and correction.get("x_column") == x_column
            and correction.get("y_column") == y_column
        ):
            return correction.get("corrected_sql")
    
    return None


def delete_sql_corrections_for_dataset(dataset_name: str) -> int:
    """Delete all SQL corrections for a given dataset."""
    corrections = load_sql_corrections()
    if not corrections:
        return 0
    
    kept = [c for c in corrections if c.get("dataset_name") != dataset_name]
    removed = len(corrections) - len(kept)
    
    if removed > 0:
        with SQL_TRAIN_PATH.open("w", encoding="utf-8") as f:
            for ex in kept:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    
    return removed


def get_sql_training_stats() -> Dict[str, Any]:
    """Get statistics about SQL training data."""
    corrections = load_sql_corrections()
    
    if not corrections:
        return {
            "total_corrections": 0,
            "unique_card_types": 0,
            "unique_datasets": 0,
            "by_card_type": {},
        }
    
    card_types = {}
    datasets = set()
    
    for c in corrections:
        card_id = c.get("card_id", "unknown")
        card_types[card_id] = card_types.get(card_id, 0) + 1
        datasets.add(c.get("dataset_name", "unknown"))
    
    return {
        "total_corrections": len(corrections),
        "unique_card_types": len(card_types),
        "unique_datasets": len(datasets),
        "by_card_type": card_types,
    }
