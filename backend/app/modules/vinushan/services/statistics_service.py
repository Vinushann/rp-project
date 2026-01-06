"""
Statistics Service
==================
Provides comprehensive statistics and analytics from sales data for dashboard visualizations.
"""

import os
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from collections import defaultdict

# Path to data file
DATA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(DATA_DIR, "data", "processed", "the_rossmann_coffee_shop_sales_dataset.csv")

# Fallback path
if not os.path.exists(DATA_FILE):
    DATA_FILE = os.path.join(DATA_DIR, "data", "the_rossmann_coffee_shop_sales_dataset.csv")


def load_sales_data() -> pd.DataFrame:
    """Load the sales data CSV file."""
    if not os.path.exists(DATA_FILE):
        raise FileNotFoundError(f"Sales data file not found at {DATA_FILE}")
    
    df = pd.read_csv(DATA_FILE, parse_dates=['system_date'])
    return df


def get_overview_statistics() -> Dict[str, Any]:
    """Get high-level overview statistics for the entire dataset."""
    df = load_sales_data()
    
    total_revenue = float(df['total_price'].sum())
    total_qty = int(df['qty'].sum())
    total_transactions = len(df)
    total_days = df['system_date'].dt.date.nunique()
    
    # Date range
    min_date = df['system_date'].min()
    max_date = df['system_date'].max()
    
    # Averages
    avg_daily_revenue = total_revenue / total_days if total_days > 0 else 0
    avg_daily_qty = total_qty / total_days if total_days > 0 else 0
    avg_order_value = total_revenue / total_transactions if total_transactions > 0 else 0
    
    return {
        "total_revenue": round(total_revenue, 2),
        "total_qty": total_qty,
        "total_transactions": total_transactions,
        "total_days": total_days,
        "avg_daily_revenue": round(avg_daily_revenue, 2),
        "avg_daily_qty": round(avg_daily_qty, 2),
        "avg_order_value": round(avg_order_value, 2),
        "date_range": {
            "start": str(min_date.date()) if pd.notna(min_date) else None,
            "end": str(max_date.date()) if pd.notna(max_date) else None,
        }
    }


def get_sales_trend_data(period: str = "daily", limit: int = 90) -> Dict[str, Any]:
    """
    Get sales trend data for charting.
    
    Args:
        period: 'daily', 'weekly', or 'monthly'
        limit: Number of periods to return
    """
    df = load_sales_data()
    df['date'] = pd.to_datetime(df['system_date']).dt.date
    
    if period == "daily":
        grouped = df.groupby('date').agg({
            'total_price': 'sum',
            'qty': 'sum',
            'gross_price': 'sum',
        }).reset_index()
        grouped = grouped.sort_values('date').tail(limit)
        
    elif period == "weekly":
        df['week'] = pd.to_datetime(df['system_date']).dt.to_period('W').dt.start_time.dt.date
        grouped = df.groupby('week').agg({
            'total_price': 'sum',
            'qty': 'sum',
            'gross_price': 'sum',
        }).reset_index()
        grouped = grouped.rename(columns={'week': 'date'})
        grouped = grouped.sort_values('date').tail(limit)
        
    elif period == "monthly":
        df['month'] = pd.to_datetime(df['system_date']).dt.to_period('M').dt.start_time.dt.date
        grouped = df.groupby('month').agg({
            'total_price': 'sum',
            'qty': 'sum',
            'gross_price': 'sum',
        }).reset_index()
        grouped = grouped.rename(columns={'month': 'date'})
        grouped = grouped.sort_values('date').tail(limit)
    else:
        raise ValueError(f"Invalid period: {period}")
    
    return {
        "period": period,
        "labels": [str(d) for d in grouped['date'].tolist()],
        "revenue": [round(v, 2) for v in grouped['total_price'].tolist()],
        "quantity": [int(v) for v in grouped['qty'].tolist()],
        "gross": [round(v, 2) for v in grouped['gross_price'].tolist()],
    }


