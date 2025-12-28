"""
Visualization tools for generating charts and graphs.
Creates base64-encoded images that can be displayed in the chat.
"""

import base64
import io
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
import numpy as np

from .data_loader import add_calendar_columns, load_sales_data


# Set professional style
plt.style.use('seaborn-v0_8-whitegrid')
COLORS = ['#1976d2', '#f57c00', '#388e3c', '#d32f2f', '#7b1fa2', '#00796b', '#c2185b', '#512da8']


def _get_dataframe() -> pd.DataFrame:
    """Load and prepare the sales dataframe."""
    path = os.getenv("SALES_DATA_PATH", "data/the_rossmann_coffee_shop_sales_dataset.csv")
    df = load_sales_data(path, copy=True)
    return add_calendar_columns(df)


def _fig_to_base64(fig: plt.Figure) -> str:
    """Convert matplotlib figure to base64 string."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white', edgecolor='none')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    buf.close()
    plt.close(fig)
    return img_base64


def _build_chart_payload(labels: List[str], data: List[float], series_label: str, chart_type: str) -> Dict[str, Any]:
    """Create a lightweight payload for interactive charts on the frontend."""
    return {
        "chart_type": chart_type,
        "labels": labels,
        "datasets": [
            {
                "label": series_label,
                "data": [float(x) if x is not None else 0.0 for x in data],
            }
        ],
    }


def create_sales_trend_chart(
    item_name: Optional[str] = None,
    months: int = 6,
    group_by: str = "month"
) -> Dict[str, Any]:
    """
    Create a sales trend line chart.
    
    Args:
        item_name: Specific item to analyze (None for all items)
        months: Number of months to show
        group_by: 'day', 'week', or 'month'
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    # Filter by item if specified
    title_item = "All Items"
    if item_name:
        df = df[df['food_name'].str.lower().str.contains(item_name.lower(), na=False)]
        title_item = item_name.title()
    
    # Get recent data
    max_date = df['system_date'].max()
    min_date = max_date - pd.DateOffset(months=months)
    df = df[df['system_date'] >= min_date]
    
    if df.empty:
        return {
            "image": None,
            "title": "No Data Available",
            "explanation": f"No sales data found for the specified criteria."
        }
    
    # Group data
    if group_by == "day":
        grouped = df.groupby(df['system_date'].dt.date)['qty'].sum().reset_index()
        grouped.columns = ['date', 'qty']
        x_label = "Date"
    elif group_by == "week":
        df['week'] = df['system_date'].dt.to_period('W').apply(lambda x: x.start_time)
        grouped = df.groupby('week')['qty'].sum().reset_index()
        grouped.columns = ['date', 'qty']
        x_label = "Week"
    else:  # month
        df['month_start'] = df['system_date'].dt.to_period('M').apply(lambda x: x.start_time)
        grouped = df.groupby('month_start')['qty'].sum().reset_index()
        grouped.columns = ['date', 'qty']
        x_label = "Month"
    
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 5))
    
    ax.plot(grouped['date'], grouped['qty'], color=COLORS[0], linewidth=2.5, marker='o', markersize=6)
    ax.fill_between(grouped['date'], grouped['qty'], alpha=0.3, color=COLORS[0])
    
    ax.set_xlabel(x_label, fontsize=11, fontweight='bold')
    ax.set_ylabel('Units Sold', fontsize=11, fontweight='bold')
    ax.set_title(f'Sales Trend - {title_item}', fontsize=14, fontweight='bold', pad=15)
    
    # Format x-axis
    if group_by == "day":
        ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    else:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %Y'))
    
    plt.xticks(rotation=45, ha='right')
    ax.grid(True, alpha=0.3)
    
    # Add trend line
    z = np.polyfit(range(len(grouped)), grouped['qty'], 1)
    p = np.poly1d(z)
    ax.plot(grouped['date'], p(range(len(grouped))), "--", color=COLORS[1], alpha=0.8, label='Trend')
    ax.legend()
    
    plt.tight_layout()
    
    # Calculate insights
    total_sales = grouped['qty'].sum()
    avg_sales = grouped['qty'].mean()
    trend_direction = "upward 📈" if z[0] > 0 else "downward 📉"
    peak_period = grouped.loc[grouped['qty'].idxmax(), 'date']
    
    explanation = f"""**Sales Trend Analysis for {title_item}**

- **Total Units Sold:** {total_sales:,.0f} units over {months} months
- **Average per {group_by}:** {avg_sales:,.0f} units
- **Trend Direction:** {trend_direction}
- **Peak Sales:** {peak_period.strftime('%B %Y') if hasattr(peak_period, 'strftime') else peak_period}

The trend line shows the overall sales direction, helping you identify growth or decline patterns."""

    labels = [d.strftime('%b %d') if group_by == "day" and hasattr(d, 'strftime') else d.strftime('%b %Y') if hasattr(d, 'strftime') else str(d) for d in grouped['date']]
    data_points = grouped['qty'].tolist()
    chart_payload = _build_chart_payload(labels, data_points, f"{title_item} sales", "line")
    
    return {
        "image": _fig_to_base64(fig),
        "title": f"Sales Trend - {title_item}",
        "explanation": explanation,
        "chart_data": chart_payload,
    }


