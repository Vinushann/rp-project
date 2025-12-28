/**
 * Type definitions for the chat application.
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentStep {
  agent_name: string;
  task_name: string;
  summary?: string;
  output_preview?: string;
}

export interface ChartData {
  image: string | null;
  title: string;
  explanation: string;
  chart_data?: {
    chart_type: 'line' | 'bar' | 'pie' | string;
    labels: string[];
    datasets: { label: string; data: number[] }[];
  } | null;
}

export interface ChatRequest {
  message: string;
  conversation_history: Message[];
}

export interface ChatResponse {
  response: string;
  agents_used: string[];
  reasoning_steps: AgentStep[];
  routing_reasoning?: string;
  charts?: ChartData[];
}
