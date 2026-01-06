"""
Advanced Chart Generators
=========================

Provides additional chart types beyond basic bar/line:
- Heatmap (e.g., sales by day of week and hour)
- Scatter plot for correlations
- Funnel chart for conversion analysis
- Treemap for hierarchical data
- Radar/Spider chart for multi-metric comparison
- Gauge chart for KPI vs target
- Waterfall chart for breakdown analysis
"""

from __future__ import annotations
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np


def generate_heatmap_data(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    value_col: str,
    aggregation: str = 'sum'
) -> Dict[str, Any]:
    """
    Generate heatmap data for two categorical/time dimensions.
    
    Args:
        df: Input DataFrame
        x_col: Column for x-axis (e.g., 'day_of_week')
        y_col: Column for y-axis (e.g., 'hour')
        value_col: Column to aggregate for intensity
        aggregation: 'sum', 'mean', 'count'
        
    Returns:
        Heatmap chart data structure
    """
    if x_col not in df.columns or y_col not in df.columns:
        return {"error": "Required columns not found"}
    
    agg_func = {'sum': 'sum', 'mean': 'mean', 'count': 'count'}.get(aggregation, 'sum')
    
    # Create pivot table
    pivot = pd.pivot_table(
        df,
        values=value_col,
        index=y_col,
        columns=x_col,
        aggfunc=agg_func,
        fill_value=0
    )
    
    # Convert to heatmap format
    x_labels = [str(c) for c in pivot.columns.tolist()]
    y_labels = [str(i) for i in pivot.index.tolist()]
    
    # Create data matrix
    data = []
    for i, y_label in enumerate(y_labels):
        for j, x_label in enumerate(x_labels):
            val = pivot.iloc[i, j]
            data.append({
                "x": x_label,
                "y": y_label,
                "value": float(val) if pd.notna(val) else 0
            })
    
    # Calculate min/max for color scale
    values = [d["value"] for d in data]
    
    return {
        "chart_type": "heatmap",
        "x_labels": x_labels,
        "y_labels": y_labels,
        "data": data,
        "min_value": min(values) if values else 0,
        "max_value": max(values) if values else 0,
        "x_title": x_col,
        "y_title": y_col,
        "value_title": value_col
    }


def generate_time_heatmap(
    df: pd.DataFrame,
    time_col: str,
    value_col: str,
    aggregation: str = 'sum'
) -> Dict[str, Any]:
    """
    Generate a heatmap showing activity by day of week and hour.
    
    Args:
        df: Input DataFrame
        time_col: DateTime column
        value_col: Value column to aggregate
        aggregation: 'sum', 'mean', 'count'
        
    Returns:
        Heatmap chart data for day/hour analysis
    """
    df = df.copy()
    df[time_col] = pd.to_datetime(df[time_col], errors='coerce')
    df = df.dropna(subset=[time_col])
    
    if len(df) == 0:
        return {"error": "No valid datetime data"}
    
    # Extract day of week and hour
    df['_dow'] = df[time_col].dt.day_name()
    df['_hour'] = df[time_col].dt.hour
    
    # Order days
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    df['_dow'] = pd.Categorical(df['_dow'], categories=day_order, ordered=True)
    
    agg_func = {'sum': 'sum', 'mean': 'mean', 'count': 'count'}.get(aggregation, 'sum')
    
    pivot = pd.pivot_table(
        df,
        values=value_col,
        index='_hour',
        columns='_dow',
        aggfunc=agg_func,
        fill_value=0
    )
    
    # Ensure all days are present
    for day in day_order:
        if day not in pivot.columns:
            pivot[day] = 0
    pivot = pivot[day_order]
    
    # Ensure all hours are present
    all_hours = list(range(24))
    pivot = pivot.reindex(all_hours, fill_value=0)
    
    data = []
    for hour in all_hours:
        for day in day_order:
            val = pivot.loc[hour, day] if hour in pivot.index else 0
            data.append({
                "x": day[:3],  # Abbreviated day name
                "y": f"{hour:02d}:00",
                "value": float(val) if pd.notna(val) else 0
            })
    
    values = [d["value"] for d in data]
    
    return {
        "chart_type": "heatmap",
        "title": f"{value_col} by Day and Hour",
        "x_labels": [d[:3] for d in day_order],
        "y_labels": [f"{h:02d}:00" for h in all_hours],
        "data": data,
        "min_value": min(values) if values else 0,
        "max_value": max(values) if values else 0,
        "x_title": "Day of Week",
        "y_title": "Hour",
        "value_title": value_col
    }


