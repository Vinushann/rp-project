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
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<void>}
 */
export async function streamVinushanChat(message, conversationHistory = [], callbacks = {}, signal = null) {
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
    signal, // Pass abort signal to fetch
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
            case 'agent_thought':
              callbacks.onAgentThought?.(data);
              break;
            case 'agent_query':
              callbacks.onAgentQuery?.(data);
              break;
            case 'agent_self_check':
              callbacks.onAgentSelfCheck?.(data);
              break;
            case 'agent_result_snapshot':
              callbacks.onAgentResultSnapshot?.(data);
              break;
            case 'router_thought':
              callbacks.onRouterThought?.(data);
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

// ============================================
// ATHENA EMAIL SETTINGS API
// ============================================

/**
 * Get saved email settings for report recipients
 * @returns {Promise<{manager_email: string|null, owner_email: string|null, finance_email: string|null, slack_webhook_url: string|null}>}
 */
export async function getEmailSettings() {
  return apiRequest('/api/v1/vinushan/settings/emails');
}

/**
 * Update email settings for report recipients
 * @param {Object} settings - Settings to update
 * @param {string|null} settings.manager_email
 * @param {string|null} settings.owner_email
 * @param {string|null} settings.finance_email
 * @param {string|null} settings.slack_webhook_url
 * @returns {Promise<Object>}
 */
export async function updateEmailSettings(settings) {
  return apiRequest('/api/v1/vinushan/settings/emails', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ============================================
// ATHENA SEND REPORTS API
// ============================================

/**
 * Get available date range for reports
 * @returns {Promise<{min_date: string, max_date: string}>}
 */
export async function getReportDateRange() {
  return apiRequest('/api/v1/vinushan/reports/date-range');
}

/**
 * Preview report data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>}
 */
export async function previewReportData(date) {
  return apiRequest(`/api/v1/vinushan/reports/preview/${date}`);
}

/**
 * Send reports for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {boolean} sendEmails - Whether to send email reports
 * @param {boolean} sendSlack - Whether to post Slack update
 * @returns {Promise<Object>}
 */
export async function sendReports(date, sendEmails = true, sendSlack = true) {
  return apiRequest('/api/v1/vinushan/reports/send', {
    method: 'POST',
    body: JSON.stringify({
      date,
      send_emails: sendEmails,
      send_slack: sendSlack,
    }),
  });
}

// ============================================
// ATHENA STATISTICS API
// ============================================

/**
 * Get comprehensive statistics for the dashboard
 * @returns {Promise<Object>}
 */
export async function getStatistics() {
  return apiRequest('/api/v1/vinushan/statistics');
}

/**
 * Get sales trend data for a specific period
 * @param {string} period - 'daily', 'weekly', or 'monthly'
 * @param {number} limit - Number of periods to return
 * @returns {Promise<Object>}
 */
export async function getTrendStatistics(period = 'daily', limit = 60) {
  return apiRequest(`/api/v1/vinushan/statistics/trend/${period}?limit=${limit}`);
}

/**
 * Get real-time weather data for a location
 * @param {string} location - City name (e.g., 'Katunayake')
 * @returns {Promise<Object>}
 */
export async function getWeather(location = 'Katunayake') {
  return apiRequest(`/api/v1/vinushan/weather/${encodeURIComponent(location)}`);
}

/**
 * Get Sri Lankan public holidays for a year
 * @param {number} year - The year (e.g., 2026)
 * @returns {Promise<Object>}
 */
export async function getHolidays(year = 2026) {
  return apiRequest(`/api/v1/vinushan/holidays/${year}`);
}

export default {
  pingModule,
  sendChatMessage,
  sendVinushanChat,
  streamVinushanChat,
  checkHealth,
  getApiInfo,
  getEmailSettings,
  updateEmailSettings,
  getReportDateRange,
  previewReportData,
  sendReports,
  getStatistics,
  getTrendStatistics,
  getWeather,
  getHolidays,
};
