from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import re
import pandas as pd


@dataclass
class RolePick:
    col: Optional[str]
    score: float
    reason: str


ROLE_ORDER = [
    "REVENUE", "QUANTITY", "COST_AMOUNT", "DISCOUNT_AMOUNT",
    "DATE", "PRODUCT", "CATEGORY", "PAYMENT_METHOD", "CUSTOMER", "TRANSACTION_ID"
]

ROLE_KEYWORDS = {
    "REVENUE": [
        r"\brevenue\b", r"\bsales\b", r"\bamount\b", r"\btotal\b", r"\bnet\b", r"\bgross\b",
        r"\bgrand\s*total\b", r"\btotal\s*price\b", r"\bsales\s*amount\b"
    ],
    "QUANTITY": [r"\bqty\b", r"\bquantity\b", r"\bunits?\b", r"\bcount\b", r"\bitems?\b"],
    "COST_AMOUNT": [r"\bcost\b", r"\bcogs\b", r"\bunit\s*cost\b", r"\bpurchase\b"],
    "DISCOUNT_AMOUNT": [r"\bdiscount\b", r"\bpromo\b", r"\boff\b"],
    "DATE": [r"\bdate\b", r"\bdatetime\b", r"\btime\b", r"\btimestamp\b", r"\bcreated\b"],
    "PRODUCT": [r"\bproduct\b", r"\bitem\b", r"\bfood\b", r"\bmenu\b", r"\bsku\b", r"\bname\b"],
    "CATEGORY": [r"\bcategory\b", r"\btype\b", r"\bgroup\b", r"\bdept\b", r"\bsegment\b"],
    "PAYMENT_METHOD": [r"\bpayment\b", r"\bmethod\b", r"\bcard\b", r"\bcash\b", r"\bwallet\b"],
    "CUSTOMER": [r"\bcustomer\b", r"\bclient\b", r"\bmember\b", r"\buser\b"],
    "TRANSACTION_ID": [r"\btransaction\b", r"\border\b", r"\binvoice\b", r"\bbill\b", r"\bid\b", r"\bref\b"]
}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _keyword_score(colname: str, patterns: List[str]) -> float:
    name = _norm(colname)
    score = 0.0
    for p in patterns:
        if re.search(p, name):
            score += 2.0
    return score


def _numeric_usable(df: pd.DataFrame, col: str) -> bool:
    s = pd.to_numeric(df[col], errors="coerce")
    return s.notna().sum() >= max(5, int(0.2 * len(df)))


def _id_like(df: pd.DataFrame, col: str) -> bool:
    s = df[col].dropna()
    if len(s) == 0:
        return True
    uniq_ratio = s.nunique() / max(len(s), 1)
    return uniq_ratio > 0.98


def infer_roles(df: pd.DataFrame, semantic: Dict[str, Any]) -> Dict[str, RolePick]:
    numeric_cols = semantic.get("numeric_cols", []) or []
    cat_cols = semantic.get("categorical_cols", []) or []
    dt_cols = semantic.get("datetime_cols", []) or []

    roles: Dict[str, RolePick] = {}

    # DATE role: prefer semantic datetime cols
    if dt_cols:
        roles["DATE"] = RolePick(col=dt_cols[0], score=5.0, reason="Picked first inferred datetime column.")
    else:
        best = RolePick(None, 0.0, "No match")
        for c in df.columns:
            sc = _keyword_score(str(c), ROLE_KEYWORDS["DATE"])
            if sc > best.score:
                best = RolePick(str(c), sc, "Matched date keywords")
        if best.col:
            roles["DATE"] = best

    # Numeric roles
    for role in ["REVENUE", "QUANTITY", "COST_AMOUNT", "DISCOUNT_AMOUNT"]:
        best = RolePick(None, 0.0, "No match")
        for c in numeric_cols:
            if c not in df.columns:
                continue
            if role in ["REVENUE", "COST_AMOUNT"] and _id_like(df, c):
                continue
            if not _numeric_usable(df, c):
                continue

            sc = _keyword_score(c, ROLE_KEYWORDS[role])

            # small boost if values look "amount-like"
            if role in ["REVENUE", "COST_AMOUNT", "DISCOUNT_AMOUNT"]:
                s = pd.to_numeric(df[c], errors="coerce").dropna()
                if len(s) > 0 and s.max() > 50:
                    sc += 0.5

                # Strong preference for classic revenue column names like
                # "Sales_Amount", "Sales Amount", "Sales" or explicit "Revenue".
                if role == "REVENUE":
                    name_norm = _norm(str(c))
                    if (
                        "sales amount" in name_norm
                        or name_norm == "sales"
                        or "revenue" in name_norm
                    ):
                        sc += 5.0

            if sc > best.score:
                best = RolePick(c, sc, f"Best keyword match for {role}")

        roles[role] = best

    # Categorical roles
    for role in ["PRODUCT", "CATEGORY", "PAYMENT_METHOD", "CUSTOMER", "TRANSACTION_ID"]:
        best = RolePick(None, 0.0, "No match")

        # We iterate over likely categorical cols first, then all columns as fallback
        candidates = list(cat_cols) + [str(c) for c in df.columns.tolist()]
        seen = set()
        candidates = [c for c in candidates if not (c in seen or seen.add(c))]

        for c in candidates:
            if c not in df.columns:
                continue
            sc = _keyword_score(c, ROLE_KEYWORDS[role])
            if sc <= 0:
                continue

            if role == "TRANSACTION_ID":
                sc += 0.5 if _id_like(df, c) else 0.0

            if sc > best.score:
                best = RolePick(c, sc, f"Best keyword match for {role}")

        roles[role] = best

    return roles


