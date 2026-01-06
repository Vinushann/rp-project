from __future__ import annotations
from typing import Any, Dict, List, Tuple
import io
import csv


def flatten_kpis_for_csv(results: Dict[str, Any]) -> List[Tuple[str, str]]:
    """
    Turns nested results into (key, value) rows for CSV.
    Example key: "traditional.numeric_summary.amount.mean"
    """
    rows: List[Tuple[str, str]] = []

    def walk(prefix: str, obj: Any):
        if isinstance(obj, dict):
            for k, v in obj.items():
                walk(f"{prefix}.{k}" if prefix else str(k), v)
        elif isinstance(obj, list):
            # keep list as a compact string (or expand if you want later)
            rows.append((prefix, str(obj)))
        else:
            rows.append((prefix, str(obj)))

    walk("", results)
    return rows


def results_to_csv_bytes(results: Dict[str, Any]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["key", "value"])
    for k, v in flatten_kpis_for_csv(results):
        writer.writerow([k, v])
    return buf.getvalue().encode("utf-8")