def get_product_statistics() -> Dict[str, Any]:
    """Get product-level statistics for charts."""
    df = load_sales_data()
    
    # Top products by quantity
    top_by_qty = (
        df.groupby('food_name')['qty']
        .sum()
        .sort_values(ascending=False)
        .head(10)
    )
    
    # Top products by revenue
    top_by_revenue = (
        df.groupby('food_name')['total_price']
        .sum()
        .sort_values(ascending=False)
        .head(10)
    )
    
    # Product category distribution (extract category from name if possible)
    df['category'] = df['food_name'].apply(lambda x: x.split()[0] if pd.notna(x) else 'Other')
    category_dist = df.groupby('category')['qty'].sum().sort_values(ascending=False).head(8)
    
    return {
        "top_by_quantity": {
            "labels": top_by_qty.index.tolist(),
            "values": [int(v) for v in top_by_qty.values.tolist()],
        },
        "top_by_revenue": {
            "labels": top_by_revenue.index.tolist(),
            "values": [round(v, 2) for v in top_by_revenue.values.tolist()],
        },
        "category_distribution": {
            "labels": category_dist.index.tolist(),
            "values": [int(v) for v in category_dist.values.tolist()],
        }
    }


def get_order_type_statistics() -> Dict[str, Any]:
    """Get order type distribution statistics."""
    df = load_sales_data()
    
    order_dist = df.groupby('order_type').agg({
        'qty': 'sum',
        'total_price': 'sum',
    })
    
    # Calculate average order value per type
    order_counts = df.groupby('order_type').size()
    avg_order = order_dist['total_price'] / order_counts
    
    return {
        "distribution": {
            "labels": order_dist.index.tolist(),
            "orders": [int(v) for v in order_counts.tolist()],
            "quantity": [int(v) for v in order_dist['qty'].tolist()],
            "revenue": [round(v, 2) for v in order_dist['total_price'].tolist()],
            "avg_order": [round(v, 2) for v in avg_order.tolist()],
        }
    }


def get_calendar_statistics() -> Dict[str, Any]:
    """Get calendar-based statistics (day of week, hour, month patterns)."""
    df = load_sales_data()
    df['datetime'] = pd.to_datetime(df['system_date'])
    
    # Day of week analysis
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    df['day_of_week'] = df['datetime'].dt.dayofweek
    day_of_week = df.groupby('day_of_week').agg({
        'qty': 'sum',
        'total_price': 'sum',
    })
    day_of_week = day_of_week.reindex(range(7), fill_value=0)
    
    # Hour analysis (if order_time exists)
    hourly_data = None
    if 'order_time' in df.columns:
        try:
            df['hour'] = pd.to_datetime(df['order_time'], format='%H:%M:%S', errors='coerce').dt.hour
            hourly = df.groupby('hour').agg({
                'qty': 'sum',
                'total_price': 'sum',
            })
            hourly = hourly.reindex(range(24), fill_value=0)
            hourly_data = {
                "labels": [f"{h:02d}:00" for h in range(24)],
                "quantity": [int(v) for v in hourly['qty'].tolist()],
                "revenue": [round(v, 2) for v in hourly['total_price'].tolist()],
            }
        except Exception:
            pass
    
    # Monthly analysis
    df['month'] = df['datetime'].dt.month
    monthly = df.groupby('month').agg({
        'qty': 'sum',
        'total_price': 'sum',
    })
    monthly = monthly.reindex(range(1, 13), fill_value=0)
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    # Weekend vs Weekday
    weekend_data = df[df['day_of_week'].isin([5, 6])]
    weekday_data = df[~df['day_of_week'].isin([5, 6])]
    
    return {
        "day_of_week": {
            "labels": day_names,
            "orders": [int(v) for v in df.groupby('day_of_week').size().reindex(range(7), fill_value=0).tolist()],
            "quantity": [int(v) for v in day_of_week['qty'].tolist()],
            "revenue": [round(v, 2) for v in day_of_week['total_price'].tolist()],
        },
        "hourly": hourly_data,
        "monthly": {
            "labels": month_names,
            "orders": [int(v) for v in df.groupby('month').size().reindex(range(1, 13), fill_value=0).tolist()],
            "quantity": [int(v) for v in monthly['qty'].tolist()],
            "revenue": [round(v, 2) for v in monthly['total_price'].tolist()],
        },
        "weekend_vs_weekday": {
            "labels": ["Weekday", "Weekend"],
            "quantity": [int(weekday_data['qty'].sum()), int(weekend_data['qty'].sum())],
            "revenue": [round(float(weekday_data['total_price'].sum()), 2), round(float(weekend_data['total_price'].sum()), 2)],
        }
    }


