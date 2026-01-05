"""
Data Quality Scoring Service
============================

Evaluates dataset quality across multiple dimensions:
- Completeness: Missing value analysis
- Validity: Data type consistency
- Uniqueness: Duplicate detection
- Outliers: Statistical anomalies
- Consistency: Value range checks

Returns an overall quality score (0-100) with detailed breakdowns.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np


@dataclass
class ColumnQuality:
    """Quality metrics for a single column."""
    column: str
    dtype: str
    completeness: float  # 0-100
    unique_ratio: float  # ratio of unique values
    outlier_count: int
    outlier_pct: float
    issues: List[str]


@dataclass
class DataQualityReport:
    """Complete data quality assessment."""
    overall_score: float  # 0-100
    completeness_score: float
    validity_score: float
    uniqueness_score: float
    consistency_score: float
    
    total_rows: int
    total_columns: int
    total_missing: int
    missing_pct: float
    duplicate_rows: int
    duplicate_pct: float
    
    column_quality: List[ColumnQuality]
    issues: List[Dict[str, Any]]
    recommendations: List[str]


def _detect_outliers_iqr(series: pd.Series) -> pd.Series:
    """Detect outliers using IQR method."""
    if not pd.api.types.is_numeric_dtype(series):
        return pd.Series([False] * len(series))
    
    clean = series.dropna()
    if len(clean) < 4:
        return pd.Series([False] * len(series))
    
    Q1 = clean.quantile(0.25)
    Q3 = clean.quantile(0.75)
    IQR = Q3 - Q1
    
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    
    return (series < lower) | (series > upper)


def _detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> pd.Series:
    """Detect outliers using Z-score method."""
    if not pd.api.types.is_numeric_dtype(series):
        return pd.Series([False] * len(series))
    
    clean = series.dropna()
    if len(clean) < 3 or clean.std() == 0:
        return pd.Series([False] * len(series))
    
    z_scores = np.abs((series - clean.mean()) / clean.std())
    return z_scores > threshold


def _assess_column_quality(df: pd.DataFrame, col: str) -> ColumnQuality:
    """Assess quality metrics for a single column."""
    series = df[col]
    issues = []
    
    # Completeness
    missing = series.isna().sum()
    completeness = (1 - missing / len(series)) * 100 if len(series) > 0 else 0
    
    if completeness < 50:
        issues.append(f"High missing rate ({100-completeness:.1f}%)")
    elif completeness < 90:
        issues.append(f"Moderate missing rate ({100-completeness:.1f}%)")
    
    # Uniqueness
    non_null = series.dropna()
    unique_ratio = len(non_null.unique()) / len(non_null) if len(non_null) > 0 else 0
    
    # Check for potential ID columns that should be unique
    if 'id' in col.lower() and unique_ratio < 1.0:
        issues.append("ID column has duplicates")
    
    # Outliers (for numeric columns)
    outlier_count = 0
    outlier_pct = 0.0
    
    if pd.api.types.is_numeric_dtype(series):
        outliers = _detect_outliers_iqr(series)
        outlier_count = outliers.sum()
        outlier_pct = (outlier_count / len(series)) * 100 if len(series) > 0 else 0
        
        if outlier_pct > 10:
            issues.append(f"High outlier rate ({outlier_pct:.1f}%)")
        elif outlier_pct > 5:
            issues.append(f"Moderate outliers ({outlier_pct:.1f}%)")
    
    # Data type issues
    dtype_str = str(series.dtype)
    if series.dtype == 'object':
        # Check if it should be numeric
        numeric_count = pd.to_numeric(series, errors='coerce').notna().sum()
        if numeric_count > len(non_null) * 0.8:
            issues.append("Column appears numeric but stored as text")
        
        # Check if it should be datetime
        try:
            datetime_count = pd.to_datetime(series, errors='coerce').notna().sum()
            if datetime_count > len(non_null) * 0.8:
                issues.append("Column appears to be datetime but stored as text")
        except:
            pass
    
    return ColumnQuality(
        column=col,
        dtype=dtype_str,
        completeness=round(completeness, 2),
        unique_ratio=round(unique_ratio, 4),
        outlier_count=int(outlier_count),
        outlier_pct=round(outlier_pct, 2),
        issues=issues
    )


def assess_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Perform comprehensive data quality assessment.
    
    Args:
        df: Input DataFrame
        
    Returns:
        Dictionary containing quality scores and detailed analysis
    """
    if df.empty:
        return {
            "overall_score": 0,
            "message": "Empty dataset",
            "issues": [{"severity": "critical", "message": "Dataset is empty"}]
        }
    
    total_rows = len(df)
    total_cols = len(df.columns)
    
    # === Completeness Score ===
    total_cells = total_rows * total_cols
    total_missing = df.isna().sum().sum()
    missing_pct = (total_missing / total_cells) * 100 if total_cells > 0 else 0
    completeness_score = max(0, 100 - missing_pct * 2)  # Penalize missing values
    
    # === Validity Score ===
    # Check for proper data types
    validity_issues = 0
    for col in df.columns:
        if df[col].dtype == 'object':
            non_null = df[col].dropna()
            if len(non_null) > 0:
                # Check if should be numeric
                numeric_ratio = pd.to_numeric(non_null, errors='coerce').notna().mean()
                if numeric_ratio > 0.8:
                    validity_issues += 1
    
    validity_score = max(0, 100 - (validity_issues / total_cols) * 50) if total_cols > 0 else 100
    
    # === Uniqueness Score ===
    duplicate_rows = df.duplicated().sum()
    duplicate_pct = (duplicate_rows / total_rows) * 100 if total_rows > 0 else 0
    uniqueness_score = max(0, 100 - duplicate_pct * 2)
    
    # === Consistency Score ===
    # Check for consistent value ranges in numeric columns
    consistency_issues = 0
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) > 0:
            # Check for negative values in typically positive columns
            if any(kw in col.lower() for kw in ['price', 'amount', 'quantity', 'count', 'total', 'revenue', 'sales']):
                if (series < 0).any():
                    consistency_issues += 1
            
            # Check for extreme outliers
            outliers = _detect_outliers_zscore(series, threshold=4.0)
            if outliers.mean() > 0.05:  # More than 5% extreme outliers
                consistency_issues += 1
    
    consistency_score = max(0, 100 - (consistency_issues / max(len(numeric_cols), 1)) * 30)
    
    # === Overall Score ===
    overall_score = (
        completeness_score * 0.35 +
        validity_score * 0.25 +
        uniqueness_score * 0.20 +
        consistency_score * 0.20
    )
    
    # === Column-level Quality ===
    column_quality = [_assess_column_quality(df, col) for col in df.columns]
    
    # === Issues List ===
    issues = []
    
    if missing_pct > 20:
        issues.append({
            "severity": "high",
            "category": "completeness",
            "message": f"High missing data rate: {missing_pct:.1f}% of values are missing"
        })
    elif missing_pct > 5:
        issues.append({
            "severity": "medium",
            "category": "completeness", 
            "message": f"Moderate missing data: {missing_pct:.1f}% of values are missing"
        })
    
    if duplicate_pct > 10:
        issues.append({
            "severity": "high",
            "category": "uniqueness",
            "message": f"High duplicate rate: {duplicate_pct:.1f}% duplicate rows"
        })
    elif duplicate_pct > 1:
        issues.append({
            "severity": "medium",
            "category": "uniqueness",
            "message": f"Some duplicate rows detected: {duplicate_pct:.1f}%"
        })
    
    # Add column-specific issues
    for cq in column_quality:
        for issue in cq.issues:
            issues.append({
                "severity": "medium" if "High" in issue else "low",
                "category": "column",
                "column": cq.column,
                "message": issue
            })
    
    # === Recommendations ===
    recommendations = []
    
    if missing_pct > 10:
        high_missing_cols = [cq.column for cq in column_quality if cq.completeness < 80]
        if high_missing_cols:
            recommendations.append(
                f"Consider handling missing values in: {', '.join(high_missing_cols[:5])}"
            )
    
    if duplicate_pct > 1:
        recommendations.append(
            f"Review and remove {duplicate_rows} duplicate rows if unintentional"
        )
    
    outlier_cols = [cq.column for cq in column_quality if cq.outlier_pct > 5]
    if outlier_cols:
        recommendations.append(
            f"Review outliers in columns: {', '.join(outlier_cols[:5])}"
        )
    
    type_issue_cols = [cq.column for cq in column_quality 
                       if any("stored as text" in i for i in cq.issues)]
    if type_issue_cols:
        recommendations.append(
            f"Convert data types for: {', '.join(type_issue_cols[:5])}"
        )
    
    if not recommendations:
        recommendations.append("Data quality looks good! No major issues detected.")
    
    # === Build Report ===
    report = DataQualityReport(
        overall_score=round(overall_score, 1),
        completeness_score=round(completeness_score, 1),
        validity_score=round(validity_score, 1),
        uniqueness_score=round(uniqueness_score, 1),
        consistency_score=round(consistency_score, 1),
        total_rows=total_rows,
        total_columns=total_cols,
        total_missing=int(total_missing),
        missing_pct=round(missing_pct, 2),
        duplicate_rows=int(duplicate_rows),
        duplicate_pct=round(duplicate_pct, 2),
        column_quality=column_quality,
        issues=issues,
        recommendations=recommendations
    )
    
    # Convert to dict for JSON serialization
    result = asdict(report)
    result['column_quality'] = [asdict(cq) for cq in column_quality]
    
    # Add quality grade
    if overall_score >= 90:
        result['grade'] = 'A'
        result['grade_label'] = 'Excellent'
    elif overall_score >= 80:
        result['grade'] = 'B'
        result['grade_label'] = 'Good'
    elif overall_score >= 70:
        result['grade'] = 'C'
        result['grade_label'] = 'Fair'
    elif overall_score >= 60:
        result['grade'] = 'D'
        result['grade_label'] = 'Poor'
    else:
        result['grade'] = 'F'
        result['grade_label'] = 'Critical'
    
    return result