def create_top_items_chart(
    month: Optional[int] = None,
    year: Optional[int] = None,
    top_n: int = 10
) -> Dict[str, Any]:
    """
    Create a horizontal bar chart of top selling items.
    
    Args:
        month: Specific month (None for all time)
        year: Specific year
        top_n: Number of top items to show
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    # Filter by month/year if specified
    period_text = "All Time"
    if month and year:
        df = df[(df['month'] == month) & (df['year'] == year)]
        period_text = f"{pd.Timestamp(year=year, month=month, day=1).strftime('%B %Y')}"
    elif month:
        df = df[df['month'] == month]
        period_text = f"Month {month} (All Years)"
    elif year:
        df = df[df['year'] == year]
        period_text = f"Year {year}"
    
    if df.empty:
        return {
            "image": None,
            "title": "No Data Available",
            "explanation": "No sales data found for the specified period."
        }
    
    # Get top items
    top_items = df.groupby('food_name')['qty'].sum().nlargest(top_n).sort_values()
    
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 6))
    
    colors = [COLORS[i % len(COLORS)] for i in range(len(top_items))]
    bars = ax.barh(top_items.index, top_items.values, color=colors[::-1])
    
    ax.set_xlabel('Units Sold', fontsize=11, fontweight='bold')
    ax.set_title(f'Top {top_n} Best Selling Items - {period_text}', fontsize=14, fontweight='bold', pad=15)
    
    # Add value labels
    for bar, value in zip(bars, top_items.values):
        ax.text(value + max(top_items.values) * 0.01, bar.get_y() + bar.get_height()/2,
                f'{value:,.0f}', va='center', fontsize=9)
    
    ax.grid(True, alpha=0.3, axis='x')
    plt.tight_layout()
    
    # Generate explanation
    top_item = top_items.index[-1]
    top_value = top_items.values[-1]
    total = top_items.sum()
    
    explanation = f"""**Top {top_n} Selling Items Analysis - {period_text}**

- **#1 Best Seller:** {top_item} with {top_value:,.0f} units
- **Total Units (Top {top_n}):** {total:,.0f} units
- **Top Item Share:** {(top_value/total*100):.1f}% of top {top_n}

**Top 3 Items:**
1. {top_items.index[-1]} - {top_items.values[-1]:,.0f} units
2. {top_items.index[-2]} - {top_items.values[-2]:,.0f} units
3. {top_items.index[-3]} - {top_items.values[-3]:,.0f} units

