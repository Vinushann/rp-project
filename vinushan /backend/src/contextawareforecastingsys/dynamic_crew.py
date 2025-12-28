"""
Dynamic Crew Builder - Creates crews with only the agents needed for the specific question.
"""

from __future__ import annotations

import os
from typing import List

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

from contextawareforecastingsys.tools import (
    ForecastingTool,
    HolidayContextTool,
    ItemHistoryTool,
    WeatherContextTool,
    SalesTrendChartTool,
    TopItemsChartTool,
    DailyPatternChartTool,
    YearComparisonChartTool,
    CategoryPieChartTool,
    WeatherImpactChartTool,
    HolidayImpactChartTool,
)

load_dotenv(override=False)


class DynamicCrewBuilder:
    """Builds a crew dynamically based on which agents are needed."""

    def __init__(self):
        self.llm = ChatOpenAI(
            model=os.getenv("MODEL", "gpt-4o-mini"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
            timeout=120,
        )
        
        # Initialize tools
        self.item_history_tool = ItemHistoryTool()
        self.forecasting_tool = ForecastingTool()
        self.holiday_tool = HolidayContextTool()
        self.weather_tool = WeatherContextTool()
        
        # Visualization tools
        self.sales_trend_chart = SalesTrendChartTool()
        self.top_items_chart = TopItemsChartTool()
        self.daily_pattern_chart = DailyPatternChartTool()
        self.year_comparison_chart = YearComparisonChartTool()
        self.category_pie_chart = CategoryPieChartTool()
        self.weather_impact_chart = WeatherImpactChartTool()
        self.holiday_impact_chart = HolidayImpactChartTool()

    def _create_historical_agent(self) -> Agent:
        return Agent(
            role="Coffee shop sales historian",
            goal="Analyze historical sales patterns, trends, and item performance",
            backstory="Expert in analyzing past sales data to identify trends, top sellers, and declining items.",
            verbose=False,
            tools=[self.item_history_tool],
            llm=self.llm,
            max_iter=3,
            allow_delegation=False,
        )

    def _create_forecasting_agent(self) -> Agent:
        return Agent(
            role="Daily demand forecaster",
            goal="Predict future daily demand and identify busiest days",
            backstory="Specialist in time-series forecasting for retail coffee shop demand.",
            verbose=False,
            tools=[self.forecasting_tool],
            llm=self.llm,
            max_iter=3,
            allow_delegation=False,
        )

    def _create_holiday_agent(self) -> Agent:
        return Agent(
            role="Holiday context analyst",
            goal="Analyze how holidays and festivals affect sales",
            backstory="Expert in Sri Lankan holidays and their impact on coffee shop sales.",
            verbose=False,
            tools=[self.holiday_tool],
            llm=self.llm,
            max_iter=3,
            allow_delegation=False,
        )

    def _create_weather_agent(self) -> Agent:
        return Agent(
            role="Weather impact analyst",
            goal="Analyze weather effects on product demand",
            backstory="Specialist in understanding how rain and temperature affect hot/cold drink sales.",
            verbose=False,
            tools=[self.weather_tool],
            llm=self.llm,
            max_iter=3,
            allow_delegation=False,
        )

    def _create_strategy_agent(self) -> Agent:
        return Agent(
            role="Strategic advisor",
            goal="Synthesize all findings into actionable recommendations",
            backstory="Senior business strategist who combines insights into practical plans.",
            verbose=False,
            llm=self.llm,
            max_iter=2,
            allow_delegation=False,
        )

    def _create_answering_agent(self) -> Agent:
        """Creates an agent that directly answers the manager's question."""
        return Agent(
            role="Direct question answerer",
            goal="Answer the manager's specific question clearly and concisely",
            backstory="Expert at synthesizing data analysis into clear, direct answers.",
            verbose=False,
            llm=self.llm,
            max_iter=2,
            allow_delegation=False,
        )

    def _create_visualization_agent(self) -> Agent:
        """Creates an agent that generates charts and visualizations."""
        return Agent(
            role="Data visualization specialist",
            goal="Create insightful charts and graphs to visualize sales data and explain them clearly",
            backstory="""Expert data analyst who transforms complex sales data into beautiful, 
            easy-to-understand visualizations. You know exactly which chart type works best for 
            each type of question - line charts for trends, bar charts for comparisons, 
            pie charts for distributions.""",
            verbose=False,
            tools=[
                self.sales_trend_chart,
                self.top_items_chart,
                self.daily_pattern_chart,
                self.year_comparison_chart,
                self.category_pie_chart,
                self.weather_impact_chart,
                self.holiday_impact_chart,
            ],
            llm=self.llm,
            max_iter=3,
            allow_delegation=False,
        )

    def _create_historical_task(self, inputs: dict) -> Task:
        return Task(
            description=f"""Analyze historical sales for {inputs.get('target_month_name', 'the target month')}.
            Use the Item History Tool to find:
            - Top selling items
            - Declining items  
            - Items that rely on discounts
            Context: {inputs.get('user_question', '')}""",
            expected_output="JSON with top_items, falling_items, discount_focus lists",
            agent=self._create_historical_agent(),
        )

    def _create_forecasting_task(self, inputs: dict) -> Task:
        return Task(
            description=f"""Forecast daily demand for {inputs.get('target_month_name', '')} {inputs.get('target_year', '')}.
            Use the Daily Forecast Tool to predict:
            - Total expected quantity
            - Busiest days
            - Accuracy metrics (MAE/MAPE)
            Context: {inputs.get('user_question', '')}""",
            expected_output="JSON with predictions, total_qty, busiest_days, and accuracy",
            agent=self._create_forecasting_agent(),
        )

    def _create_holiday_task(self, inputs: dict) -> Task:
        return Task(
            description=f"""Analyze holiday effects for month {inputs.get('target_month', '')}.
            Use the Holiday Context Tool to explain:
            - Each holiday's effect on sales
            - Pre-holiday and post-holiday patterns
            - Recommended actions per holiday
            Context: {inputs.get('user_question', '')}""",
            expected_output="List of holidays with phase, effect_pct, and action",
            agent=self._create_holiday_agent(),
        )

    def _create_weather_task(self, inputs: dict) -> Task:
        return Task(
            description=f"""Analyze weather impact for month {inputs.get('target_month', '')}.
            Use the Weather Context Tool to explain:
            - Rain effects on different product categories
            - Temperature effects on hot vs cold drinks
            Context: {inputs.get('user_question', '')}""",
            expected_output="Rain and temperature impact analysis with recommendations",
            agent=self._create_weather_agent(),
        )

    def _create_strategy_task(self, inputs: dict, context_tasks: List[Task]) -> Task:
        return Task(
            description=f"""Manager asked: "{inputs.get('user_question', '')}"
            
            Combine all prior findings to create a comprehensive action plan.
            Structure your answer with relevant sections:
            - Demand Outlook
            - Promotions  
            - Staffing
            - Inventory
            - Risks
            
            End with a summary table of key metrics.""",
            expected_output="Markdown plan with bullet points and summary table",
            agent=self._create_strategy_agent(),
            context=context_tasks,
            output_file="reports/monthly_plan.md",
        )

    def _create_direct_answer_task(self, inputs: dict, context_tasks: List[Task]) -> Task:
        """Creates a task that directly answers the question without full strategy."""
        return Task(
            description=f"""The manager asked: "{inputs.get('user_question', '')}"
            
            Using the analysis provided, give a DIRECT and FOCUSED answer to this specific question.
            
            Do NOT provide a full business plan unless asked.
            Be concise and answer exactly what was asked.
            Use bullet points for clarity.
            Include specific numbers and data from the analysis.""",
            expected_output="Direct, focused answer to the manager's specific question",
            agent=self._create_answering_agent(),
            context=context_tasks,
        )

    def _create_visualization_task(self, inputs: dict) -> Task:
        """Creates a task that generates appropriate charts based on the question."""
        return Task(
            description=f"""The manager asked: "{inputs.get('user_question', '')}"
            
            Create the most appropriate chart(s) to answer this question visually.
            
            Choose the right chart type:
            - For trends over time → use Sales Trend Chart Tool
            - For best/top sellers → use Top Items Chart Tool
            - For daily patterns (weekday/weekend) → use Daily Pattern Chart Tool
            - For year comparisons → use Year Comparison Chart Tool
            - For category breakdown → use Category Distribution Chart Tool
            - For weather impact → use Weather Impact Chart Tool
            - For holiday impact → use Holiday Impact Chart Tool
            
            After generating the chart, provide a clear explanation of:
            1. What the chart shows
            2. Key insights from the visualization
            3. Actionable recommendations based on the data
            
            IMPORTANT: Include the complete JSON output from the tool in your response.
            The JSON contains the base64 image that will be displayed to the manager.""",
            expected_output="JSON containing the chart image (base64) and a detailed explanation",
            agent=self._create_visualization_agent(),
        )

    def build_crew(self, agents_needed: List[str], inputs: dict, is_comprehensive: bool = False) -> Crew:
        """
        Build a crew with only the needed agents and tasks.
        
        Args:
            agents_needed: List of agent keys (historical, forecasting, holiday, weather, strategy, visualization)
            inputs: The input dictionary with target_month, user_question, etc.
            is_comprehensive: Whether to add a strategy synthesis task
            
        Returns:
            Crew configured with only the needed agents/tasks
        """
        tasks = []
        
        # Check if visualization is requested
        if "visualization" in agents_needed:
            # For visualization requests, just use the visualization agent
            tasks.append(self._create_visualization_task(inputs))
        else:
            # Create tasks for each needed agent (in logical order)
            task_order = ["historical", "forecasting", "holiday", "weather"]
            
            for agent_key in task_order:
                if agent_key in agents_needed:
                    if agent_key == "historical":
                        tasks.append(self._create_historical_task(inputs))
                    elif agent_key == "forecasting":
                        tasks.append(self._create_forecasting_task(inputs))
                    elif agent_key == "holiday":
                        tasks.append(self._create_holiday_task(inputs))
                    elif agent_key == "weather":
                        tasks.append(self._create_weather_task(inputs))
            
            # Add final answering task
            if is_comprehensive or "strategy" in agents_needed:
                tasks.append(self._create_strategy_task(inputs, tasks.copy()))
            else:
                # Add a direct answer task that uses context from previous tasks
                tasks.append(self._create_direct_answer_task(inputs, tasks.copy()))
        
        # Extract agents from tasks
        agents = [task.agent for task in tasks]
        
        return Crew(
            agents=agents,
            tasks=tasks,
            process=Process.sequential,
            verbose=False,
            max_rpm=30,  # Limit API calls per minute
        )
