from __future__ import annotations

from typing import Dict, Any, List
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


def create_smart_kpis(df: pd.DataFrame, fa_result: Dict[str, Any]) -> Dict[str, Any]:
    if not fa_result.get("ok"):
        return {
            "ok": False,
            "reason": fa_result.get("reason", "FA failed"),
            "smart_kpis": {},
            "formulas": {},
        }

    cols: List[str] = list(fa_result.get("numeric_used", []))
    factors: List[str] = list(fa_result.get("factors", []))
    loadings: Dict[str, Dict[str, float]] = dict(fa_result.get("loadings", {}))

    # Keep only columns that exist in df AND exist in loadings
    cols = [c for c in cols if c in df.columns and c in loadings]

    if not cols or not factors:
        return {
            "ok": True,
            "smart_kpis": {},
            "formulas": {},
            "warnings": ["No usable columns/factors to compute smart KPIs."],
        }

    num = df[cols].copy()

    # Force numeric + fill missing
    for c in cols:
        num[c] = pd.to_numeric(num[c], errors="coerce")
        med = num[c].median()
        if pd.isna(med):
            num[c] = num[c].fillna(0.0)
        else:
            num[c] = num[c].fillna(med)

    Xs = StandardScaler().fit_transform(num.values)

    smart: Dict[str, float] = {}
    formulas: Dict[str, Any] = {}
    warnings: List[str] = []

    for f in factors:
        # Keep only cols that have a loading for this factor
        valid_cols = [c for c in cols if f in loadings.get(c, {})]
        if not valid_cols:
            warnings.append(f"Skipped {f}: no valid columns found in loadings.")
            continue

        weights = np.array([loadings[c][f] for c in valid_cols], dtype=float)
        denom = float(np.sum(np.abs(weights)))
        if denom == 0.0:
            warnings.append(f"Skipped {f}: weights sum to zero.")
            continue

        w = weights / denom

        idxs = [valid_cols.index(c) for c in valid_cols]  # local alignment
        # But Xs is aligned to 'cols', not valid_cols; build correct indices:
        idxs = [cols.index(c) for c in valid_cols]
        score = Xs[:, idxs] @ w
        smart[f"smart_{f}"] = float(np.mean(score))

        formulas[f"smart_{f}"] = {
            "type": "factor_weighted_sum",
            "factor": f,
            "weights": {c: float(loadings[c][f]) for c in valid_cols},
            "numeric_used": valid_cols,
            "normalization": "sum_abs_weights",
        }

    out = {"ok": True, "smart_kpis": smart, "formulas": formulas}
    if warnings:
        out["warnings"] = warnings
    return out