def get_weather_statistics() -> Dict[str, Any]:
    """Get weather-related statistics."""
    df = load_sales_data()
    
    # Rainy vs Non-rainy days
    if 'is_rainy' in df.columns:
        rainy_data = df[df['is_rainy'] == 1]
        non_rainy_data = df[df['is_rainy'] == 0]
        
        rainy_days = rainy_data['system_date'].dt.date.nunique()
        non_rainy_days = non_rainy_data['system_date'].dt.date.nunique()
        
        rainy_avg_revenue = float(rainy_data['total_price'].sum()) / rainy_days if rainy_days > 0 else 0
        non_rainy_avg_revenue = float(non_rainy_data['total_price'].sum()) / non_rainy_days if non_rainy_days > 0 else 0
        
        rainy_avg_qty = float(rainy_data['qty'].sum()) / rainy_days if rainy_days > 0 else 0
        non_rainy_avg_qty = float(non_rainy_data['qty'].sum()) / non_rainy_days if non_rainy_days > 0 else 0
        
        rainy_impact = {
            "labels": ["Rainy Days", "Clear Days"],
            "avg_revenue": [round(rainy_avg_revenue, 2), round(non_rainy_avg_revenue, 2)],
            "avg_quantity": [round(rainy_avg_qty, 2), round(non_rainy_avg_qty, 2)],
            "day_count": [rainy_days, non_rainy_days],
        }
    else:
        rainy_impact = None
    
    # Temperature correlation
    temp_correlation = None
    if 'temp_avg' in df.columns:
        df['temp_bucket'] = pd.cut(df['temp_avg'], bins=[0, 20, 25, 30, 35, 50], labels=['<20°C', '20-25°C', '25-30°C', '30-35°C', '>35°C'])
        temp_grouped = df.groupby('temp_bucket', observed=True).agg({
            'qty': 'sum',
            'total_price': 'sum',
        })
        
        # Get daily averages per temp bucket
        days_per_bucket = df.groupby('temp_bucket', observed=True)['system_date'].apply(lambda x: x.dt.date.nunique())
        
        temp_correlation = {
            "labels": [str(l) for l in temp_grouped.index.tolist()],
            "total_quantity": [int(v) for v in temp_grouped['qty'].tolist()],
            "total_revenue": [round(v, 2) for v in temp_grouped['total_price'].tolist()],
            "days": [int(v) for v in days_per_bucket.tolist()],
        }
    
    # Rain mm distribution (if available)
    rain_distribution = None
    if 'rain_mm' in df.columns:
        df['rain_level'] = pd.cut(df['rain_mm'], bins=[-1, 0, 5, 20, 100], labels=['No Rain', 'Light', 'Moderate', 'Heavy'])
        rain_grouped = df.groupby('rain_level', observed=True)['total_price'].sum()
        rain_distribution = {
            "labels": [str(l) for l in rain_grouped.index.tolist()],
            "revenue": [round(v, 2) for v in rain_grouped.tolist()],
        }
    
    return {
        "by_rain": {
            "sunny": {
                "days": non_rainy_days,
                "avg_revenue": round(non_rainy_avg_revenue, 2),
                "avg_orders": round(non_rainy_avg_qty, 2),
                "total_revenue": round(float(non_rainy_data['total_price'].sum()), 2),
            } if non_rainy_days > 0 else None,
            "rainy": {
                "days": rainy_days,
                "avg_revenue": round(rainy_avg_revenue, 2),
                "avg_orders": round(rainy_avg_qty, 2),
                "total_revenue": round(float(rainy_data['total_price'].sum()), 2),
            } if rainy_days > 0 else None,
        },
        "by_temperature": {
            "labels": temp_correlation["labels"] if temp_correlation else [],
            "avg_revenue": [round(r / d, 2) if d > 0 else 0 for r, d in zip(temp_correlation["total_revenue"], temp_correlation["days"])] if temp_correlation else [],
        } if temp_correlation else None,
        "by_rainfall": rain_distribution,
        "temperature": {
            "min": round(float(df['temp_avg'].min()), 1) if 'temp_avg' in df.columns else None,
            "avg": round(float(df['temp_avg'].mean()), 1) if 'temp_avg' in df.columns else None,
            "max": round(float(df['temp_avg'].max()), 1) if 'temp_avg' in df.columns else None,
        },
        "rainfall": {
            "avg": round(float(df['rain_mm'].mean()), 1) if 'rain_mm' in df.columns else None,
        },
    }


