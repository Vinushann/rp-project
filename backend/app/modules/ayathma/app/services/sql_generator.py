"""
SQL Query Generator
===================

Generates dynamic SQL queries based on visualization specifications.
Creates SELECT statements that would reproduce the chart data from a database table.
"""

from __future__ import annotations
from typing import Dict, List, Any, Optional
import re


def _sanitize_identifier(name: str) -> str:
    """Sanitize column/table names for SQL (wrap in quotes if needed)."""
    # If contains spaces or special chars, wrap in double quotes
    if re.search(r'[^a-zA-Z0-9_]', name):
        return f'"{name}"'
    return name


def _format_value(value: Any) -> str:
    """Format a value for SQL."""
    if value is None:
        return "NULL"
    if isinstance(value, str):
        # Escape single quotes
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    return str(value)


def generate_aggregation_sql(
    table_name: str,
    group_col: str,
    measure_col: str,
    aggregation: str = "SUM",
    order_by: str = "DESC",
    limit: Optional[int] = 10,
    filters: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate SQL for grouped aggregation (bar charts, top-N, etc.)
    
    Example output:
        SELECT category, SUM(revenue) as total_revenue
        FROM sales_data
        GROUP BY category
        ORDER BY total_revenue DESC
        LIMIT 10
    """
    table = _sanitize_identifier(table_name)
    group = _sanitize_identifier(group_col)
    measure = _sanitize_identifier(measure_col)
    agg = aggregation.upper()
    
    alias = f"{agg.lower()}_{measure_col}".replace('"', '').replace(' ', '_')
    
    sql_parts = [
        f"SELECT {group}, {agg}({measure}) AS {alias}",
        f"FROM {table}"
    ]
    
    # Add WHERE clause if filters provided
    if filters:
        conditions = []
        for col, val in filters.items():
            col_safe = _sanitize_identifier(col)
            if isinstance(val, (list, tuple)):
                vals = ", ".join(_format_value(v) for v in val)
                conditions.append(f"{col_safe} IN ({vals})")
            else:
                conditions.append(f"{col_safe} = {_format_value(val)}")
        if conditions:
            sql_parts.append(f"WHERE {' AND '.join(conditions)}")
    
    sql_parts.append(f"GROUP BY {group}")
    sql_parts.append(f"ORDER BY {alias} {order_by}")
    
    if limit:
        sql_parts.append(f"LIMIT {limit}")
    
    return "\n".join(sql_parts) + ";"


def generate_time_series_sql(
    table_name: str,
    time_col: str,
    measure_col: str,
    aggregation: str = "SUM",
    time_grain: str = "day",
    filters: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate SQL for time-series aggregation (line charts, trends).
    
    Example output:
        SELECT DATE_TRUNC('day', order_date) AS period,
               SUM(revenue) AS total_revenue
        FROM sales_data
        GROUP BY DATE_TRUNC('day', order_date)
        ORDER BY period ASC
    """
    table = _sanitize_identifier(table_name)
    time = _sanitize_identifier(time_col)
    measure = _sanitize_identifier(measure_col)
    agg = aggregation.upper()
    
    alias = f"{agg.lower()}_{measure_col}".replace('"', '').replace(' ', '_')
    
    # Time truncation (PostgreSQL style, adaptable)
    time_expr = f"DATE_TRUNC('{time_grain}', {time})"
    
    sql_parts = [
        f"SELECT {time_expr} AS period,",
        f"       {agg}({measure}) AS {alias}",
        f"FROM {table}"
    ]
    
    # Add WHERE clause if filters provided
    if filters:
        conditions = []
        for col, val in filters.items():
            col_safe = _sanitize_identifier(col)
            if isinstance(val, (list, tuple)):
                vals = ", ".join(_format_value(v) for v in val)
                conditions.append(f"{col_safe} IN ({vals})")
            else:
                conditions.append(f"{col_safe} = {_format_value(val)}")
        if conditions:
            sql_parts.append(f"WHERE {' AND '.join(conditions)}")
    
    sql_parts.append(f"GROUP BY {time_expr}")
    sql_parts.append("ORDER BY period ASC;")
    
    return "\n".join(sql_parts)


def generate_distribution_sql(
    table_name: str,
    measure_col: str,
    filters: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate SQL for distribution statistics (min, max, avg, percentiles).
    
    Example output:
        SELECT 
            MIN(price) AS min_value,
            MAX(price) AS max_value,
            AVG(price) AS avg_value,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median
        FROM products
    """
    table = _sanitize_identifier(table_name)
    measure = _sanitize_identifier(measure_col)
    
    sql_parts = [
        "SELECT",
        f"    MIN({measure}) AS min_value,",
        f"    MAX({measure}) AS max_value,",
        f"    AVG({measure}) AS avg_value,",
        f"    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY {measure}) AS p25,",
        f"    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {measure}) AS median,",
        f"    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY {measure}) AS p75",
        f"FROM {table}"
    ]
    
    if filters:
        conditions = []
        for col, val in filters.items():
            col_safe = _sanitize_identifier(col)
            conditions.append(f"{col_safe} = {_format_value(val)}")
        if conditions:
            sql_parts.append(f"WHERE {' AND '.join(conditions)}")
    
    return "\n".join(sql_parts) + ";"


def generate_comparison_sql(
    table_name: str,
    time_col: str,
    measure_col: str,
    period_a_start: str,
    period_a_end: str,
    period_b_start: str,
    period_b_end: str,
    aggregation: str = "SUM"
) -> str:
    """
    Generate SQL for period-over-period comparison.
    
    Example output:
        SELECT 
            'Period A' AS period,
            SUM(revenue) AS total
        FROM sales
        WHERE order_date BETWEEN '2024-01-01' AND '2024-01-31'
        UNION ALL
        SELECT 
            'Period B' AS period,
            SUM(revenue) AS total
        FROM sales
        WHERE order_date BETWEEN '2024-02-01' AND '2024-02-28'
    """
    table = _sanitize_identifier(table_name)
    time = _sanitize_identifier(time_col)
    measure = _sanitize_identifier(measure_col)
    agg = aggregation.upper()
    
    sql = f"""SELECT 
    'Period A ({period_a_start} to {period_a_end})' AS period,
    {agg}({measure}) AS total
FROM {table}
WHERE {time} BETWEEN '{period_a_start}' AND '{period_a_end}'

UNION ALL

SELECT 
    'Period B ({period_b_start} to {period_b_end})' AS period,
    {agg}({measure}) AS total
FROM {table}
WHERE {time} BETWEEN '{period_b_start}' AND '{period_b_end}';"""
    
    return sql


def generate_heatmap_sql(
    table_name: str,
    time_col: str,
    measure_col: str,
    aggregation: str = "SUM"
) -> str:
    """
    Generate SQL for day/hour heatmap.
    
    Example output:
        SELECT 
            EXTRACT(DOW FROM order_date) AS day_of_week,
            EXTRACT(HOUR FROM order_date) AS hour,
            SUM(revenue) AS total
        FROM sales
        GROUP BY day_of_week, hour
        ORDER BY day_of_week, hour
    """
    table = _sanitize_identifier(table_name)
    time = _sanitize_identifier(time_col)
    measure = _sanitize_identifier(measure_col)
    agg = aggregation.upper()
    
    sql = f"""SELECT 
    EXTRACT(DOW FROM {time}) AS day_of_week,
    EXTRACT(HOUR FROM {time}) AS hour,
    {agg}({measure}) AS total
FROM {table}
GROUP BY day_of_week, hour
ORDER BY day_of_week, hour;"""
    
    return sql


def generate_top_n_sql(
    table_name: str,
    group_col: str,
    measure_col: str,
    n: int = 10,
    aggregation: str = "SUM"
) -> str:
    """
    Generate SQL for top-N analysis.
    """
    return generate_aggregation_sql(
        table_name=table_name,
        group_col=group_col,
        measure_col=measure_col,
        aggregation=aggregation,
        order_by="DESC",
        limit=n
    )


def generate_sql_for_card(
    card: Dict[str, Any],
    table_name: str,
    selected: Dict[str, Any]
) -> Optional[str]:
    """
    Generate appropriate SQL based on card type and content.
    
    Args:
        card: Insight card dictionary with title, chart, table data
        table_name: Name of the source table/dataset
        selected: Selected columns (measure, dimension, time)
        
    Returns:
        SQL query string or None if cannot generate
    """
    chart = card.get("chart", {})
    chart_type = chart.get("type", "bar")
    x_col = chart.get("x")
    y_col = chart.get("y")
    card_id = card.get("id", "")
    title = card.get("title", "").lower()
    
    measure = selected.get("measure") or y_col
    dimension = selected.get("dimension") or x_col
    time_col = selected.get("time")
    
    # Clean table name (remove extension)
    clean_table = table_name.replace(".csv", "").replace(".xlsx", "").replace(".xls", "")
    clean_table = re.sub(r'[^a-zA-Z0-9_]', '_', clean_table)
    
    # Determine query type based on card characteristics
    if not measure:
        return None
    
    # Time series / trend charts
    if chart_type == "line" or "trend" in title or "over time" in title or "daily" in title or "monthly" in title:
        if time_col:
            grain = "month" if "monthly" in title else "day"
            return generate_time_series_sql(
                table_name=clean_table,
                time_col=time_col,
                measure_col=measure,
                aggregation="SUM",
                time_grain=grain
            )
    
    # Distribution analysis
    if "distribution" in title or "range" in title:
        return generate_distribution_sql(
            table_name=clean_table,
            measure_col=measure
        )
    
    # Top-N / categorical breakdown
    if dimension and dimension != measure:
        # Check if it's a "top" or "by category" type
        limit = 10
        if "top 5" in title:
            limit = 5
        elif "top 20" in title:
            limit = 20
        
        return generate_aggregation_sql(
            table_name=clean_table,
            group_col=dimension,
            measure_col=measure,
            aggregation="SUM",
            limit=limit
        )
    
    # Heatmap
    if "heatmap" in title or "by day" in title and "hour" in title:
        if time_col:
            return generate_heatmap_sql(
                table_name=clean_table,
                time_col=time_col,
                measure_col=measure
            )
    
    # Default: simple aggregation if we have x and y
    if x_col and y_col:
        return generate_aggregation_sql(
            table_name=clean_table,
            group_col=x_col,
            measure_col=y_col,
            aggregation="SUM",
            limit=10
        )
    
    return None


def generate_kpi_sql(
    table_name: str,
    kpi_name: str,
    columns: Dict[str, Optional[str]]
) -> Optional[str]:
    """
    Generate SQL for KPI calculations.
    
    Args:
        table_name: Source table name
        kpi_name: Name of the KPI (e.g., "Total Revenue", "AOV")
        columns: Dict mapping role to column name
        
    Returns:
        SQL query string
    """
    clean_table = table_name.replace(".csv", "").replace(".xlsx", "")
    clean_table = re.sub(r'[^a-zA-Z0-9_]', '_', clean_table)
    
    revenue_col = columns.get("revenue")
    cost_col = columns.get("cost")
    quantity_col = columns.get("quantity")
    order_id_col = columns.get("order_id")
    
    kpi_lower = kpi_name.lower()
    
    if "total revenue" in kpi_lower and revenue_col:
        col = _sanitize_identifier(revenue_col)
        return f"SELECT SUM({col}) AS total_revenue\nFROM {clean_table};"
    
    if "orders" in kpi_lower or "order count" in kpi_lower:
        if order_id_col:
            col = _sanitize_identifier(order_id_col)
            return f"SELECT COUNT(DISTINCT {col}) AS order_count\nFROM {clean_table};"
        return f"SELECT COUNT(*) AS row_count\nFROM {clean_table};"
    
    if "aov" in kpi_lower or "average order" in kpi_lower:
        if revenue_col and order_id_col:
            rev = _sanitize_identifier(revenue_col)
            oid = _sanitize_identifier(order_id_col)
            return f"""SELECT SUM({rev}) / COUNT(DISTINCT {oid}) AS aov
FROM {clean_table};"""
    
    if "items sold" in kpi_lower and quantity_col:
        col = _sanitize_identifier(quantity_col)
        return f"SELECT SUM({col}) AS items_sold\nFROM {clean_table};"
    
    if "gross margin" in kpi_lower and revenue_col and cost_col:
        rev = _sanitize_identifier(revenue_col)
        cost = _sanitize_identifier(cost_col)
        return f"""SELECT 
    (SUM({rev}) - SUM({cost})) / NULLIF(SUM({rev}), 0) AS gross_margin
FROM {clean_table};"""
    
    return None