These items are your consistent performers. Consider ensuring adequate stock and highlighting them in promotions."""

    chart_payload = _build_chart_payload(list(top_items.index), top_items.values.tolist(), "Units sold", "bar")
    
    return {
        "image": _fig_to_base64(fig),
        "title": f"Top {top_n} Selling Items",
        "explanation": explanation,
        "chart_data": chart_payload,
    }


def create_daily_pattern_chart(
    item_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a chart showing sales pattern by day of week.
    
    Args:
        item_name: Specific item (None for all)
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    title_item = "All Items"
    if item_name:
        df = df[df['food_name'].str.lower().str.contains(item_name.lower(), na=False)]
        title_item = item_name.title()
    
    if df.empty:
        return {
            "image": None,
            "title": "No Data Available",
            "explanation": "No sales data found."
        }
    
    # Group by day of week
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    daily_sales = df.groupby('day_of_week')['qty'].mean().reindex(range(7))
    
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 5))
    
    colors = [COLORS[0] if i < 5 else COLORS[1] for i in range(7)]
    bars = ax.bar(days, daily_sales.values, color=colors, edgecolor='white', linewidth=1.5)
    
    ax.set_xlabel('Day of Week', fontsize=11, fontweight='bold')
    ax.set_ylabel('Average Units Sold', fontsize=11, fontweight='bold')
    ax.set_title(f'Daily Sales Pattern - {title_item}', fontsize=14, fontweight='bold', pad=15)
    
    # Add value labels
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.0f}', ha='center', va='bottom', fontsize=10)
    
    # Highlight weekend
    ax.axvspan(4.5, 6.5, alpha=0.1, color='orange', label='Weekend')
    ax.legend()
    
    plt.xticks(rotation=45, ha='right')
    ax.grid(True, alpha=0.3, axis='y')
    plt.tight_layout()
    
    # Analysis
    busiest_day = days[daily_sales.values.argmax()]
    slowest_day = days[daily_sales.values.argmin()]
    weekend_avg = daily_sales.iloc[5:7].mean()
    weekday_avg = daily_sales.iloc[:5].mean()
    
    explanation = f"""**Daily Sales Pattern Analysis - {title_item}**

- **Busiest Day:** {busiest_day} ({daily_sales.max():.0f} avg units)
- **Slowest Day:** {slowest_day} ({daily_sales.min():.0f} avg units)
- **Weekend Average:** {weekend_avg:.0f} units/day
- **Weekday Average:** {weekday_avg:.0f} units/day
- **Weekend vs Weekday:** {"Weekend is busier! 🎉" if weekend_avg > weekday_avg else "Weekdays are busier 💼"}

**Recommendations:**
- Schedule more staff on {busiest_day}
- Consider promotions on {slowest_day} to boost sales
- {"Prepare for weekend rush!" if weekend_avg > weekday_avg else "Focus marketing on weekends"}"""

    chart_payload = _build_chart_payload(days, daily_sales.values.tolist(), "Avg units", "bar")
    
    return {
        "image": _fig_to_base64(fig),
        "title": f"Daily Sales Pattern - {title_item}",
        "explanation": explanation,
        "chart_data": chart_payload,
    }


def create_monthly_comparison_chart(
    year1: int,
    year2: int,
    item_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a chart comparing sales between two years.
    
    Args:
        year1: First year
        year2: Second year
        item_name: Specific item (None for all)
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    title_item = "All Items"
    if item_name:
        df = df[df['food_name'].str.lower().str.contains(item_name.lower(), na=False)]
        title_item = item_name.title()
    
    # Filter years
    df = df[df['year'].isin([year1, year2])]
    
    if df.empty:
        return {
            "image": None,
            "title": "No Data Available",
            "explanation": "No data found for the specified years."
        }
    
    # Group by year and month
    monthly = df.groupby(['year', 'month'])['qty'].sum().unstack(level=0).fillna(0)
    
    # Create figure
    fig, ax = plt.subplots(figsize=(12, 5))
    
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    x = np.arange(len(months))
    width = 0.35
    
    bars1 = ax.bar(x - width/2, monthly.get(year1, pd.Series([0]*12)).reindex(range(1, 13)).fillna(0), 
                   width, label=str(year1), color=COLORS[0])
    bars2 = ax.bar(x + width/2, monthly.get(year2, pd.Series([0]*12)).reindex(range(1, 13)).fillna(0), 
                   width, label=str(year2), color=COLORS[1])
    
    ax.set_xlabel('Month', fontsize=11, fontweight='bold')
    ax.set_ylabel('Units Sold', fontsize=11, fontweight='bold')
    ax.set_title(f'Year-over-Year Comparison: {year1} vs {year2} - {title_item}', fontsize=14, fontweight='bold', pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(months)
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    # Calculate growth
    total_y1 = monthly.get(year1, pd.Series([0])).sum()
    total_y2 = monthly.get(year2, pd.Series([0])).sum()
    growth = ((total_y2 - total_y1) / total_y1 * 100) if total_y1 > 0 else 0
    
    explanation = f"""**Year-over-Year Comparison: {year1} vs {year2} - {title_item}**

