"""
Data Service
============
Fetches and processes sales data from the CSV file for report generation.
"""

import os
import pandas as pd
from typing import Dict, Any, Optional
from datetime import datetime, date

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


def get_daily_summary(target_date: date) -> Dict[str, Any]:
    """
    Get daily sales summary for a specific date.
    
    Returns metrics:
    - total_qty: Total quantity sold
    - gross_revenue: Total gross revenue
    - total_discount: Total discounts given
    - net_revenue: Total net revenue
    - top_items: Top 5 selling items by quantity
    - order_types: Breakdown by order type
    - is_holiday: Whether it was a holiday
    - holiday_name: Name of the holiday if applicable
    - is_rainy: Whether it was rainy
    - avg_temp: Average temperature
    """
    df = load_sales_data()
    
    # Filter for the specific date
    df['system_date'] = pd.to_datetime(df['system_date']).dt.date
    daily_data = df[df['system_date'] == target_date]
    
    if daily_data.empty:
        return {
            "date": str(target_date),
            "has_data": False,
            "message": f"No sales data found for {target_date}"
        }
    
    # Calculate metrics
    total_qty = int(daily_data['qty'].sum())
    gross_revenue = float(daily_data['gross_price'].sum())
    total_discount = float(daily_data['total_discount_price'].sum())
    net_revenue = float(daily_data['total_price'].sum())
    
    # Top selling items
    top_items = (
        daily_data.groupby('food_name')['qty']
        .sum()
        .sort_values(ascending=False)
        .head(5)
        .to_dict()
    )
    
    # Order type breakdown
    order_types = (
        daily_data.groupby('order_type')['qty']
        .sum()
        .to_dict()
    )
    
    # Weather and holiday info (take first record's values)
    first_row = daily_data.iloc[0]
    is_holiday = bool(first_row.get('is_holiday', 0))
    holiday_name = first_row.get('holiday_name', '') if is_holiday else None
    is_rainy = bool(first_row.get('is_rainy', 0))
    avg_temp = float(first_row.get('temp_avg', 0)) if 'temp_avg' in daily_data.columns else None
    
    return {
        "date": str(target_date),
        "has_data": True,
        "total_qty": total_qty,
        "gross_revenue": round(gross_revenue, 2),
        "total_discount": round(total_discount, 2),
        "net_revenue": round(net_revenue, 2),
        "discount_rate": round((total_discount / gross_revenue * 100) if gross_revenue > 0 else 0, 2),
        "top_items": top_items,
        "order_types": order_types,
        "is_holiday": is_holiday,
        "holiday_name": holiday_name,
        "is_rainy": is_rainy,
        "avg_temp": avg_temp,
        "transaction_count": len(daily_data),
    }


def get_monthly_summary(target_date: date) -> Dict[str, Any]:
    """
    Get monthly sales summary up to and including the target date.
    
    Returns metrics for the month:
    - month_to_date totals
    - daily averages
    - trend comparison (if previous month data exists)
    """
    df = load_sales_data()
    
    # Filter for the month
    df['system_date'] = pd.to_datetime(df['system_date']).dt.date
    month_start = target_date.replace(day=1)
    monthly_data = df[(df['system_date'] >= month_start) & (df['system_date'] <= target_date)]
    
    if monthly_data.empty:
        return {
            "month": target_date.strftime("%B %Y"),
            "has_data": False,
            "message": f"No sales data found for {target_date.strftime('%B %Y')}"
        }
    
    # Calculate monthly metrics
    total_qty = int(monthly_data['qty'].sum())
    gross_revenue = float(monthly_data['gross_price'].sum())
    total_discount = float(monthly_data['total_discount_price'].sum())
    net_revenue = float(monthly_data['total_price'].sum())
    
    # Daily breakdown for trend
    daily_totals = (
        monthly_data.groupby('system_date')
        .agg({
            'qty': 'sum',
            'total_price': 'sum'
        })
        .reset_index()
    )
    
    days_count = len(daily_totals)
    avg_daily_qty = total_qty / days_count if days_count > 0 else 0
    avg_daily_revenue = net_revenue / days_count if days_count > 0 else 0
    
    # Previous month comparison (if available)
    prev_month_start = (month_start - pd.DateOffset(months=1)).date()
    prev_month_end = (month_start - pd.DateOffset(days=1)).date()
    prev_month_data = df[(df['system_date'] >= prev_month_start) & (df['system_date'] <= prev_month_end)]
    
    prev_month_revenue = float(prev_month_data['total_price'].sum()) if not prev_month_data.empty else None
    revenue_change = None
    if prev_month_revenue and prev_month_revenue > 0:
        revenue_change = round(((net_revenue - prev_month_revenue) / prev_month_revenue) * 100, 2)
    
    return {
        "month": target_date.strftime("%B %Y"),
        "has_data": True,
        "days_in_data": days_count,
        "total_qty": total_qty,
        "gross_revenue": round(gross_revenue, 2),
        "total_discount": round(total_discount, 2),
        "net_revenue": round(net_revenue, 2),
        "avg_daily_qty": round(avg_daily_qty, 2),
        "avg_daily_revenue": round(avg_daily_revenue, 2),
        "prev_month_revenue": round(prev_month_revenue, 2) if prev_month_revenue else None,
        "revenue_change_percent": revenue_change,
    }


def get_available_date_range() -> Dict[str, str]:
    """Get the range of dates available in the data."""
    df = load_sales_data()
    df['system_date'] = pd.to_datetime(df['system_date']).dt.date
    
    return {
        "min_date": str(df['system_date'].min()),
        "max_date": str(df['system_date'].max()),
    }
