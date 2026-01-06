"""
Report Generator Service
========================
Uses ChatGPT to generate role-specific report content based on data summaries.
"""

import os
from typing import Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


def get_openai_client() -> OpenAI:
    """Get OpenAI client with API key from environment."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)


def generate_manager_report(daily_summary: Dict[str, Any], forecast_data: Optional[Dict] = None) -> str:
    """
    Generate a daily snapshot report for the Manager.
    Focus: Daily snapshot + forecast vs actual (if available)
    """
    if not daily_summary.get("has_data"):
        return f"No data available for {daily_summary.get('date', 'the selected date')}."
    
    # Build context for ChatGPT
    context = f"""
Daily Sales Summary for {daily_summary['date']}:
- Total Items Sold: {daily_summary['total_qty']}
- Gross Revenue: Rs. {daily_summary['gross_revenue']:,.2f}
- Total Discounts: Rs. {daily_summary['total_discount']:,.2f}
- Net Revenue: Rs. {daily_summary['net_revenue']:,.2f}
- Discount Rate: {daily_summary['discount_rate']}%
- Number of Transactions: {daily_summary['transaction_count']}

Top Selling Items:
{chr(10).join([f"  - {item}: {qty} units" for item, qty in daily_summary['top_items'].items()])}

Order Type Breakdown:
{chr(10).join([f"  - {order_type}: {qty} units" for order_type, qty in daily_summary['order_types'].items()])}

Weather & Context:
- Holiday: {'Yes - ' + (daily_summary['holiday_name'] or 'Holiday') if daily_summary['is_holiday'] else 'No'}
- Rainy: {'Yes' if daily_summary['is_rainy'] else 'No'}
- Average Temperature: {daily_summary['avg_temp']}°C
"""
    
    if forecast_data:
        context += f"""
Forecast Data:
- Forecasted Quantity: {forecast_data.get('forecast_qty', 'N/A')}
- Forecast Accuracy: {forecast_data.get('accuracy', 'N/A')}%
- Variance: {forecast_data.get('variance', 'N/A')}
"""
    
    prompt = f"""You are a business analytics assistant. Generate a concise daily report email for a Coffee Shop Manager.

IMPORTANT RULES:
1. ONLY use the exact numbers provided below. Do NOT invent or estimate any numbers.
2. Keep it professional but friendly.
3. Highlight key insights and actionable items.
4. Format for easy reading with bullet points.
5. Keep it under 250 words.

DATA:
{context}

Generate the email body (no subject line needed). Start with a greeting and end with a brief closing."""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful business analytics assistant that creates concise, data-driven reports. Never invent numbers - only use what is provided."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=500,
        temperature=0.7,
    )
    
    return response.choices[0].message.content


def generate_owner_report(daily_summary: Dict[str, Any], monthly_summary: Dict[str, Any], accuracy_data: Optional[Dict] = None) -> str:
    """
    Generate a monthly trend report for the Owner.
    Focus: Month trend summary + model accuracy (if available)
    """
    if not monthly_summary.get("has_data"):
        return f"No data available for {monthly_summary.get('month', 'the selected month')}."
    
    # Build context for ChatGPT
    context = f"""
Monthly Performance Summary ({monthly_summary['month']}):
- Total Items Sold (MTD): {monthly_summary['total_qty']}
- Gross Revenue (MTD): Rs. {monthly_summary['gross_revenue']:,.2f}
- Total Discounts (MTD): Rs. {monthly_summary['total_discount']:,.2f}
- Net Revenue (MTD): Rs. {monthly_summary['net_revenue']:,.2f}
- Days of Data: {monthly_summary['days_in_data']}

Daily Averages:
- Average Daily Quantity: {monthly_summary['avg_daily_qty']} items
- Average Daily Revenue: Rs. {monthly_summary['avg_daily_revenue']:,.2f}
"""
    
    if monthly_summary.get('prev_month_revenue'):
        context += f"""
Month-over-Month Comparison:
- Previous Month Revenue: Rs. {monthly_summary['prev_month_revenue']:,.2f}
- Revenue Change: {monthly_summary['revenue_change_percent']:+.2f}%
"""
    
    if daily_summary.get("has_data"):
        context += f"""
Today's Snapshot ({daily_summary['date']}):
- Net Revenue: Rs. {daily_summary['net_revenue']:,.2f}
- Items Sold: {daily_summary['total_qty']}
"""
    
    if accuracy_data:
        context += f"""
Model Accuracy Metrics:
- Overall Accuracy: {accuracy_data.get('overall_accuracy', 'N/A')}%
- MAPE: {accuracy_data.get('mape', 'N/A')}%
"""
    
    prompt = f"""You are a business analytics assistant. Generate a monthly overview report email for a Coffee Shop Owner.

