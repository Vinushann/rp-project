"""
Anomaly Detection Service
=========================

Detects anomalies in dataset using multiple methods:
- Statistical: Z-score, IQR, Modified Z-score
- Time-series: Sudden spikes/drops, trend deviations
- Categorical: Rare category detection
- Pattern: Unusual combinations, time-of-day anomalies

Returns flagged anomalies with severity and explanations.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime


@dataclass
class Anomaly:
    """Represents a detected anomaly."""
    anomaly_type: str  # 'outlier', 'spike', 'drop', 'pattern', 'rare'
    severity: str  # 'low', 'medium', 'high', 'critical'
    column: str
    description: str
    affected_rows: int
    affected_pct: float
    details: Dict[str, Any]


def _zscore_anomalies(series: pd.Series, threshold: float = 3.0) -> Tuple[pd.Series, Dict]:
    """Detect anomalies using Z-score method."""
    if not pd.api.types.is_numeric_dtype(series):
        return pd.Series([False] * len(series)), {}
    
    clean = series.dropna()
    if len(clean) < 3 or clean.std() == 0:
        return pd.Series([False] * len(series)), {}
    
    mean = clean.mean()
    std = clean.std()
    z_scores = (series - mean) / std
    
    anomalies = np.abs(z_scores) > threshold
    
    return anomalies, {
        "method": "zscore",
        "threshold": threshold,
        "mean": float(mean),
        "std": float(std)
    }


def _iqr_anomalies(series: pd.Series, multiplier: float = 1.5) -> Tuple[pd.Series, Dict]:
    """Detect anomalies using IQR method."""
    if not pd.api.types.is_numeric_dtype(series):
        return pd.Series([False] * len(series)), {}
    
    clean = series.dropna()
    if len(clean) < 4:
        return pd.Series([False] * len(series)), {}
    
    Q1 = clean.quantile(0.25)
    Q3 = clean.quantile(0.75)
    IQR = Q3 - Q1
    
    lower = Q1 - multiplier * IQR
    upper = Q3 + multiplier * IQR
    
    anomalies = (series < lower) | (series > upper)
    
    return anomalies, {
        "method": "iqr",
        "multiplier": multiplier,
        "lower_bound": float(lower),
        "upper_bound": float(upper),
        "Q1": float(Q1),
        "Q3": float(Q3)
    }


def _modified_zscore_anomalies(series: pd.Series, threshold: float = 3.5) -> Tuple[pd.Series, Dict]:
    """Detect anomalies using Modified Z-score (more robust to outliers)."""
    if not pd.api.types.is_numeric_dtype(series):
        return pd.Series([False] * len(series)), {}
    
    clean = series.dropna()
    if len(clean) < 3:
        return pd.Series([False] * len(series)), {}
    
    median = clean.median()
    mad = np.median(np.abs(clean - median))
    
    if mad == 0:
        return pd.Series([False] * len(series)), {}
    
    modified_z = 0.6745 * (series - median) / mad
    anomalies = np.abs(modified_z) > threshold
    
    return anomalies, {
        "method": "modified_zscore",
        "threshold": threshold,
        "median": float(median),
        "mad": float(mad)
    }


def _detect_time_anomalies(df: pd.DataFrame, time_col: str, measure_col: str) -> List[Anomaly]:
    """Detect time-series anomalies like spikes and drops."""
    anomalies = []
    
    if time_col not in df.columns or measure_col not in df.columns:
        return anomalies
    
    try:
        # Aggregate by time period
        temp_df = df[[time_col, measure_col]].copy()
        temp_df[time_col] = pd.to_datetime(temp_df[time_col], errors='coerce')
        temp_df = temp_df.dropna()
        
        if len(temp_df) < 7:
            return anomalies
        
        # Daily aggregation
        daily = temp_df.groupby(temp_df[time_col].dt.date)[measure_col].sum().reset_index()
        daily.columns = ['date', 'value']
        daily = daily.sort_values('date')
        
        if len(daily) < 3:
            return anomalies
        
        # Calculate rolling statistics
        daily['rolling_mean'] = daily['value'].rolling(window=7, min_periods=3).mean()
        daily['rolling_std'] = daily['value'].rolling(window=7, min_periods=3).std()
        
        # Detect spikes and drops
        daily['z_score'] = (daily['value'] - daily['rolling_mean']) / daily['rolling_std'].replace(0, np.nan)
        
        # Spikes (z > 2.5)
        spikes = daily[daily['z_score'] > 2.5]
        if len(spikes) > 0:
            for _, row in spikes.iterrows():
                anomalies.append(Anomaly(
                    anomaly_type='spike',
                    severity='high' if row['z_score'] > 3.5 else 'medium',
                    column=measure_col,
                    description=f"Unusual spike on {row['date']}: {row['value']:,.0f} (expected ~{row['rolling_mean']:,.0f})",
                    affected_rows=1,
                    affected_pct=round(100 / len(daily), 2),
                    details={
                        "date": str(row['date']),
                        "actual_value": float(row['value']),
                        "expected_value": float(row['rolling_mean']),
                        "z_score": round(float(row['z_score']), 2)
                    }
                ))
        
        # Drops (z < -2.5)
        drops = daily[daily['z_score'] < -2.5]
        if len(drops) > 0:
            for _, row in drops.iterrows():
                anomalies.append(Anomaly(
                    anomaly_type='drop',
                    severity='high' if row['z_score'] < -3.5 else 'medium',
                    column=measure_col,
                    description=f"Unusual drop on {row['date']}: {row['value']:,.0f} (expected ~{row['rolling_mean']:,.0f})",
                    affected_rows=1,
                    affected_pct=round(100 / len(daily), 2),
                    details={
                        "date": str(row['date']),
                        "actual_value": float(row['value']),
                        "expected_value": float(row['rolling_mean']),
                        "z_score": round(float(row['z_score']), 2)
                    }
                ))
        
        # Detect trend breaks
        if len(daily) >= 14:
            recent = daily['value'].tail(7).mean()
            previous = daily['value'].iloc[-14:-7].mean()
            
            if previous > 0:
                change_pct = ((recent - previous) / previous) * 100
                
                if abs(change_pct) > 30:
                    anomalies.append(Anomaly(
                        anomaly_type='trend_break',
                        severity='high' if abs(change_pct) > 50 else 'medium',
                        column=measure_col,
                        description=f"Significant trend change: {change_pct:+.1f}% week-over-week",
                        affected_rows=7,
                        affected_pct=round(700 / len(daily), 2),
                        details={
                            "recent_avg": float(recent),
                            "previous_avg": float(previous),
                            "change_pct": round(change_pct, 2)
                        }
                    ))
    
    except Exception as e:
        pass
    
    return anomalies


def _detect_rare_categories(series: pd.Series, threshold_pct: float = 1.0) -> List[Dict]:
    """Detect rare categorical values."""
    if pd.api.types.is_numeric_dtype(series):
        return []
    
    value_counts = series.value_counts(normalize=True) * 100
    rare = value_counts[value_counts < threshold_pct]
    
    return [
        {"value": str(val), "pct": round(pct, 3)}
        for val, pct in rare.items()
    ][:10]  # Limit to top 10


def _detect_time_pattern_anomalies(df: pd.DataFrame, time_col: str) -> List[Anomaly]:
    """Detect unusual time patterns (e.g., transactions at unusual hours)."""
    anomalies = []
    
    if time_col not in df.columns:
        return anomalies
    
    try:
        times = pd.to_datetime(df[time_col], errors='coerce')
        times = times.dropna()
        
        if len(times) < 100:
            return anomalies
        
        # Extract hour
        hours = times.dt.hour
        hour_counts = hours.value_counts(normalize=True) * 100
        
        # Detect unusual hours (late night activity)
        late_night = hour_counts.get(range(0, 5), pd.Series()).sum() if hasattr(hour_counts, 'get') else 0
        
        # Check hours 0-4 AM
        late_hours = [h for h in range(0, 5) if h in hour_counts.index]
        late_night_pct = hour_counts[late_hours].sum() if late_hours else 0
        
        if late_night_pct > 5:  # More than 5% in late night
            anomalies.append(Anomaly(
                anomaly_type='pattern',
                severity='medium',
                column=time_col,
                description=f"Unusual late-night activity: {late_night_pct:.1f}% of records between 12 AM - 5 AM",
                affected_rows=int(len(df) * late_night_pct / 100),
                affected_pct=round(late_night_pct, 2),
                details={
                    "hour_distribution": {str(h): round(hour_counts.get(h, 0), 2) for h in range(24) if h in hour_counts.index}
                }
            ))
    
    except Exception:
        pass
    
    return anomalies


def detect_anomalies(
    df: pd.DataFrame,
    time_col: Optional[str] = None,
    measure_col: Optional[str] = None,
    categorical_cols: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Comprehensive anomaly detection across the dataset.
    
    Args:
        df: Input DataFrame
        time_col: DateTime column for time-series analysis
        measure_col: Primary measure column (e.g., revenue)
        categorical_cols: Categorical columns to check for rare values
        
    Returns:
        Dictionary with detected anomalies and summary statistics
    """
    all_anomalies: List[Anomaly] = []
    column_summaries = {}
    
    # === Numeric Column Anomalies ===
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    for col in numeric_cols:
        series = df[col]
        
        # Use IQR method for outlier detection
        outliers, details = _iqr_anomalies(series)
        outlier_count = outliers.sum()
        
        if outlier_count > 0:
            outlier_pct = (outlier_count / len(series)) * 100
            
            # Determine severity
            if outlier_pct > 10:
                severity = 'high'
            elif outlier_pct > 5:
                severity = 'medium'
            else:
                severity = 'low'
            
            # Get example outlier values
            outlier_values = series[outliers].head(5).tolist()
            
            all_anomalies.append(Anomaly(
                anomaly_type='outlier',
                severity=severity,
                column=col,
                description=f"{outlier_count} outlier values detected ({outlier_pct:.1f}%)",
                affected_rows=int(outlier_count),
                affected_pct=round(outlier_pct, 2),
                details={
                    **details,
                    "example_values": [float(v) for v in outlier_values if pd.notna(v)]
                }
            ))
        
        # Store column summary
        column_summaries[col] = {
            "outlier_count": int(outlier_count),
            "outlier_pct": round((outlier_count / len(series)) * 100, 2) if len(series) > 0 else 0,
            "bounds": details
        }
    
    # === Time-Series Anomalies ===
    if time_col and measure_col:
        time_anomalies = _detect_time_anomalies(df, time_col, measure_col)
        all_anomalies.extend(time_anomalies)
        
        # Time pattern anomalies
        pattern_anomalies = _detect_time_pattern_anomalies(df, time_col)
        all_anomalies.extend(pattern_anomalies)
    
    # === Categorical Anomalies ===
    if categorical_cols:
        for col in categorical_cols:
            if col in df.columns:
                rare = _detect_rare_categories(df[col])
                if rare:
                    total_rare = sum(r['pct'] for r in rare)
                    all_anomalies.append(Anomaly(
                        anomaly_type='rare',
                        severity='low',
                        column=col,
                        description=f"{len(rare)} rare categories detected (each <1% of data)",
                        affected_rows=int(len(df) * total_rare / 100),
                        affected_pct=round(total_rare, 2),
                        details={"rare_values": rare}
                    ))
    
    # === Summary Statistics ===
    severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    type_counts = {'outlier': 0, 'spike': 0, 'drop': 0, 'trend_break': 0, 'pattern': 0, 'rare': 0}
    
    for a in all_anomalies:
        severity_counts[a.severity] = severity_counts.get(a.severity, 0) + 1
        type_counts[a.anomaly_type] = type_counts.get(a.anomaly_type, 0) + 1
    
    # Calculate overall anomaly score (0 = many anomalies, 100 = clean)
    total_severity_score = (
        severity_counts['critical'] * 25 +
        severity_counts['high'] * 10 +
        severity_counts['medium'] * 5 +
        severity_counts['low'] * 1
    )
    anomaly_score = max(0, 100 - total_severity_score)
    
    return {
        "anomaly_score": anomaly_score,
        "total_anomalies": len(all_anomalies),
        "severity_counts": severity_counts,
        "type_counts": type_counts,
        "anomalies": [asdict(a) for a in all_anomalies],
        "column_summaries": column_summaries,
        "has_critical": severity_counts['critical'] > 0,
        "has_high": severity_counts['high'] > 0
    }
