from __future__ import annotations

import os
from typing import List

from crewai import Agent, Crew, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, crew, task
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

from contextawareforecastingsys import CONFIG_DIR, REPORTS_DIR
from contextawareforecastingsys.tools import (
    ForecastingTool,
    HolidayContextTool,
    ItemHistoryTool,
    WeatherContextTool,
)

load_dotenv(override=False)


@CrewBase
class Contextawareforecastingsys():
    """Contextawareforecastingsys crew"""

    agents: List[BaseAgent]
    tasks: List[Task]

    agents_config = str(CONFIG_DIR / "agents.yaml")
    tasks_config = str(CONFIG_DIR / "tasks.yaml")

    llm = ChatOpenAI(
        model=os.getenv("MODEL", "gpt-4o-mini"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
        timeout=120,
    )

    item_history_tool = ItemHistoryTool()
    forecasting_tool = ForecastingTool()
    holiday_tool = HolidayContextTool()
    weather_tool = WeatherContextTool()

    @agent
    def historical_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["historical_analyst"],
            verbose=False,
            tools=[self.item_history_tool],
            llm=self.llm,
        )

    @agent
    def forecasting_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config["forecasting_specialist"],
            verbose=False,
            tools=[self.forecasting_tool],
            llm=self.llm,
        )

    @agent
    def holiday_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["holiday_analyst"],
            verbose=False,
            tools=[self.holiday_tool],
            llm=self.llm,
        )

    @agent
    def weather_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["weather_analyst"],
            verbose=False,
            tools=[self.weather_tool],
            llm=self.llm,
        )

    @agent
    def strategy_planner(self) -> Agent:
        return Agent(
            config=self.agents_config["strategy_planner"],
            verbose=False,
            llm=self.llm,
        )

    @task
    def historical_task(self) -> Task:
        return Task(
            config=self.tasks_config["historical_task"],
            llm=self.llm,
        )

    @task
    def forecasting_task(self) -> Task:
        return Task(
            config=self.tasks_config["forecasting_task"],
            llm=self.llm,
        )

    @task
    def holiday_task(self) -> Task:
        return Task(
            config=self.tasks_config["holiday_task"],
            llm=self.llm,
        )

    @task
    def weather_task(self) -> Task:
        return Task(
            config=self.tasks_config["weather_task"],
            llm=self.llm,
        )

    @task
    def strategy_task(self) -> Task:
        return Task(
            config=self.tasks_config["strategy_task"],
            output_file=str(REPORTS_DIR / "monthly_plan.md"),
            llm=self.llm,
        )

    @crew
    def crew(self) -> Crew:
        """Creates the Contextawareforecastingsys crew"""

        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=False,
        )