def generate_scatter_data(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    size_col: Optional[str] = None,
    color_col: Optional[str] = None,
    sample_size: int = 500
) -> Dict[str, Any]:
    """
    Generate scatter plot data for correlation visualization.
    
    Args:
        df: Input DataFrame
        x_col: Column for x-axis
        y_col: Column for y-axis
        size_col: Optional column for point size
        color_col: Optional column for point color/category
        sample_size: Max points to return
        
    Returns:
        Scatter chart data structure
    """
    if x_col not in df.columns or y_col not in df.columns:
        return {"error": "Required columns not found"}
    
    # Sample if too many points
    if len(df) > sample_size:
        df = df.sample(n=sample_size, random_state=42)
    
    # Calculate correlation
    x_numeric = pd.to_numeric(df[x_col], errors='coerce')
    y_numeric = pd.to_numeric(df[y_col], errors='coerce')
    
    valid_mask = x_numeric.notna() & y_numeric.notna()
    correlation = None
    if valid_mask.sum() >= 3:
        correlation = float(x_numeric[valid_mask].corr(y_numeric[valid_mask]))
    
    # Build data points
    points = []
    for idx, row in df.iterrows():
        x_val = row[x_col]
        y_val = row[y_col]
        
        if pd.isna(x_val) or pd.isna(y_val):
            continue
        
        point = {
            "x": float(x_val) if pd.api.types.is_numeric_dtype(type(x_val)) else str(x_val),
            "y": float(y_val) if pd.api.types.is_numeric_dtype(type(y_val)) else str(y_val),
        }
        
        if size_col and size_col in df.columns:
            size_val = row[size_col]
            point["size"] = float(size_val) if pd.notna(size_val) else 1
        
        if color_col and color_col in df.columns:
            point["category"] = str(row[color_col])
        
        points.append(point)
    
    return {
        "chart_type": "scatter",
        "points": points[:sample_size],
        "x_title": x_col,
        "y_title": y_col,
        "correlation": round(correlation, 3) if correlation else None,
        "correlation_strength": _correlation_strength(correlation) if correlation else "unknown"
    }


def _correlation_strength(r: float) -> str:
    """Describe correlation strength."""
    r = abs(r)
    if r >= 0.8:
        return "very strong"
    elif r >= 0.6:
        return "strong"
    elif r >= 0.4:
        return "moderate"
    elif r >= 0.2:
        return "weak"
    else:
        return "very weak"