IMPORTANT RULES:
1. ONLY use the exact numbers provided below. Do NOT invent or estimate any numbers.
2. Focus on trends and strategic insights.
3. Be concise but comprehensive.
4. Include recommendations where appropriate based on the data.
5. Keep it under 300 words.

DATA:
{context}

Generate the email body (no subject line needed). Start with a greeting and end with a brief closing."""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful business analytics assistant that creates strategic, data-driven reports for business owners. Never invent numbers - only use what is provided."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=600,
        temperature=0.7,
    )
    
    return response.choices[0].message.content


def generate_finance_report(daily_summary: Dict[str, Any], monthly_summary: Dict[str, Any]) -> str:
    """
    Generate a revenue-only report for Finance.
    Focus: Revenue totals only (gross, discount, net)
    """
    if not daily_summary.get("has_data") and not monthly_summary.get("has_data"):
        return "No financial data available for the selected date."
    
    # Build context for ChatGPT - Finance only sees revenue numbers
    context = ""
    
    if daily_summary.get("has_data"):
        context += f"""
Daily Financial Summary ({daily_summary['date']}):
- Gross Revenue: Rs. {daily_summary['gross_revenue']:,.2f}
- Total Discounts Applied: Rs. {daily_summary['total_discount']:,.2f}
- Net Revenue: Rs. {daily_summary['net_revenue']:,.2f}
- Effective Discount Rate: {daily_summary['discount_rate']}%
"""
    
    if monthly_summary.get("has_data"):
        context += f"""
Month-to-Date Financial Summary ({monthly_summary['month']}):
- Gross Revenue (MTD): Rs. {monthly_summary['gross_revenue']:,.2f}
- Total Discounts (MTD): Rs. {monthly_summary['total_discount']:,.2f}
- Net Revenue (MTD): Rs. {monthly_summary['net_revenue']:,.2f}
"""
        if monthly_summary.get('prev_month_revenue'):
            context += f"""- Previous Month Net Revenue: Rs. {monthly_summary['prev_month_revenue']:,.2f}
- Month-over-Month Change: {monthly_summary['revenue_change_percent']:+.2f}%
"""
    
    prompt = f"""You are a financial reporting assistant. Generate a concise financial summary email for the Finance team.

IMPORTANT RULES:
1. ONLY use the exact numbers provided below. Do NOT invent or estimate any numbers.
2. Focus ONLY on revenue figures - gross, discounts, and net.
3. Be formal and precise.
4. Use clear financial language.
5. Keep it under 150 words.

DATA:
{context}

Generate the email body (no subject line needed). Start with a brief greeting and end formally."""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a financial reporting assistant that creates precise, numbers-focused reports. Never invent numbers - only use what is provided."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=300,
        temperature=0.5,
    )
    
    return response.choices[0].message.content


def generate_slack_digest(daily_summary: Dict[str, Any], forecast_data: Optional[Dict] = None) -> str:
    """
    Generate a short Slack digest message.
    Focus: Date, total qty, net revenue, forecast vs actual, flags (holiday/rainy/no data)
    """
    if not daily_summary.get("has_data"):
        return f"📊 *Daily Digest - {daily_summary.get('date', 'Unknown')}*\n❌ No data available"
    
    # Build flags
    flags = []
    if daily_summary.get('is_holiday'):
        holiday_name = daily_summary.get('holiday_name', 'Holiday')
        flags.append(f"🎉 {holiday_name}")
    if daily_summary.get('is_rainy'):
        flags.append("🌧️ Rainy")
    
    # Build message
    message = f"""📊 *Daily Sales Digest - {daily_summary['date']}*

📦 *Total Quantity:* {daily_summary['total_qty']:,} items
💰 *Net Revenue:* Rs. {daily_summary['net_revenue']:,.2f}
🏷️ *Discounts:* Rs. {daily_summary['total_discount']:,.2f} ({daily_summary['discount_rate']}%)"""
    
    if forecast_data and forecast_data.get('forecast_qty'):
        variance = daily_summary['total_qty'] - forecast_data['forecast_qty']
        variance_pct = (variance / forecast_data['forecast_qty'] * 100) if forecast_data['forecast_qty'] > 0 else 0
        emoji = "📈" if variance >= 0 else "📉"
        message += f"\n{emoji} *Forecast vs Actual:* {variance:+,} ({variance_pct:+.1f}%)"
    
    if flags:
        message += f"\n🏷️ *Flags:* {' | '.join(flags)}"
    
    return message
