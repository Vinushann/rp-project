/**
 * API Client Helper
 * =================
 * Centralized API calling functions for all modules.
 * Uses VITE_API_BASE_URL from environment or falls back to proxy.
 */

// Get API base URL from environment or use empty string for proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Ping a module's backend to check if it's running
 * @param {string} moduleName - Name of the module (vinushan, vishva, nandika, ayathma)
 * @returns {Promise<{module: string, status: string}>}
 */
export async function pingModule(moduleName) {
  return apiRequest(`/api/v1/${moduleName}/ping`);
}

/**
 * Send a chat message to a module
 * @param {string} moduleName - Name of the module
 * @param {string} sessionId - Session identifier
 * @param {string} message - The message to send
 * @returns {Promise<{reply: string, session_id: string, module: string}>}
 */
export async function sendChatMessage(moduleName, sessionId, message) {
  return apiRequest(`/api/v1/${moduleName}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      message: message,
    }),
  });
}

/**
 * Send a chat message to the Vinushan context-aware assistant.
 * @param {string} message - User message
 * @param {Array<{role:string, content:string, timestamp:string}>} conversationHistory - Prior messages
 * @returns {Promise<object>} ChatResponse payload
 */
export async function sendVinushanChat(message, conversationHistory = []) {
  return apiRequest('/api/v1/vinushan/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });
}

/**
 * Stream chat response from Vinushan's context-aware assistant.
 * Uses Server-Sent Events for real-time reasoning display.
 * @param {string} message - User message
 * @param {Array<{role:string, content:string, timestamp:string}>} conversationHistory - Prior messages
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onRunStart - Called when processing begins
 * @param {Function} callbacks.onQueryAnalysis - Called with routing decision
 * @param {Function} callbacks.onAgentStart - Called when an agent starts
 * @param {Function} callbacks.onToolStart - Called when a tool is invoked
 * @param {Function} callbacks.onToolResult - Called when a tool completes
 * @param {Function} callbacks.onAgentOutput - Called with intermediate output
 * @param {Function} callbacks.onAgentEnd - Called when an agent completes
 * @param {Function} callbacks.onRunEnd - Called with final response
 * @param {Function} callbacks.onError - Called on error
 * @returns {Promise<void>}
 */
export async function streamVinushanChat(message, conversationHistory = [], callbacks = {}) {
  const url = `${API_BASE_URL}/api/v1/vinushan/chat/stream`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // Process complete SSE messages
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    let currentEvent = null;
    
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          
          switch (currentEvent) {
            case 'run_start':
              callbacks.onRunStart?.(data);
              break;
            case 'query_analysis':
              callbacks.onQueryAnalysis?.(data);
              break;
            case 'agent_start':
              callbacks.onAgentStart?.(data);
              break;
            case 'tool_start':
              callbacks.onToolStart?.(data);
              break;
            case 'tool_result':
              callbacks.onToolResult?.(data);
              break;
            case 'agent_output':
              callbacks.onAgentOutput?.(data);
              break;
            case 'agent_end':
              callbacks.onAgentEnd?.(data);
              break;
            case 'run_end':
              callbacks.onRunEnd?.(data);
              break;
            case 'error':
              callbacks.onError?.(data);
              break;
            // Legacy event support
            case 'status':
              callbacks.onRunStart?.(data);
              break;
            case 'routing':
              callbacks.onQueryAnalysis?.(data);
              break;
            case 'agent_complete':
              callbacks.onAgentEnd?.(data);
              break;
            case 'final_response':
              callbacks.onRunEnd?.(data);
              break;
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
        currentEvent = null;
      }
    }
  }
}

/**
 * Check if the main API is healthy
 * @returns {Promise<{status: string}>}
 */
export async function checkHealth() {
  return apiRequest('/health');
}

/**
 * Get API info
 * @returns {Promise<{message: string, version: string, modules: string[]}>}
 */
export async function getApiInfo() {
  return apiRequest('/');
}

export default {
  pingModule,
  sendChatMessage,
  sendVinushanChat,
  streamVinushanChat,
  checkHealth,
  getApiInfo,
};