def generate_funnel_data(
    df: pd.DataFrame,
    stages: List[Dict[str, str]],
    count_distinct_col: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate funnel chart data for conversion analysis.
    
    Args:
        df: Input DataFrame
        stages: List of stage definitions with 'name' and 'filter_col' 
        count_distinct_col: Column to count distinct values (e.g., user_id)
        
    Returns:
        Funnel chart data structure
    """
    funnel_data = []
    previous_count = None
    
    for stage in stages:
        name = stage.get('name', 'Stage')
        filter_col = stage.get('filter_col')
        filter_value = stage.get('filter_value')
        
        if filter_col and filter_col in df.columns:
            if filter_value:
                stage_df = df[df[filter_col] == filter_value]
            else:
                stage_df = df[df[filter_col].notna()]
        else:
            stage_df = df
        
        if count_distinct_col and count_distinct_col in df.columns:
            count = stage_df[count_distinct_col].nunique()
        else:
            count = len(stage_df)
        
        conversion = None
        if previous_count and previous_count > 0:
            conversion = (count / previous_count) * 100
        
        funnel_data.append({
            "stage": name,
            "count": int(count),
            "conversion": round(conversion, 1) if conversion else None
        })
        
        previous_count = count
    
    # Calculate overall conversion
    overall_conversion = None
    if len(funnel_data) >= 2 and funnel_data[0]['count'] > 0:
        overall_conversion = (funnel_data[-1]['count'] / funnel_data[0]['count']) * 100
    
    return {
        "chart_type": "funnel",
        "stages": funnel_data,
        "overall_conversion": round(overall_conversion, 1) if overall_conversion else None
    }


def generate_treemap_data(
    df: pd.DataFrame,
    category_cols: List[str],
    value_col: str,
    max_items: int = 50
) -> Dict[str, Any]:
    """
    Generate treemap data for hierarchical visualization.
    
    Args:
        df: Input DataFrame
        category_cols: Hierarchy of category columns (outer to inner)
        value_col: Column to aggregate for size
        max_items: Maximum number of items to return
        
    Returns:
        Treemap chart data structure
    """
    if not category_cols or value_col not in df.columns:
        return {"error": "Required columns not found"}
    
    # Use first category column for simple treemap
    cat_col = category_cols[0]
    if cat_col not in df.columns:
        return {"error": f"Column {cat_col} not found"}
    
    # Aggregate
    grouped = df.groupby(cat_col)[value_col].sum().sort_values(ascending=False)
    grouped = grouped.head(max_items)
    
    total = grouped.sum()
    
    items = []
    for cat, val in grouped.items():
        pct = (val / total * 100) if total > 0 else 0
        items.append({
            "name": str(cat),
            "value": float(val),
            "percentage": round(pct, 1)
        })
    
    return {
        "chart_type": "treemap",
        "items": items,
        "total": float(total),
        "category_column": cat_col,
        "value_column": value_col
    }


def generate_radar_data(
    df: pd.DataFrame,
    metrics: List[str],
    group_col: Optional[str] = None,
    groups: Optional[List[str]] = None,
    normalize: bool = True
) -> Dict[str, Any]:
    """
    Generate radar/spider chart data for multi-metric comparison.
    
    Args:
        df: Input DataFrame
        metrics: List of numeric columns to compare
        group_col: Optional column to group by
        groups: Specific groups to include
        normalize: Whether to normalize values to 0-100 scale
        
    Returns:
        Radar chart data structure
    """
    valid_metrics = [m for m in metrics if m in df.columns]
    if not valid_metrics:
        return {"error": "No valid metric columns found"}
    
    series_data = []
    
    if group_col and group_col in df.columns:
        # Multi-series radar
        if groups:
            unique_groups = groups
        else:
            unique_groups = df[group_col].dropna().unique()[:5]  # Limit to 5 groups
        
        for grp in unique_groups:
            grp_df = df[df[group_col] == grp]
            values = []
            for m in valid_metrics:
                val = grp_df[m].mean()
                values.append(float(val) if pd.notna(val) else 0)
            series_data.append({
                "name": str(grp),
                "values": values
            })
    else:
        # Single series radar
        values = []
        for m in valid_metrics:
            val = df[m].mean()
            values.append(float(val) if pd.notna(val) else 0)
        series_data.append({
            "name": "Overall",
            "values": values
        })
    
    # Normalize if requested
    if normalize and series_data:
        # Find min/max for each metric across all series
        all_values = list(zip(*[s["values"] for s in series_data]))
        min_vals = [min(vs) for vs in all_values]
        max_vals = [max(vs) for vs in all_values]
        
        for series in series_data:
            normalized = []
            for i, v in enumerate(series["values"]):
                range_val = max_vals[i] - min_vals[i]
                if range_val > 0:
                    normalized.append(round((v - min_vals[i]) / range_val * 100, 1))
                else:
                    normalized.append(50)  # Default to middle if no range
            series["values"] = normalized
    
    return {
        "chart_type": "radar",
        "metrics": valid_metrics,
        "series": series_data,
        "normalized": normalize
    }


def generate_gauge_data(
    current_value: float,
    target_value: float,
    min_value: float = 0,
    max_value: Optional[float] = None,
    metric_name: str = "KPI"
) -> Dict[str, Any]:
    """
    Generate gauge chart data for KPI vs target visualization.
    
    Args:
        current_value: Current metric value
        target_value: Target/goal value
        min_value: Minimum scale value
        max_value: Maximum scale value (defaults to target * 1.5)
        metric_name: Name of the metric
        
    Returns:
        Gauge chart data structure
    """
    if max_value is None:
        max_value = max(target_value * 1.5, current_value * 1.2)
    
    # Calculate percentage of target achieved
    target_pct = (current_value / target_value * 100) if target_value > 0 else 0
    
    # Determine status
    if target_pct >= 100:
        status = "achieved"
        status_color = "green"
    elif target_pct >= 80:
        status = "on_track"
        status_color = "yellow"
    else:
        status = "behind"
        status_color = "red"
    
    return {
        "chart_type": "gauge",
        "metric_name": metric_name,
        "current_value": float(current_value),
        "target_value": float(target_value),
        "min_value": float(min_value),
        "max_value": float(max_value),
        "target_percentage": round(target_pct, 1),
        "status": status,
        "status_color": status_color
    }


def generate_waterfall_data(
    df: pd.DataFrame,
    category_col: str,
    value_col: str,
    starting_label: str = "Starting",
    ending_label: str = "Total"
) -> Dict[str, Any]:
    """
    Generate waterfall chart data for breakdown analysis.
    
    Args:
        df: Input DataFrame
        category_col: Column for categories
        value_col: Column for values
        starting_label: Label for starting point
        ending_label: Label for ending total
        
    Returns:
        Waterfall chart data structure
    """
    if category_col not in df.columns or value_col not in df.columns:
        return {"error": "Required columns not found"}
    
    # Aggregate by category
    grouped = df.groupby(category_col)[value_col].sum()
    
    bars = []
    running_total = 0
    
    for cat, val in grouped.items():
        bars.append({
            "label": str(cat),
            "value": float(val),
            "running_total": float(running_total + val),
            "type": "positive" if val >= 0 else "negative"
        })
        running_total += val
    
    # Sort by absolute value for better visualization
    bars.sort(key=lambda x: abs(x["value"]), reverse=True)
    
    # Recalculate running totals after sort
    running_total = 0
    for bar in bars:
        running_total += bar["value"]
        bar["running_total"] = float(running_total)
    
    return {
        "chart_type": "waterfall",
        "bars": bars,
        "total": float(running_total),
        "category_column": category_col,
        "value_column": value_col
    }


def generate_donut_data(
    df: pd.DataFrame,
    category_col: str,
    value_col: str,
    max_slices: int = 8
) -> Dict[str, Any]:
    """
    Generate donut/pie chart data with an "Other" category for small slices.
    
    Args:
        df: Input DataFrame
        category_col: Column for categories
        value_col: Column for values
        max_slices: Maximum number of slices before grouping into "Other"
        
    Returns:
        Donut chart data structure
    """
    if category_col not in df.columns or value_col not in df.columns:
        return {"error": "Required columns not found"}
    
    grouped = df.groupby(category_col)[value_col].sum().sort_values(ascending=False)
    total = grouped.sum()
    
    slices = []
    other_value = 0
    
    for i, (cat, val) in enumerate(grouped.items()):
        pct = (val / total * 100) if total > 0 else 0
        
        if i < max_slices - 1:
            slices.append({
                "label": str(cat),
                "value": float(val),
                "percentage": round(pct, 1)
            })
        else:
            other_value += val
    
    if other_value > 0:
        other_pct = (other_value / total * 100) if total > 0 else 0
        slices.append({
            "label": "Other",
            "value": float(other_value),
            "percentage": round(other_pct, 1)
        })
    
    return {
        "chart_type": "donut",
        "slices": slices,
        "total": float(total),
        "center_label": value_col
    }
