"""
Comparative Analysis Service
============================

Enables comparison between:
- Time periods (this month vs last month)
- Segments (branch A vs branch B)  
- Before/After scenarios

Calculates deltas, percentage changes, and statistical significance.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from scipy import stats


@dataclass
class MetricComparison:
    """Comparison result for a single metric."""
    metric: str
    period_a_value: float
    period_b_value: float
    absolute_change: float
    pct_change: float
    direction: str  # 'up', 'down', 'stable'
    significance: str  # 'significant', 'marginal', 'not_significant'
    p_value: Optional[float]


@dataclass  
class ComparisonResult:
    """Complete comparison analysis result."""
    comparison_type: str  # 'period', 'segment', 'custom'
    period_a_label: str
    period_b_label: str
    period_a_rows: int
    period_b_rows: int
    metrics: List[MetricComparison]
    summary: Dict[str, Any]
    insights: List[str]


def _calculate_pct_change(old: float, new: float) -> float:
    """Calculate percentage change, handling zero division."""
    if old == 0:
        return 100.0 if new > 0 else (-100.0 if new < 0 else 0.0)
    return ((new - old) / abs(old)) * 100


def _determine_significance(series_a: pd.Series, series_b: pd.Series) -> Tuple[str, Optional[float]]:
    """Perform t-test to determine statistical significance."""
    clean_a = series_a.dropna()
    clean_b = series_b.dropna()
    
    if len(clean_a) < 2 or len(clean_b) < 2:
        return 'not_significant', None
    
    try:
        # Welch's t-test (doesn't assume equal variance)
        t_stat, p_value = stats.ttest_ind(clean_a, clean_b, equal_var=False)
        
        if p_value < 0.01:
            return 'significant', float(p_value)
        elif p_value < 0.05:
            return 'marginal', float(p_value)
        else:
            return 'not_significant', float(p_value)
    except Exception:
        return 'not_significant', None


def _generate_insights(metrics: List[MetricComparison], period_a: str, period_b: str) -> List[str]:
    """Generate human-readable insights from comparison."""
    insights = []
    
    # Find biggest changes
    significant_changes = [m for m in metrics if m.significance == 'significant']
    
    for m in significant_changes[:3]:  # Top 3 significant changes
        if m.direction == 'up':
            insights.append(
                f"📈 {m.metric} increased by {abs(m.pct_change):.1f}% from {period_a} to {period_b}"
            )
        elif m.direction == 'down':
            insights.append(
                f"📉 {m.metric} decreased by {abs(m.pct_change):.1f}% from {period_a} to {period_b}"
            )
    
    # Overall trend
    up_count = sum(1 for m in metrics if m.direction == 'up')
    down_count = sum(1 for m in metrics if m.direction == 'down')
    
    if up_count > down_count * 2:
        insights.append(f"✅ Overall positive trend: {up_count} metrics improved vs {down_count} declined")
    elif down_count > up_count * 2:
        insights.append(f"⚠️ Overall negative trend: {down_count} metrics declined vs {up_count} improved")
    else:
        insights.append(f"➡️ Mixed results: {up_count} metrics up, {down_count} down")
    
    if not insights:
        insights.append("No significant changes detected between the two periods")
    
    return insights


def compare_periods(
    df: pd.DataFrame,
    time_col: str,
    measure_cols: List[str],
    period_a_start: str,
    period_a_end: str,
    period_b_start: str,
    period_b_end: str,
    aggregation: str = 'sum'
) -> Dict[str, Any]:
    """
    Compare metrics between two time periods.
    
    Args:
        df: Input DataFrame
        time_col: DateTime column name
        measure_cols: Columns to compare
        period_a_start/end: First period date range
        period_b_start/end: Second period date range
        aggregation: 'sum', 'mean', 'count'
        
    Returns:
        Comparison results with metrics and insights
    """
    # Parse dates
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    
    period_a_start = pd.to_datetime(period_a_start)
    period_a_end = pd.to_datetime(period_a_end)
    period_b_start = pd.to_datetime(period_b_start)
    period_b_end = pd.to_datetime(period_b_end)
    
    # Filter data
    mask_a = (df[time_col] >= period_a_start) & (df[time_col] <= period_a_end)
    mask_b = (df[time_col] >= period_b_start) & (df[time_col] <= period_b_end)
    
    df_a = df[mask_a]
    df_b = df[mask_b]
    
    if len(df_a) == 0 or len(df_b) == 0:
        return {
            "error": "One or both periods have no data",
            "period_a_rows": len(df_a),
            "period_b_rows": len(df_b)
        }
    
    # Compare metrics
    metrics = []
    agg_func = {'sum': 'sum', 'mean': 'mean', 'count': 'count'}.get(aggregation, 'sum')
    
    for col in measure_cols:
        if col not in df.columns:
            continue
            
        if not pd.api.types.is_numeric_dtype(df[col]):
            continue
        
        val_a = getattr(df_a[col], agg_func)()
        val_b = getattr(df_b[col], agg_func)()
        
        abs_change = val_b - val_a
        pct_change = _calculate_pct_change(val_a, val_b)
        
        # Determine direction
        if abs(pct_change) < 1:
            direction = 'stable'
        elif pct_change > 0:
            direction = 'up'
        else:
            direction = 'down'
        
        # Statistical significance
        significance, p_value = _determine_significance(df_a[col], df_b[col])
        
        metrics.append(MetricComparison(
            metric=col,
            period_a_value=float(val_a),
            period_b_value=float(val_b),
            absolute_change=float(abs_change),
            pct_change=round(pct_change, 2),
            direction=direction,
            significance=significance,
            p_value=round(p_value, 4) if p_value else None
        ))
    
    # Generate labels
    period_a_label = f"{period_a_start.strftime('%Y-%m-%d')} to {period_a_end.strftime('%Y-%m-%d')}"
    period_b_label = f"{period_b_start.strftime('%Y-%m-%d')} to {period_b_end.strftime('%Y-%m-%d')}"
    
    # Generate insights
    insights = _generate_insights(metrics, period_a_label, period_b_label)
    
    # Summary stats
    summary = {
        "total_metrics": len(metrics),
        "improved": sum(1 for m in metrics if m.direction == 'up'),
        "declined": sum(1 for m in metrics if m.direction == 'down'),
        "stable": sum(1 for m in metrics if m.direction == 'stable'),
        "significant_changes": sum(1 for m in metrics if m.significance == 'significant')
    }
    
    result = ComparisonResult(
        comparison_type='period',
        period_a_label=period_a_label,
        period_b_label=period_b_label,
        period_a_rows=len(df_a),
        period_b_rows=len(df_b),
        metrics=metrics,
        summary=summary,
        insights=insights
    )
    
    # Convert to dict
    result_dict = asdict(result)
    result_dict['metrics'] = [asdict(m) for m in metrics]
    
    return result_dict


def compare_segments(
    df: pd.DataFrame,
    segment_col: str,
    segment_a: str,
    segment_b: str,
    measure_cols: List[str],
    aggregation: str = 'sum'
) -> Dict[str, Any]:
    """
    Compare metrics between two segments (e.g., branches, categories).
    
    Args:
        df: Input DataFrame
        segment_col: Column containing segment identifiers
        segment_a/b: Segment values to compare
        measure_cols: Columns to compare
        aggregation: 'sum', 'mean', 'count'
        
    Returns:
        Comparison results with metrics and insights
    """
    if segment_col not in df.columns:
        return {"error": f"Column '{segment_col}' not found"}
    
    df_a = df[df[segment_col] == segment_a]
    df_b = df[df[segment_col] == segment_b]
    
    if len(df_a) == 0 or len(df_b) == 0:
        return {
            "error": "One or both segments have no data",
            "segment_a_rows": len(df_a),
            "segment_b_rows": len(df_b)
        }
    
    # Compare metrics
    metrics = []
    agg_func = {'sum': 'sum', 'mean': 'mean', 'count': 'count'}.get(aggregation, 'sum')
    
    for col in measure_cols:
        if col not in df.columns:
            continue
            
        if not pd.api.types.is_numeric_dtype(df[col]):
            continue
        
        val_a = getattr(df_a[col], agg_func)()
        val_b = getattr(df_b[col], agg_func)()
        
        abs_change = val_b - val_a
        pct_change = _calculate_pct_change(val_a, val_b)
        
        if abs(pct_change) < 1:
            direction = 'stable'
        elif pct_change > 0:
            direction = 'up'
        else:
            direction = 'down'
        
        significance, p_value = _determine_significance(df_a[col], df_b[col])
        
        metrics.append(MetricComparison(
            metric=col,
            period_a_value=float(val_a),
            period_b_value=float(val_b),
            absolute_change=float(abs_change),
            pct_change=round(pct_change, 2),
            direction=direction,
            significance=significance,
            p_value=round(p_value, 4) if p_value else None
        ))
    
    insights = _generate_insights(metrics, str(segment_a), str(segment_b))
    
    summary = {
        "total_metrics": len(metrics),
        "segment_a_higher": sum(1 for m in metrics if m.direction == 'down'),
        "segment_b_higher": sum(1 for m in metrics if m.direction == 'up'),
        "similar": sum(1 for m in metrics if m.direction == 'stable'),
        "significant_differences": sum(1 for m in metrics if m.significance == 'significant')
    }
    
    result = ComparisonResult(
        comparison_type='segment',
        period_a_label=str(segment_a),
        period_b_label=str(segment_b),
        period_a_rows=len(df_a),
        period_b_rows=len(df_b),
        metrics=metrics,
        summary=summary,
        insights=insights
    )
    
    result_dict = asdict(result)
    result_dict['metrics'] = [asdict(m) for m in metrics]
    
    return result_dict


def auto_compare_periods(
    df: pd.DataFrame,
    time_col: str,
    measure_cols: List[str]
) -> Dict[str, Any]:
    """
    Automatically compare recent period to previous period.
    Splits data in half or compares last week to previous week.
    
    Args:
        df: Input DataFrame
        time_col: DateTime column
        measure_cols: Columns to compare
        
    Returns:
        Comparison results
    """
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    df = df.dropna(subset=[time_col])
    
    if len(df) == 0:
        return {"error": "No valid datetime data"}
    
    min_date = df[time_col].min()
    max_date = df[time_col].max()
    date_range = (max_date - min_date).days
    
    if date_range >= 14:
        # Compare last 7 days to previous 7 days
        period_b_end = max_date
        period_b_start = max_date - pd.Timedelta(days=6)
        period_a_end = period_b_start - pd.Timedelta(days=1)
        period_a_start = period_a_end - pd.Timedelta(days=6)
    else:
        # Split in half
        mid_date = min_date + (max_date - min_date) / 2
        period_a_start = min_date
        period_a_end = mid_date
        period_b_start = mid_date + pd.Timedelta(days=1)
        period_b_end = max_date
    
    return compare_periods(
        df=df,
        time_col=time_col,
        measure_cols=measure_cols,
        period_a_start=str(period_a_start.date()),
        period_a_end=str(period_a_end.date()),
        period_b_start=str(period_b_start.date()),
        period_b_end=str(period_b_end.date())
    )


def get_available_comparisons(df: pd.DataFrame, time_col: Optional[str], categorical_cols: List[str]) -> Dict[str, Any]:
    """
    Analyze dataset and return available comparison options.
    
    Args:
        df: Input DataFrame
        time_col: DateTime column (if any)
        categorical_cols: Categorical columns for segment comparison
        
    Returns:
        Available comparison types and options
    """
    options = {
        "period_comparison": False,
        "segment_comparison": False,
        "segments": {}
    }
    
    # Check if period comparison is possible
    if time_col and time_col in df.columns:
        times = pd.to_datetime(df[time_col], errors='coerce').dropna()
        if len(times) > 0:
            date_range = (times.max() - times.min()).days
            if date_range >= 2:
                options["period_comparison"] = True
                options["date_range"] = {
                    "min": str(times.min().date()),
                    "max": str(times.max().date()),
                    "days": date_range
                }
    
    # Check segment comparison options
    for col in categorical_cols:
        if col in df.columns:
            unique_vals = df[col].dropna().unique()
            if 2 <= len(unique_vals) <= 50:  # Reasonable number of segments
                options["segment_comparison"] = True
                options["segments"][col] = [str(v) for v in unique_vals[:20]]  # Limit to 20
    
    return options