- **{year1} Total Sales:** {total_y1:,.0f} units
- **{year2} Total Sales:** {total_y2:,.0f} units
- **Growth Rate:** {growth:+.1f}% {"📈" if growth > 0 else "📉"}

**Key Insights:**
- {"Sales have grown!" if growth > 0 else "Sales have declined"} compared to the previous year
- Use this comparison to identify seasonal patterns and plan inventory accordingly"""
    
    chart_payload = {
        "chart_type": "bar",
        "labels": months,
        "datasets": [
            {
                "label": str(year1),
                "data": monthly.get(year1, pd.Series([0]*12)).reindex(range(1, 13)).fillna(0).astype(float).tolist(),
            },
            {
                "label": str(year2),
                "data": monthly.get(year2, pd.Series([0]*12)).reindex(range(1, 13)).fillna(0).astype(float).tolist(),
            },
        ],
    }
    
    return {
        "image": _fig_to_base64(fig),
        "title": f"Year Comparison: {year1} vs {year2}",
        "explanation": explanation,
        "chart_data": chart_payload,
    }


def create_category_pie_chart(
    month: Optional[int] = None,
    year: Optional[int] = None
) -> Dict[str, Any]:
    """
    Create a pie chart showing sales distribution by category.
    
    Args:
        month: Specific month
        year: Specific year
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    # Filter by period
    period_text = "All Time"
    if month and year:
        df = df[(df['month'] == month) & (df['year'] == year)]
        period_text = pd.Timestamp(year=year, month=month, day=1).strftime('%B %Y')
    elif year:
        df = df[df['year'] == year]
        period_text = f"Year {year}"
    
    if df.empty:
        return {
            "image": None,
            "title": "No Data Available",
            "explanation": "No data found for the specified period."
        }
    
    # Extract category from food_name (assuming format like "Spicy Burger", "Sweet Pasta")
    def get_category(name):
        name_lower = str(name).lower()
        if any(x in name_lower for x in ['coffee', 'latte', 'espresso', 'cappuccino', 'americano', 'mocha']):
            return 'Coffee'
        elif any(x in name_lower for x in ['tea', 'chai']):
            return 'Tea'
        elif any(x in name_lower for x in ['burger', 'sandwich']):
            return 'Burgers & Sandwiches'
        elif any(x in name_lower for x in ['pasta', 'pizza']):
            return 'Pasta & Pizza'
        elif any(x in name_lower for x in ['cake', 'pastry', 'muffin', 'cookie', 'brownie', 'sweet']):
            return 'Desserts'
        elif any(x in name_lower for x in ['juice', 'smoothie', 'shake']):
            return 'Cold Beverages'
        else:
            return 'Other'
    
    df['category'] = df['food_name'].apply(get_category)
    category_sales = df.groupby('category')['qty'].sum()
    
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 8))
    
    colors = COLORS[:len(category_sales)]
    wedges, texts, autotexts = ax.pie(
        category_sales.values, 
        labels=category_sales.index,
        autopct='%1.1f%%',
        colors=colors,
        explode=[0.02] * len(category_sales),
        shadow=True,
        startangle=90
    )
    
    ax.set_title(f'Sales Distribution by Category - {period_text}', fontsize=14, fontweight='bold', pad=20)
    
    # Style the text
    for autotext in autotexts:
        autotext.set_fontsize(10)
        autotext.set_fontweight('bold')
    
    plt.tight_layout()
    
    # Analysis
    top_category = category_sales.idxmax()
    top_value = category_sales.max()
    total = category_sales.sum()
    
    category_details = "\n".join([
        f"- **{cat}:** {val:,.0f} units ({val/total*100:.1f}%)" 
        for cat, val in category_sales.sort_values(ascending=False).items()
    ])
    
    explanation = f"""**Sales Distribution by Category - {period_text}**

**Top Category:** {top_category} with {top_value:,.0f} units ({top_value/total*100:.1f}% of total)

**Category Breakdown:**
{category_details}

**Insights:**
- Focus inventory and promotions on {top_category}
- Consider bundling slower categories with popular ones"""
    
    chart_payload = {
        "chart_type": "pie",
        "labels": list(category_sales.index),
        "datasets": [
            {
                "label": "Category share",
                "data": category_sales.values.astype(float).tolist(),
            }
        ],
    }
    
    return {
        "image": _fig_to_base64(fig),
        "title": f"Category Distribution - {period_text}",
        "explanation": explanation,
        "chart_data": chart_payload,
    }


