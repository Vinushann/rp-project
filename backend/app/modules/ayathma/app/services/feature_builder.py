from __future__ import annotations

from typing import Any, Dict, List
import numpy as np
import re


_MONEY_HINTS = ["price", "amount", "revenue", "sales", "total", "gmv", "net", "value"]
_COST_HINTS = ["cost", "cogs"]
_QTY_HINTS = ["qty", "quantity", "units", "count"]
_TIME_HINTS = ["date", "time", "day", "month", "year"]
_PRODUCT_HINTS = ["product", "item", "sku", "food", "name"]
_PAYMENT_HINTS = ["payment", "card", "cash", "method", "mode"]
_CHANNEL_HINTS = ["channel", "order type", "source", "platform"]
_FINANCE_HINTS = ["debit", "credit", "merchant", "txn", "transaction"]
_INVENTORY_HINTS = ["stock", "warehouse", "inventory", "on hand", "reorder", "location"]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _count_hint(columns: List[str], hints: List[str]) -> int:
    c = 0
    cols = [_norm(x) for x in columns]
    for col in cols:
        if any(h in col for h in hints):
            c += 1
    return c


def build_dataset_features(columns: List[str], semantic: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
    rows = int(profile.get("rows", 0) or 0)
    cols = int(profile.get("cols", len(columns)) or len(columns))

    numeric_cols = semantic.get("numeric_cols", []) or []
    categorical_cols = semantic.get("categorical_cols", []) or []
    datetime_cols = semantic.get("datetime_cols", []) or []

    missing_by_col = profile.get("missing_by_col", {}) or {}
    if rows > 0 and missing_by_col:
        avg_missing_rate = float(np.mean([v / rows for v in missing_by_col.values()]))
    else:
        avg_missing_rate = 0.0

    # text signal counts
    money_word_count = _count_hint(columns, _MONEY_HINTS)
    cost_word_count = _count_hint(columns, _COST_HINTS)
    qty_word_count = _count_hint(columns, _QTY_HINTS)
    time_word_count = _count_hint(columns, _TIME_HINTS)
    product_word_count = _count_hint(columns, _PRODUCT_HINTS)
    payment_word_count = _count_hint(columns, _PAYMENT_HINTS)
    channel_word_count = _count_hint(columns, _CHANNEL_HINTS)
    finance_word_count = _count_hint(columns, _FINANCE_HINTS)
    inventory_word_count = _count_hint(columns, _INVENTORY_HINTS)

    return {
        "column_names_text": " ".join([_norm(c) for c in columns]),
        "rows": rows,
        "cols": cols,
        "n_numeric": len(numeric_cols),
        "n_categorical": len(categorical_cols),
        "n_datetime": len(datetime_cols),
        "avg_missing_rate": avg_missing_rate,
        "money_word_count": money_word_count,
        "cost_word_count": cost_word_count,
        "qty_word_count": qty_word_count,
        "time_word_count": time_word_count,
        "product_word_count": product_word_count,
        "payment_word_count": payment_word_count,
        "channel_word_count": channel_word_count,
        "finance_word_count": finance_word_count,
        "inventory_word_count": inventory_word_count,
    }
