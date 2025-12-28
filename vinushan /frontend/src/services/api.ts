/**
 * API service for communicating with the backend.
 */

import { ChatRequest, ChatResponse } from '../types';

const API_BASE_URL = '/api';

export async function sendChatMessage(
  message: string,
  conversationHistory: ChatRequest['conversation_history']
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    } as ChatRequest),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to send message';
    try {
      const error = await response.json();
      errorMessage = error.detail || errorMessage;
    } catch {
      // Response was not JSON
      errorMessage = `Server error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from server');
  }
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch('/health');
    return response.ok;
  } catch {
    return false;
  }
}
