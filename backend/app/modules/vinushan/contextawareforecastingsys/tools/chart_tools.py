"""CrewAI tools for generating visualizations and charts."""
from __future__ import annotations

import json
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from .visualization_tools import (
    create_sales_trend_chart,
    create_top_items_chart,
    create_daily_pattern_chart,
    create_monthly_comparison_chart,
    create_category_pie_chart,
    create_weather_impact_chart,
    create_holiday_impact_chart,
)


class SalesTrendInput(BaseModel):
    item_name: Optional[str] = Field(None, description="Specific item to analyze (leave empty for all items)")
    months: int = Field(6, ge=1, le=24, description="Number of months to show in the trend")
    group_by: str = Field("month", description="Group data by: 'day', 'week', or 'month'")


class SalesTrendChartTool(BaseTool):
    name: str = "Sales Trend Chart Tool"
    description: str = (
        "Generate a line chart showing sales trends over time. "
        "Shows total units sold with a trend line. "
        "Use when manager asks about sales trends, growth patterns, or wants to see sales over time."
    )
    args_schema: Type[BaseModel] = SalesTrendInput

    def _run(self, item_name: Optional[str] = None, months: int = 6, group_by: str = "month") -> str:
        result = create_sales_trend_chart(item_name=item_name, months=months, group_by=group_by)
        return json.dumps(result, indent=2)


class TopItemsInput(BaseModel):
    month: Optional[int] = Field(None, ge=1, le=12, description="Specific month (1-12), leave empty for all time")
    year: Optional[int] = Field(None, description="Specific year, leave empty for all years")
    top_n: int = Field(10, ge=5, le=20, description="Number of top items to show")


class TopItemsChartTool(BaseTool):
    name: str = "Top Items Chart Tool"
    description: str = (
        "Generate a bar chart showing the top selling items. "
        "Use when manager asks about best sellers, most popular items, or wants to see item rankings."
    )
    args_schema: Type[BaseModel] = TopItemsInput

    def _run(self, month: Optional[int] = None, year: Optional[int] = None, top_n: int = 10) -> str:
        result = create_top_items_chart(month=month, year=year, top_n=top_n)
        return json.dumps(result, indent=2)


class DailyPatternInput(BaseModel):
    item_name: Optional[str] = Field(None, description="Specific item to analyze (leave empty for all items)")


class DailyPatternChartTool(BaseTool):
    name: str = "Daily Pattern Chart Tool"
    description: str = (
        "Generate a chart showing sales patterns by day of the week. "
        "Use when manager asks about busiest days, weekend vs weekday sales, or daily patterns."
    )
    args_schema: Type[BaseModel] = DailyPatternInput

    def _run(self, item_name: Optional[str] = None) -> str:
        result = create_daily_pattern_chart(item_name=item_name)
        return json.dumps(result, indent=2)


class YearComparisonInput(BaseModel):
    year1: int = Field(..., description="First year to compare")
    year2: int = Field(..., description="Second year to compare")
    item_name: Optional[str] = Field(None, description="Specific item to analyze (leave empty for all items)")


class YearComparisonChartTool(BaseTool):
    name: str = "Year Comparison Chart Tool"
    description: str = (
        "Generate a chart comparing sales between two years. "
        "Use when manager asks about year-over-year comparison, growth, or comparing different years."
    )
    args_schema: Type[BaseModel] = YearComparisonInput

    def _run(self, year1: int, year2: int, item_name: Optional[str] = None) -> str:
        result = create_monthly_comparison_chart(year1=year1, year2=year2, item_name=item_name)
        return json.dumps(result, indent=2)


class CategoryChartInput(BaseModel):
    month: Optional[int] = Field(None, ge=1, le=12, description="Specific month (1-12)")
    year: Optional[int] = Field(None, description="Specific year")


class CategoryPieChartTool(BaseTool):
    name: str = "Category Distribution Chart Tool"
    description: str = (
        "Generate a pie chart showing sales distribution by product category. "
        "Use when manager asks about category breakdown, product mix, or sales composition."
    )
    args_schema: Type[BaseModel] = CategoryChartInput

    def _run(self, month: Optional[int] = None, year: Optional[int] = None) -> str:
        result = create_category_pie_chart(month=month, year=year)
        return json.dumps(result, indent=2)


class WeatherImpactChartTool(BaseTool):
    name: str = "Weather Impact Chart Tool"
    description: str = (
        "Generate charts showing how weather (rain and temperature) affects sales. "
        "Use when manager asks about weather impact, rain effects, or temperature effects on sales."
    )
    args_schema: Type[BaseModel] = BaseModel  # No inputs needed

    def _run(self) -> str:
        result = create_weather_impact_chart()
        return json.dumps(result, indent=2)


class HolidayImpactChartTool(BaseTool):
    name: str = "Holiday Impact Chart Tool"
    description: str = (
        "Generate a chart showing how holidays affect sales compared to regular days. "
        "Use when manager asks about holiday impact, festival effects, or comparing holiday vs normal days."
    )
    args_schema: Type[BaseModel] = BaseModel  # No inputs needed

    def _run(self) -> str:
        result = create_holiday_impact_chart()
        return json.dumps(result, indent=2)