def create_weather_impact_chart() -> Dict[str, Any]:
    """
    Create a chart showing how weather affects sales.
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    if 'is_rainy' not in df.columns or 'temp_avg' not in df.columns:
        return {
            "image": None,
            "title": "Weather Data Not Available",
            "explanation": "Weather columns not found in the dataset."
        }
    
    # Create figure with 2 subplots
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # 1. Rain impact
    rain_sales = df.groupby('is_rainy')['qty'].mean()
    rain_labels = ['No Rain ☀️', 'Rainy 🌧️']
    colors_rain = [COLORS[0], COLORS[3]]
    
    bars1 = ax1.bar(rain_labels, rain_sales.values, color=colors_rain, edgecolor='white', linewidth=2)
    ax1.set_ylabel('Average Units Sold', fontsize=11, fontweight='bold')
    ax1.set_title('Rain Impact on Sales', fontsize=13, fontweight='bold')
    
    for bar in bars1:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.0f}', ha='center', va='bottom', fontsize=12, fontweight='bold')
    
    ax1.grid(True, alpha=0.3, axis='y')
    
    # 2. Temperature impact
    df['temp_range'] = pd.cut(df['temp_avg'], bins=[0, 20, 25, 30, 40], labels=['Cold (<20°C)', 'Mild (20-25°C)', 'Warm (25-30°C)', 'Hot (>30°C)'])
    temp_sales = df.groupby('temp_range', observed=True)['qty'].mean()
    
    bars2 = ax2.bar(temp_sales.index.astype(str), temp_sales.values, color=COLORS[:len(temp_sales)], edgecolor='white', linewidth=2)
    ax2.set_ylabel('Average Units Sold', fontsize=11, fontweight='bold')
    ax2.set_title('Temperature Impact on Sales', fontsize=13, fontweight='bold')
    
    for bar in bars2:
        height = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.0f}', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    ax2.grid(True, alpha=0.3, axis='y')
    plt.xticks(rotation=15)
    
    plt.tight_layout()
    
    # Analysis
    rain_diff = rain_sales.get(1, 0) - rain_sales.get(0, 0)
    rain_impact = "increases" if rain_diff > 0 else "decreases"
    
    explanation = f"""**Weather Impact on Sales Analysis**

