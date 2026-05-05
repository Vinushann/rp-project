import pandas as pd
import numpy as np
import os
from typing import Dict, List, Any, Optional

def process_menu_classification(
    file_content: bytes, 
    filename: str, 
    mode: str = 'static',
    qty_threshold: float = 3000,
    profit_threshold: float = 60,
    column_mapping: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Process menu classification analysis from an uploaded file.
    """
    # Load data
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(pd.io.common.BytesIO(file_content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(pd.io.common.BytesIO(file_content))
        else:
            return {"success": False, "message": "Unsupported file format. Please upload CSV or Excel."}
    except Exception as e:
        return {"success": False, "message": f"Error reading file: {str(e)}"}

    df_cleaned = pd.DataFrame()

    # Use provided mapping if available, otherwise use heuristics
    if column_mapping:
        for target, source in column_mapping.items():
            if source in df.columns:
                df_cleaned[target] = df[source]
            elif source: # If a mapping was provided but column missing
                return {"success": False, "message": f"Column '{source}' not found in file."}
    else:
        # Flexible column mapping (heuristics)
        col_map = {
            'item_name': ['Name Full', 'Item Name', 'Name', 'Item', 'Product'],
            'qty': ['Total sold qty', 'Quantity', 'Qty', 'Sold Qty', 'Total Qty'],
            'margin': ['Profit Margin', 'Margin %', 'Margin', 'Profit Margin (%)'],
            'price': ['Selling Price', 'Price', 'Selling_Price'],
            'profit': ['Profit', 'Total Profit', 'Net Profit'],
            'category': ['Main Category', 'Category', 'Main_Category']
        }

        for target, alternatives in col_map.items():
            for alt in alternatives:
                if alt in df.columns:
                    df_cleaned[target] = df[alt]
                    break
            
            if target not in df_cleaned.columns:
                # Try case-insensitive search
                for col in df.columns:
                    if col.lower().strip() in [a.lower() for a in alternatives]:
                        df_cleaned[target] = df[col]
                        break

    # Validate required columns for analysis
    required = ['item_name', 'qty', 'margin']
    missing = [r for r in required if r not in df_cleaned.columns]
    if missing:
        return {
            "success": False, 
            "message": f"Missing required columns: {', '.join(missing)}. Please ensure your file has item names, quantities, and profit margins."
        }

    # Fill optional columns with defaults if missing
    if 'price' not in df_cleaned.columns:
        df_cleaned['price'] = 0
    if 'profit' not in df_cleaned.columns:
        df_cleaned['profit'] = 0
    if 'category' not in df_cleaned.columns:
        df_cleaned['category'] = 'Uncategorized'

    # Clean numeric data
    for col in ['qty', 'margin', 'price', 'profit']:
        df_cleaned[col] = pd.to_numeric(df_cleaned[col], errors='coerce').fillna(0)

    # Calculate Total Sale Value if missing
    df_cleaned['revenue'] = df_cleaned['qty'] * df_cleaned['price']

    # 1. Calculate Dynamic Indexes (Z-scores)
    # Pop Index: Z-score of Revenue (or Qty if revenue is zero)
    # Using Population Std (ddof=0) as per Dash code
    mean_rev = df_cleaned['revenue'].mean()
    std_rev = df_cleaned['revenue'].std(ddof=0)
    if std_rev > 0:
        df_cleaned['pop_index'] = (df_cleaned['revenue'] - mean_rev) / std_rev
    else:
        # Fallback to qty if revenue isn't useful
        mean_qty = df_cleaned['qty'].mean()
        std_qty = df_cleaned['qty'].std(ddof=0)
        df_cleaned['pop_index'] = (df_cleaned['qty'] - mean_qty) / std_qty if std_qty > 0 else 0

    # Margin Index: Z-score of Profit Margin
    mean_margin = df_cleaned['margin'].mean()
    std_margin = df_cleaned['margin'].std(ddof=0)
    df_cleaned['margin_index'] = (df_cleaned['margin'] - mean_margin) / std_margin if std_margin > 0 else 0

    # 2. Classification
    def classify(row):
        if mode == 'static':
            high_sales = row['qty'] > qty_threshold
            high_profit = row['margin'] > profit_threshold
        else: # index mode
            high_sales = row['pop_index'] > 0
            high_profit = row['margin_index'] > 0
        
        if high_sales and high_profit:
            return 'Cash Cow'
        elif high_sales and not high_profit:
            return 'Margin Risk'
        elif not high_sales and high_profit:
            return 'Low Impact'
        else:
            return 'Unproductive'

    df_cleaned['quadrant'] = df_cleaned.apply(classify, axis=1)

    # 3. Prepare Chart Data
    # Scatter Data
    scatter_data = df_cleaned.to_dict('records')

    # Pie Data
    quadrant_counts = df_cleaned['quadrant'].value_counts().to_dict()
    pie_data = [{"name": k, "value": int(v)} for k, v in quadrant_counts.items()]

    # Bar Data (Top items by revenue)
    top_items = df_cleaned.sort_values('revenue', ascending=False).head(20).to_dict('records')

    # 4. Calculate KPIs
    kpis = {
        "total_items": len(df_cleaned),
        "cash_cows": int(quadrant_counts.get('Cash Cow', 0)),
        "margin_risk": int(quadrant_counts.get('Margin Risk', 0)),
        "avg_margin": f"{df_cleaned['margin'].mean():.1f}%",
        "avg_revenue": f"LKR {df_cleaned['revenue'].mean():,.0f}"
    }

    return {
        "success": True,
        "data": {
            "items": scatter_data,
            "charts": {
                "pie": pie_data,
                "top_items": top_items
            },
            "kpis": kpis,
            "thresholds": {
                "qty": qty_threshold,
                "margin": profit_threshold
            },
            "mode": mode
        }
    }
