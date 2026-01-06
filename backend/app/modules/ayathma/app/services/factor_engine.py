from __future__ import annotations

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

try:
    from factor_analyzer import FactorAnalyzer
except Exception:
    FactorAnalyzer = None


def _is_id_like_name(col: str) -> bool:
    c = col.strip().lower()
    return (
        c == "id"
        or c.endswith("_id")
        or c.endswith("id")
        or "uuid" in c
        or "guid" in c
        or "barcode" in c
        or c.endswith("_code")
        or c.endswith("code")
        or "product_id" in c
        or "customer_id" in c
        or "transaction_id" in c
        or "invoice_id" in c
        or "order_id" in c
    )


def _looks_like_surrogate_id(series: pd.Series, uniqueness_threshold: float = 0.98) -> bool:
    """
    Data-based heuristic to catch ID columns even if the name doesn't say "_id".
    Only applies to integer-like columns.

    Conditions:
    - Enough rows
    - Integer-like values
    - Uniqueness ratio is very high (almost unique per row)
    - Range is "wide enough" relative to N (helps avoid dropping real measures)
    """
    s = series.dropna()
    n = int(s.shape[0])
    if n < 50:
        return False

    is_int = pd.api.types.is_integer_dtype(s.dtype)

    is_float = pd.api.types.is_float_dtype(s.dtype)
    is_whole_number_float = False
    if is_float:
        sample = s.head(200).astype(float)
        is_whole_number_float = bool(np.all(np.isclose(sample, np.round(sample))))

    if not (is_int or is_whole_number_float):
        return False

    uniq = int(s.nunique(dropna=True))
    uniq_ratio = uniq / max(1, n)
    if uniq_ratio < uniqueness_threshold:
        return False

    try:
        smin = float(s.min())
        smax = float(s.max())
    except Exception:
        return False

    # If the range is tiny, it might be a legit integer measure, not an ID.
    if (smax - smin) < n:
        return False

    return True


def _select_numeric(df: pd.DataFrame, max_cols: int = 15) -> pd.DataFrame:
    num = df.select_dtypes(include=["number"]).copy()

    # 1) Drop obvious ID-like columns by name
    drop_by_name = [c for c in num.columns if _is_id_like_name(str(c))]
    if drop_by_name:
        num = num.drop(columns=drop_by_name, errors="ignore")

    # 2) Drop junk columns + surrogate IDs by behavior
    keep: List[str] = []
    for c in num.columns:
        s = num[c]

        if s.isna().mean() > 0.3:
            continue
        if s.dropna().nunique() <= 1:
            continue
        if _looks_like_surrogate_id(s):
            continue

        keep.append(c)

    num = num[keep]

    # Drop exact duplicate numeric columns
    if num.shape[1] > 1:
        num = num.loc[:, ~num.T.duplicated()]

    # Limit (keeps FA stable & fast)
    if num.shape[1] > max_cols:
        num = num.iloc[:, :max_cols]

    return num


def _drop_highly_correlated(num: pd.DataFrame, threshold: float = 0.999) -> pd.DataFrame:
    if num.shape[1] < 2:
        return num

    corr = num.corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    to_drop = [c for c in upper.columns if any(upper[c] > threshold)]
    return num.drop(columns=to_drop, errors="ignore")


def _safe_list(x: Any) -> Optional[List[float]]:
    if x is None:
        return None
    try:
        return [float(v) for v in x]
    except Exception:
        return None


def run_factor_analysis(df: pd.DataFrame, n_factors: int = 3) -> Dict[str, Any]:
    if FactorAnalyzer is None:
        return {
            "ok": False,
            "reason": "factor-analyzer not installed",
            "numeric_used": [],
            "factors": [],
            "loadings": {},
            "scores": [],
        }

    num = _select_numeric(df)
    if num.shape[1] < 3:
        return {
            "ok": False,
            "reason": "Not enough usable numeric columns for factor analysis (need at least 3).",
            "numeric_used": [],
            "factors": [],
            "loadings": {},
            "scores": [],
        }

    # Fill missing with median
    num = num.apply(lambda s: s.fillna(s.median()), axis=0)

    # Prevent singular correlation matrix
    num = _drop_highly_correlated(num, threshold=0.999)
    if num.shape[1] < 3:
        return {
            "ok": False,
            "reason": "Not enough columns after removing highly correlated/duplicate columns.",
            "numeric_used": [],
            "factors": [],
            "loadings": {},
            "scores": [],
        }

    Xs = StandardScaler().fit_transform(num.values)

    # Clamp n_factors
    max_factors = max(1, Xs.shape[1] - 1)
    n_factors = int(max(1, min(n_factors, max_factors)))

    try:
        fa = FactorAnalyzer(n_factors=n_factors, rotation="varimax")
        fa.fit(Xs)

        L = fa.loadings_  # (n_features, n_factors)
        col_names = [str(c) for c in num.columns.tolist()]
        factor_names = [f"Factor{i+1}" for i in range(L.shape[1])]

        # IMPORTANT: return dict-of-dicts so smart_kpis.py can do loadings[col][factor]
        loadings_dict: Dict[str, Dict[str, float]] = {}
        for i, col in enumerate(col_names):
            loadings_dict[col] = {}
            for j, fac in enumerate(factor_names):
                loadings_dict[col][fac] = float(L[i, j])

        scores_arr = fa.transform(Xs)  # (n_rows, n_factors)
        scores_payload: List[Dict[str, float]] = []
        for i in range(scores_arr.shape[0]):
            scores_payload.append(
                {f"{factor_names[j]}_score": float(scores_arr[i, j]) for j in range(scores_arr.shape[1])}
            )

        explained_variance = None
        try:
            ev = fa.get_factor_variance()
            if isinstance(ev, (list, tuple)) and len(ev) == 3:
                variance = _safe_list(ev[0])
                proportion = _safe_list(ev[1])
                cumulative = _safe_list(ev[2])
                if variance and proportion and cumulative:
                    explained_variance = {
                        "variance": variance,
                        "proportion": proportion,
                        "cumulative": cumulative,
                    }
        except Exception:
            explained_variance = None

        return {
            "ok": True,
            "numeric_used": col_names,
            "factors": factor_names,
            "loadings": loadings_dict,
            "scores": scores_payload,
            "explained_variance": explained_variance,
        }

    except Exception as e:
        return {
            "ok": False,
            "reason": f"Factor analysis failed: {type(e).__name__}: {str(e)}",
            "numeric_used": [],
            "factors": [],
            "loadings": {},
            "scores": [],
        }