def get_holiday_statistics() -> Dict[str, Any]:
    """Get holiday-related statistics."""
    df = load_sales_data()
    
    if 'is_holiday' not in df.columns:
        return {"available": False}
    
    # Holiday vs Non-holiday comparison
    holiday_data = df[df['is_holiday'] == 1]
    non_holiday_data = df[df['is_holiday'] == 0]
    
    holiday_days = holiday_data['system_date'].dt.date.nunique()
    non_holiday_days = non_holiday_data['system_date'].dt.date.nunique()
    
    holiday_avg_revenue = float(holiday_data['total_price'].sum()) / holiday_days if holiday_days > 0 else 0
    non_holiday_avg_revenue = float(non_holiday_data['total_price'].sum()) / non_holiday_days if non_holiday_days > 0 else 0
    
    holiday_avg_qty = float(holiday_data['qty'].sum()) / holiday_days if holiday_days > 0 else 0
    non_holiday_avg_qty = float(non_holiday_data['qty'].sum()) / non_holiday_days if non_holiday_days > 0 else 0
    
    # Individual holiday performance
    holiday_performance = None
    if 'holiday_name' in df.columns:
        holiday_names = holiday_data.groupby('holiday_name').agg({
            'qty': 'sum',
            'total_price': 'sum',
        }).sort_values('total_price', ascending=False).head(10)
        
        holiday_performance = {
            "labels": holiday_names.index.tolist(),
            "quantity": [int(v) for v in holiday_names['qty'].tolist()],
            "revenue": [round(v, 2) for v in holiday_names['total_price'].tolist()],
        }
    
    # Pre/Post holiday effect
    pre_post_effect = None
    if 'is_pre_holiday' in df.columns and 'is_post_holiday' in df.columns:
        pre_holiday = df[df['is_pre_holiday'] == 1]
        post_holiday = df[df['is_post_holiday'] == 1]
        normal_days = df[(df['is_holiday'] == 0) & (df['is_pre_holiday'] == 0) & (df['is_post_holiday'] == 0)]
        
        pre_days = pre_holiday['system_date'].dt.date.nunique()
        post_days = post_holiday['system_date'].dt.date.nunique()
        normal_day_count = normal_days['system_date'].dt.date.nunique()
        
        pre_post_effect = {
            "labels": ["Pre-Holiday", "Holiday", "Post-Holiday", "Normal"],
            "avg_revenue": [
                round(float(pre_holiday['total_price'].sum()) / pre_days, 2) if pre_days > 0 else 0,
                round(holiday_avg_revenue, 2),
                round(float(post_holiday['total_price'].sum()) / post_days, 2) if post_days > 0 else 0,
                round(float(normal_days['total_price'].sum()) / normal_day_count, 2) if normal_day_count > 0 else 0,
            ]
        }
    
    return {
        "available": True,
        "holiday": {
            "days": holiday_days,
            "avg_revenue": round(holiday_avg_revenue, 2),
            "avg_orders": round(holiday_avg_qty, 2),
        },
        "non_holiday": {
            "days": non_holiday_days,
            "avg_revenue": round(non_holiday_avg_revenue, 2),
            "avg_orders": round(non_holiday_avg_qty, 2),
        },
        "by_holiday": holiday_performance,
        "pre_post_effect": pre_post_effect,
    }