**Rain Effect:**
- No Rain: {rain_sales.get(0, 0):.0f} avg units
- Rainy Day: {rain_sales.get(1, 0):.0f} avg units
- Impact: Sales {rain_impact} by {abs(rain_diff):.0f} units on rainy days

**Temperature Effect:**
- Customers tend to visit more during {"warmer" if temp_sales.idxmax() in ['Warm (25-30°C)', 'Hot (>30°C)'] else "milder"} weather
- Best temperature range: {temp_sales.idxmax()}

**Recommendations:**
- {"Stock more hot beverages and comfort food on rainy days" if rain_diff > 0 else "Run delivery promotions on rainy days to compensate"}
- Adjust inventory based on weather forecasts"""
    
    chart_payload = {
        "chart_type": "bar",
        "labels": rain_labels,
        "datasets": [
            {
                "label": "Avg units",
                "data": rain_sales.reindex([0,1]).fillna(0).astype(float).tolist(),
            }
        ],
    }
    
    return {
        "image": _fig_to_base64(fig),
        "title": "Weather Impact Analysis",
        "explanation": explanation,
        "chart_data": chart_payload,
    }


def create_holiday_impact_chart() -> Dict[str, Any]:
    """
    Create a chart showing how holidays affect sales.
    
    Returns:
        Dict with 'image' (base64), 'title', and 'explanation'
    """
    df = _get_dataframe()
    
    if 'is_holiday' not in df.columns:
        return {
            "image": None,
            "title": "Holiday Data Not Available", 
            "explanation": "Holiday columns not found in the dataset."
        }
    
    # Create figure
    fig, ax = plt.subplots(figsize=(10, 5))
    
    # Compare holiday vs non-holiday
    holiday_sales = df.groupby('is_holiday')['qty'].mean()
    labels = ['Regular Days', 'Holidays 🎉']
    colors = [COLORS[0], COLORS[2]]
    
    bars = ax.bar(labels, holiday_sales.values, color=colors, edgecolor='white', linewidth=2, width=0.5)
    
    ax.set_ylabel('Average Units Sold', fontsize=11, fontweight='bold')
    ax.set_title('Holiday Impact on Sales', fontsize=14, fontweight='bold', pad=15)
    
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.0f}', ha='center', va='bottom', fontsize=14, fontweight='bold')
    
    ax.grid(True, alpha=0.3, axis='y')
    plt.tight_layout()
    
    # Analysis  
    regular_avg = holiday_sales.get(0, 0)
    holiday_avg = holiday_sales.get(1, 0)
    diff_pct = ((holiday_avg - regular_avg) / regular_avg * 100) if regular_avg > 0 else 0
    
    explanation = f"""**Holiday Impact on Sales Analysis**

- **Regular Day Average:** {regular_avg:.0f} units
- **Holiday Average:** {holiday_avg:.0f} units
- **Difference:** {diff_pct:+.1f}% {"📈" if diff_pct > 0 else "📉"}

**Insights:**
{"- Holidays boost your sales! Prepare extra inventory and staff during holiday periods." if diff_pct > 0 else "- Sales dip during holidays. Consider special promotions or adjusted hours."}
- Plan marketing campaigns around upcoming holidays
- Ensure adequate staffing for holiday rushes"""
    
    chart_payload = {
        "chart_type": "bar",
        "labels": labels,
        "datasets": [
            {
                "label": "Avg units",
                "data": holiday_sales.reindex([0,1]).fillna(0).astype(float).tolist(),
            }
        ],
    }
    
    return {
        "image": _fig_to_base64(fig),
        "title": "Holiday Impact Analysis",
        "explanation": explanation,
        "chart_data": chart_payload,
    }