def business_names(
    roles: Optional[Dict[str, Any]] = None,
    semantic: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    This fixes your error: now main.py can call:
        names = business_names(roles=roles, semantic=semantic.__dict__)

    Returns:
      {
        "role_labels": { ROLE: "Nice Name", ... },
        "ui": {
          "measure_label": "Revenue",
          "time_label": "Date",
          "dimension_label": "Product",
          "dimensions_label": "Products"
        }
      }
    """
    roles = roles or {}
    semantic = semantic or {}

    # Base role labels (what you already had)
    role_labels: Dict[str, str] = {
        "REVENUE": "Revenue",
        "QUANTITY": "Quantity",
        "COST_AMOUNT": "Cost",
        "DISCOUNT_AMOUNT": "Discount",
        "DATE": "Date",
        "PRODUCT": "Product",
        "CATEGORY": "Category",
        "PAYMENT_METHOD": "Payment Method",
        "CUSTOMER": "Customer",
        "TRANSACTION_ID": "Transaction",
    }

    # Helper: roles may be RolePick OR raw strings (depending on who calls)
    def _get_col(role_key: str) -> Optional[str]:
        v = roles.get(role_key)
        if v is None:
            return None
        # RolePick
        if hasattr(v, "col"):
            return getattr(v, "col")
        # dict-like (if roles were serialized)
        if isinstance(v, dict) and "col" in v:
            return v.get("col")
        # plain string
        if isinstance(v, str):
            return v
        return None

    # Decide measure label
    measure_label = "Measure"
    if _get_col("REVENUE"):
        measure_label = "Revenue"
    elif _get_col("COST_AMOUNT"):
        measure_label = "Cost"
    elif _get_col("QUANTITY"):
        measure_label = "Quantity"
    elif _get_col("DISCOUNT_AMOUNT"):
        measure_label = "Discount"

    # Decide time label
    time_label = "Time"
    if _get_col("DATE") or (semantic.get("datetime_cols") or []):
        time_label = "Date"

    # Decide dimension label (single) and plural (multi)
    dimension_label = "Category"
    dimensions_label = "Categories"
    if _get_col("PRODUCT"):
        dimension_label = "Product"
        dimensions_label = "Products"
    elif _get_col("CATEGORY"):
        dimension_label = "Category"
        dimensions_label = "Categories"
    elif _get_col("PAYMENT_METHOD"):
        dimension_label = "Payment Method"
        dimensions_label = "Payment Methods"
    elif _get_col("CUSTOMER"):
        dimension_label = "Customer"
        dimensions_label = "Customers"

    return {
        "role_labels": role_labels,
        "ui": {
            "measure_label": measure_label,
            "time_label": time_label,
            "dimension_label": dimension_label,
            "dimensions_label": dimensions_label,
        },
    }