def get_forecast_comparison() -> Dict[str, Any]:
    """
    Get forecast vs actual comparison data.
    This requires a forecast file to exist.
    """
    # Try to load Prophet forecast data
    forecast_file = os.path.join(DATA_DIR, "data", "processed", "athena_daily_ts_dataset.csv")
    
    if not os.path.exists(forecast_file):
        return {"available": False, "message": "No forecast data available"}
    
    try:
        df = load_sales_data()
        forecast_df = pd.read_csv(forecast_file, parse_dates=['ds'])
        
        # Get actual daily totals
        df['date'] = pd.to_datetime(df['system_date']).dt.date
        actual_daily = df.groupby('date')['qty'].sum().reset_index()
        actual_daily.columns = ['date', 'actual']
        actual_daily['date'] = pd.to_datetime(actual_daily['date'])
        
        # Merge with forecast
        forecast_df['date'] = pd.to_datetime(forecast_df['ds']).dt.normalize()
        merged = pd.merge(
            actual_daily,
            forecast_df[['date', 'y']].rename(columns={'y': 'forecast'}),
            on='date',
            how='inner'
        )
        
        # Only take last 60 days for display
        merged = merged.sort_values('date').tail(60)
        
        if len(merged) == 0:
            return {"available": False, "message": "No matching forecast data"}
        
        # Calculate metrics
        merged['error'] = merged['actual'] - merged['forecast']
        merged['abs_error'] = merged['error'].abs()
        merged['pct_error'] = (merged['abs_error'] / merged['actual'] * 100).replace([np.inf, -np.inf], np.nan)
        
        mae = merged['abs_error'].mean()
        mape = merged['pct_error'].mean()
        rmse = np.sqrt((merged['error'] ** 2).mean())
        
        return {
            "available": True,
            "comparison": [
                {
                    "date": str(row['date'].date()),
                    "actual": int(row['actual']),
                    "predicted": round(row['forecast'], 2),
                }
                for _, row in merged.iterrows()
            ],
            "accuracy": {
                "mae": round(mae, 2),
                "mape": round(mape, 2),
                "rmse": round(rmse, 2),
                "accuracy": round(100 - mape, 2),
            }
        }
    except Exception as e:
        return {"available": False, "message": str(e)}


def get_discount_analysis() -> Dict[str, Any]:
    """Get discount analysis statistics."""
    df = load_sales_data()
    
    # Discount rate distribution
    df['discount_bucket'] = pd.cut(
        df['discount_ratio_effective'] * 100 if 'discount_ratio_effective' in df.columns else df['discount_rate'] * 100,
        bins=[0, 5, 10, 15, 20, 30, 100],
        labels=['0-5%', '5-10%', '10-15%', '15-20%', '20-30%', '>30%']
    )
    
    discount_dist = df.groupby('discount_bucket', observed=True).agg({
        'qty': 'sum',
        'total_price': 'sum',
    })
    
    # Average discount by product
    product_discount = df.groupby('food_name').agg({
        'total_discount_price': 'sum',
        'gross_price': 'sum',
    })
    product_discount['discount_rate'] = (product_discount['total_discount_price'] / product_discount['gross_price'] * 100).round(2)
    product_discount = product_discount.sort_values('discount_rate', ascending=False).head(10)
    
    return {
        "distribution": {
            "labels": [str(l) for l in discount_dist.index.tolist()],
            "quantity": [int(v) for v in discount_dist['qty'].tolist()],
            "revenue": [round(v, 2) for v in discount_dist['total_price'].tolist()],
        },
        "by_product": {
            "labels": product_discount.index.tolist(),
            "discount_rates": product_discount['discount_rate'].tolist(),
        }
    }


def get_all_statistics() -> Dict[str, Any]:
    """Get all statistics in one call for dashboard."""
    return {
        "overview": get_overview_statistics(),
        "sales_trend": get_sales_trend_data(period="daily", limit=60),
        "products": get_product_statistics(),
        "order_types": get_order_type_statistics(),
        "calendar": get_calendar_statistics(),
        "weather": get_weather_statistics(),
        "holidays": get_holiday_statistics(),
        "forecast": get_forecast_comparison(),
        "discounts": get_discount_analysis(),
    }
