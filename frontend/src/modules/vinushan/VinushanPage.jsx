import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { streamVinushanChat } from '../../lib/api';
import AthenaChatMessage from './components/AthenaChatMessage';
import AgentThoughtsPanel from './components/AgentThoughtsPanel';
import PipelineVisualization from './components/PipelineVisualization';
import SettingsPage from './components/SettingsPage';
import StatsPage from './components/StatsPage';
import './styles/Athena.css';
import './styles/AgentThoughts.css';
import './components/SettingsPage.css';
import './components/StatsPage.css';

/**
 * ATHENA - Context-Aware Forecasting and Decision Support System
 * Main page component with chat interface and real-time streaming reasoning panel
 */

const LEGACY_STORAGE_KEY = 'athena-chat-history';
const CHAT_SESSIONS_STORAGE_KEY = 'athena-chat-sessions-v1';
const ACTIVE_CHAT_STORAGE_KEY = 'athena-active-chat-v1';

const FOLLOWUP_STORAGE_KEY = 'athena-followup-enabled';
const XAI_STORAGE_KEY = 'athena-xai-enabled';
const SETTINGS_STORAGE_KEY = 'athena-settings';

const exampleQuestions = [
  'What are the top selling items this month?',
  'Show me a chart of sales trends',
  'How does weather affect my sales?',
  'Visualize the daily sales pattern',
  'What holidays are coming up?',
];

const buildChatTitle = (messages = []) => {
  const firstUserMessage = messages.find((m) => m.role === 'user' && m.content?.trim());
  if (!firstUserMessage) return 'New chat';
  const normalized = firstUserMessage.content.replace(/\s+/g, ' ').trim();
  return normalized.length > 44 ? `${normalized.slice(0, 44)}...` : normalized;
};

const createChatSession = (messages = []) => {
  const now = new Date().toISOString();
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: buildChatTitle(messages),
    createdAt: now,
    updatedAt: now,
    messages,
  };
};

const normalizeSessions = (sessions) => {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .filter((chat) => chat && typeof chat === 'object' && typeof chat.id === 'string')
    .map((chat) => ({
      id: chat.id,
      title: chat.title || buildChatTitle(chat.messages || []),
      createdAt: chat.createdAt || new Date().toISOString(),
      updatedAt: chat.updatedAt || new Date().toISOString(),
      messages: Array.isArray(chat.messages) ? chat.messages : [],
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

const loadChatStateFromStorage = () => {
  try {
    const rawSessions = localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
    const rawActiveChat = localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY);

    if (rawSessions) {
      const parsedSessions = normalizeSessions(JSON.parse(rawSessions));
      if (parsedSessions.length > 0) {
        const activeChatId = parsedSessions.some((chat) => chat.id === rawActiveChat)
          ? rawActiveChat
          : parsedSessions[0].id;
        return { sessions: parsedSessions, activeChatId };
      }
    }

    // Migrate old single-chat history to sessions model
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyMessages = JSON.parse(legacyRaw);
      if (Array.isArray(legacyMessages) && legacyMessages.length > 0) {
        const migratedChat = createChatSession(legacyMessages);
        return { sessions: [migratedChat], activeChatId: migratedChat.id };
      }
    }
  } catch (e) {
    console.error('Failed to load chat sessions:', e);
  }

  const freshChat = createChatSession([]);
  return { sessions: [freshChat], activeChatId: freshChat.id };
};

const persistChatState = (sessions, activeChatId) => {
  try {
    localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, activeChatId || '');
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to save chat sessions:', e);
  }
};

function VinushanPage() {
  const chatInitRef = useRef(null);
  if (!chatInitRef.current) {
    chatInitRef.current = loadChatStateFromStorage();
  }

  const [chatSessions, setChatSessions] = useState(() => chatInitRef.current.sessions);
  const [activeChatId, setActiveChatId] = useState(() => chatInitRef.current.activeChatId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('athena');
  const [enableFollowUp, setEnableFollowUp] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FOLLOWUP_STORAGE_KEY)) ?? false; } catch { return false; }
  });
  const [enableXai, setEnableXai] = useState(() => {
    try { return JSON.parse(localStorage.getItem(XAI_STORAGE_KEY)) ?? true; } catch { return true; }
  });
  const [sendOnEnter, setSendOnEnter] = useState(() => {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      return settings.sendOnEnter ?? true;
    } catch {
      return true;
    }
  });
  const [autoOpenReasoning, setAutoOpenReasoning] = useState(() => {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      return settings.autoOpenReasoning ?? true;
    } catch {
      return true;
    }
  });
  
  // Real-time event tracking
  const [currentRunId, setCurrentRunId] = useState(null);
  const [events, setEvents] = useState([]);
  const [routingReasoning, setRoutingReasoning] = useState(null);
  const [agentsNeeded, setAgentsNeeded] = useState([]);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);

  const activeChat = useMemo(
    () => chatSessions.find((chat) => chat.id === activeChatId) || chatSessions[0] || null,
    [chatSessions, activeChatId]
  );
  const messages = activeChat?.messages || [];
  const totalMessageCount = useMemo(
    () => chatSessions.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0),
    [chatSessions]
  );
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const chatSearchInputRef = useRef(null);
  const messageNodeRefs = useRef(new Map());

  const setMessagesForActiveChat = useCallback((updater) => {
    setChatSessions((prev) => prev.map((chat) => {
      if (chat.id !== activeChatId) return chat;
      const currentMessages = Array.isArray(chat.messages) ? chat.messages : [];
      const nextMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
      return {
        ...chat,
        messages: nextMessages,
        title: buildChatTitle(nextMessages),
        updatedAt: new Date().toISOString(),
      };
    }));
  }, [activeChatId]);

  const searchResults = useMemo(() => {
    const query = chatSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return messages
      .map((msg, idx) => ({
        messageIndex: idx,
        messageKey: `${activeChatId}-${idx}-${msg.timestamp || idx}`,
        role: msg.role,
        content: msg.content || '',
      }))
      .filter((entry) => entry.content.toLowerCase().includes(query));
  }, [messages, chatSearchQuery, activeChatId]);

  const matchedMessageIndexes = useMemo(
    () => new Set(searchResults.map((result) => result.messageIndex)),
    [searchResults]
  );

  const activeMatchedMessageIndex = searchResults[activeSearchResultIndex]?.messageIndex ?? -1;

  const scrollToSearchResult = useCallback((resultIndex) => {
    const result = searchResults[resultIndex];
    if (!result) return;
    const node = messageNodeRefs.current.get(result.messageKey);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchResults]);

  const handleNextSearchResult = useCallback(() => {
    if (!searchResults.length) return;
    setActiveSearchResultIndex((prev) => {
      const nextIndex = (prev + 1) % searchResults.length;
      scrollToSearchResult(nextIndex);
      return nextIndex;
    });
  }, [searchResults, scrollToSearchResult]);

  const handlePrevSearchResult = useCallback(() => {
    if (!searchResults.length) return;
    setActiveSearchResultIndex((prev) => {
      const prevIndex = (prev - 1 + searchResults.length) % searchResults.length;
      scrollToSearchResult(prevIndex);
      return prevIndex;
    });
  }, [searchResults, scrollToSearchResult]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chatSearchQuery.trim()) {
      setActiveSearchResultIndex(0);
      return;
    }

    if (searchResults.length === 0) {
      setActiveSearchResultIndex(0);
      return;
    }

    setActiveSearchResultIndex((prev) => {
      const normalized = Math.min(prev, searchResults.length - 1);
      setTimeout(() => scrollToSearchResult(normalized), 0);
      return normalized;
    });
  }, [chatSearchQuery, searchResults, scrollToSearchResult]);

  useEffect(() => {
    setChatSearchQuery('');
    setActiveSearchResultIndex(0);
  }, [activeChatId]);

  // Persist all chat sessions whenever state changes
  useEffect(() => {
    if (chatSessions.length > 0) {
      persistChatState(chatSessions, activeChatId);
    }
  }, [chatSessions, activeChatId]);

  useEffect(() => {
    if (!chatSessions.length) return;
    if (!chatSessions.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chatSessions[0].id);
    }
  }, [chatSessions, activeChatId]);

  useEffect(() => {
    const handleSettingsChanged = (event) => {
      const s = event?.detail || {};
      if (typeof s.sendOnEnter === 'boolean') {
        setSendOnEnter(s.sendOnEnter);
      }
      if (typeof s.autoOpenReasoning === 'boolean') {
        setAutoOpenReasoning(s.autoOpenReasoning);
      }
      if (typeof s.defaultFollowUpMode === 'boolean') {
        setEnableFollowUp(s.defaultFollowUpMode);
      }
      if (typeof s.defaultExplainability === 'boolean') {
        setEnableXai(s.defaultExplainability);
      }
    };

    window.addEventListener('athena-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('athena-settings-changed', handleSettingsChanged);
  }, []);

  const handleNewChat = () => {
    if (isLoading) return;
    const freshChat = createChatSession([]);
    setChatSessions((prev) => [freshChat, ...prev]);
    setActiveChatId(freshChat.id);
    setError(null);
    setInputValue('');
    clearReasoning();
  };

  const handleSelectChat = (chatId) => {
    if (isLoading || chatId === activeChatId) return;
    setActiveChatId(chatId);
    setError(null);
    clearReasoning();
  };

  const handleDeleteChatSession = (chatId) => {
    if (isLoading || chatSessions.length <= 1) return;
    setChatSessions((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      if (chatId === activeChatId && filtered.length > 0) {
        setActiveChatId(filtered[0].id);
      }
      return filtered;
    });
    clearReasoning();
  };

  // Delete a Q&A pair (user message and its following assistant response)
  const handleDeleteMessage = (messageIndex) => {
    setMessagesForActiveChat((prev) => {
      const newMessages = [...prev];
      const targetMessage = newMessages[messageIndex];
      
      if (targetMessage.role === 'user') {
        // If it's a user message, also delete the following assistant message
        if (newMessages[messageIndex + 1]?.role === 'assistant') {
          newMessages.splice(messageIndex, 2);
        } else {
          newMessages.splice(messageIndex, 1);
        }
      } else {
        // If it's an assistant message, also delete the preceding user message
        if (newMessages[messageIndex - 1]?.role === 'user') {
          newMessages.splice(messageIndex - 1, 2);
        } else {
          newMessages.splice(messageIndex, 1);
        }
      }
      
      return newMessages;
    });
  };

  // Clear all chat history (used by both chat and settings)
  const handleClearAllMessages = (skipConfirm = false) => {
    if (skipConfirm || window.confirm('Are you sure you want to clear all chat history?')) {
      const freshChat = createChatSession([]);
      setChatSessions([freshChat]);
      setActiveChatId(freshChat.id);
      setError(null);
      clearReasoning();
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      const isInputFocused = document.activeElement?.tagName === 'TEXTAREA' || 
                             document.activeElement?.tagName === 'INPUT';
      
      // Navigation shortcuts (Cmd/Ctrl + 1-4)
      if (cmdKey && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveTab('overview');
            return;
          case '2':
            e.preventDefault();
            setActiveTab('athena');
            return;
          case '3':
            e.preventDefault();
            setActiveTab('theater');
            return;
          case '4':
            e.preventDefault();
            window.open('/docs.html', '_blank');
            return;
          case '5':
            e.preventDefault();
            setActiveTab('settings');
            return;
          case 'n':
            if (activeTab === 'athena') {
              e.preventDefault();
              handleNewChat();
            }
            return;
          case 'f':
            if (activeTab === 'athena') {
              e.preventDefault();
              chatSearchInputRef.current?.focus();
              chatSearchInputRef.current?.select();
            }
            return;
          case 's':
            // Cmd+S to stop execution (only when loading)
            if (isLoading) {
              e.preventDefault();
              handleStopRequest();
            }
            return;
          case 'r':
            // Cmd+R to toggle reasoning panel (only in Athena tab)
            if (activeTab === 'athena') {
              e.preventDefault();
              setShowReasoning(prev => !prev);
            }
            return;
        }
      }
      
      // Athena-specific shortcuts (only when in Athena tab and not in input)
      if (activeTab === 'athena' && !isInputFocused) {
        switch (e.key) {
          case '/':
            e.preventDefault();
            inputRef.current?.focus();
            return;
          case 's':
            // 's' for speaker - dispatch custom event to last message
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('athena-shortcut-speaker'));
            return;
          case 'e':
            // 'e' for export - dispatch custom event to last message
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('athena-shortcut-export'));
            return;
          case 'Escape':
            // Escape to close reasoning panel
            if (showReasoning) {
              e.preventDefault();
              setShowReasoning(false);
            }
            return;
        }
      }
      
      // '/' to focus input even when in input (standard behavior)
      if (e.key === '/' && !isInputFocused && activeTab === 'athena') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, isLoading, showReasoning, handleNewChat]);

  // Clear reasoning state
  const clearReasoning = () => {
    setEvents([]);
    setRoutingReasoning(null);
    setAgentsNeeded([]);
    setCurrentRunId(null);
  };

  const handleSendMessage = async (content) => {
    if (!content.trim() || isLoading) return;
    
    setError(null);
    setInputValue('');

    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    
    setMessagesForActiveChat((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    // Open reasoning panel and reset state
    setShowReasoning(autoOpenReasoning);
    clearReasoning();
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const history = [...messages, userMessage].map(({ role, content: text, timestamp }) => ({
        role,
        content: text,
        timestamp,
      }));

      // Use streaming API with real-time event callbacks
      await streamVinushanChat(content, history, enableFollowUp, enableXai, {
        onRunStart: (data) => {
          setCurrentRunId(data.run_id);
          setEvents(prev => [...prev, data]);
        },
        
        onQueryAnalysis: (data) => {
          setRoutingReasoning(data.content || data.data?.reasoning);
          setAgentsNeeded(data.data?.agents_needed || []);
          setEvents(prev => [...prev, data]);
        },
        
        onRagRetrieval: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentStart: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onToolStart: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onToolResult: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentOutput: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentThought: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentQuery: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentSelfCheck: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentResultSnapshot: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onRouterThought: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentEnd: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onXaiExplanation: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onRunEnd: (data) => {
          setEvents(prev => [...prev, data]);
          
          // Extract final response from data
          const responseData = data.data || {};
          
          const assistantMessage = {
            role: 'assistant',
            content: responseData.response || data.content || 'Analysis complete.',
            timestamp: new Date().toISOString(),
            charts: responseData.charts,
            ragCitations: responseData.rag_citations || null,
            ragSources: responseData.rag_sources || null,
          };

          setMessagesForActiveChat((prev) => [...prev, assistantMessage]);
          setIsLoading(false);
        },
        
        onError: (data) => {
          setError(data.content || data.message || 'An error occurred');
          setEvents(prev => [...prev, data]);
          setIsLoading(false);
        },
      }, abortControllerRef.current?.signal);

    } catch (err) {
      // Check if this was an abort
      if (err.name === 'AbortError') {
        setMessagesForActiveChat((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '⏹️ Request cancelled by user.',
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      setMessagesForActiveChat((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${message}. Please try again.`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
      return;
    }

    if (!sendOnEnter && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleExampleClick = (question) => {
    if (!isLoading) {
      handleSendMessage(question);
    }
  };

  // Stop/cancel the current request
  const handleStopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Helper to get the user question for an assistant message
  const getUserQuestionForMessage = (messageIndex) => {
    if (messageIndex > 0 && messages[messageIndex - 1]?.role === 'user') {
      return messages[messageIndex - 1].content;
    }
    return '';
  };

  const getChatPreview = (chat) => {
    const lastMessage = [...(chat.messages || [])].reverse().find((m) => m.content?.trim());
    if (!lastMessage) return 'No messages yet';
    const compact = lastMessage.content.replace(/\s+/g, ' ').trim();
    return compact.length > 58 ? `${compact.slice(0, 58)}...` : compact;
  };

  const formatChatTime = (isoTime) => {
    if (!isoTime) return '';
    const date = new Date(isoTime);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="athena-container">
      {/* Header with Title and Navigation */}
      <header className="athena-header">
        <div className="athena-logo">
          <h1 className="athena-title">ATHENA</h1>
          <p className="athena-subtitle">A Context-Aware Forecasting and Decision Support System</p>
        </div>
        <nav className="athena-nav">
          <button 
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`nav-tab ${activeTab === 'athena' ? 'active' : ''}`}
            onClick={() => setActiveTab('athena')}
          >
            Athena
          </button>
          <button 
            className={`nav-tab ${activeTab === 'theater' ? 'active' : ''}`}
            onClick={() => setActiveTab('theater')}
          >
            Decision Flow
          </button>
          <button 
            className="nav-tab"
            onClick={() => window.open('/docs.html', '_blank')}
            title="Opens in new tab"
          >
            Guide ↗
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="athena-main">
        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <SettingsPage 
            showAgentThoughts={showReasoning}
            onToggleAgentThoughts={setShowReasoning}
            onClearChatHistory={() => handleClearAllMessages(true)}
            chatHistoryCount={totalMessageCount}
          />
        )}

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <StatsPage />
        )}

        {/* Decision Flow Tab Content */}
        {activeTab === 'theater' && (
          <PipelineVisualization
            events={events}
            isLoading={isLoading}
            routingReasoning={routingReasoning}
            agentsNeeded={agentsNeeded}
            onSendMessage={handleSendMessage}
          />
        )}

        {/* Athena Chat Tab Content */}
        {activeTab === 'athena' && (
          <div className="athena-chat-workspace">
            <aside className="athena-conversations">
              <button
                className="new-chat-btn"
                onClick={handleNewChat}
                disabled={isLoading}
                title="Start a new conversation (Cmd/Ctrl+N)"
              >
                + New chat
              </button>

              <div className="conversation-list" role="listbox" aria-label="Conversation history">
                {chatSessions.map((chat) => (
                  <button
                    key={chat.id}
                    className={`conversation-item ${chat.id === activeChatId ? 'active' : ''}`}
                    onClick={() => handleSelectChat(chat.id)}
                    title={chat.title}
                  >
                    <div className="conversation-meta">
                      <span className="conversation-title">{chat.title}</span>
                      <span className="conversation-time">{formatChatTime(chat.updatedAt)}</span>
                    </div>
                    <span className="conversation-preview">{getChatPreview(chat)}</span>
                    <span className="conversation-count">{chat.messages?.length || 0} msgs</span>
                    {chatSessions.length > 1 && (
                      <span
                        className="conversation-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChatSession(chat.id);
                        }}
                        role="button"
                        aria-label={`Delete ${chat.title}`}
                      >
                        x
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </aside>

            {/* Chat Section */}
            <section className={`athena-chat-section ${showReasoning ? 'with-reasoning' : ''}`}>
              {/* Messages Area */}
              <div className="athena-messages">
                <div className="athena-messages-inner">
                  {messages.length === 0 ? (
                    <div className="athena-welcome">
                      <h3>Welcome, Vinushan!</h3>
                      <p>
                        I can analyze sales, forecast demand, explain holiday and weather impacts, and create charts.
                      </p>
                      <div className="athena-examples">
                        {exampleQuestions.map((q) => (
                          <button
                            key={q}
                            type="button"
                            className="athena-example-btn"
                            onClick={() => handleExampleClick(q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="athena-chat-search-bar">
                        <div className="athena-chat-search-left">
                          <input
                            ref={chatSearchInputRef}
                            type="text"
                            className="athena-chat-search-input"
                            placeholder="Search questions and responses..."
                            value={chatSearchQuery}
                            onChange={(e) => setChatSearchQuery(e.target.value)}
                            aria-label="Search chat messages"
                          />
                          <span className="athena-chat-search-count" aria-live="polite">
                            {searchResults.length > 0
                              ? `${activeSearchResultIndex + 1}/${searchResults.length}`
                              : '0/0'}
                          </span>
                        </div>
                        <div className="athena-chat-search-actions">
                          <button
                            className="athena-chat-search-btn"
                            onClick={handlePrevSearchResult}
                            disabled={searchResults.length === 0}
                            title="Previous result"
                          >
                            Prev
                          </button>
                          <button
                            className="athena-chat-search-btn"
                            onClick={handleNextSearchResult}
                            disabled={searchResults.length === 0}
                            title="Next result"
                          >
                            Next
                          </button>
                          {chatSearchQuery && (
                            <button
                              className="athena-chat-search-btn clear"
                              onClick={() => {
                                setChatSearchQuery('');
                                setActiveSearchResultIndex(0);
                                chatSearchInputRef.current?.focus();
                              }}
                              title="Clear search"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Clear All Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px', paddingRight: '8px' }}>
                        <button
                          className="clear-all-btn"
                          onClick={handleClearAllMessages}
                          title="Clear all chat history"
                        >
                          Clear all chats
                        </button>
                      </div>
                      {messages.map((msg, idx) => {
                        const messageKey = `${activeChatId}-${idx}-${msg.timestamp || idx}`;
                        const isMatch = matchedMessageIndexes.has(idx);
                        const isActiveMatch = idx === activeMatchedMessageIndex;

                        return (
                          <div
                            key={messageKey}
                            ref={(node) => {
                              if (node) {
                                messageNodeRefs.current.set(messageKey, node);
                              } else {
                                messageNodeRefs.current.delete(messageKey);
                              }
                            }}
                            className={`athena-search-message-wrap ${isMatch ? 'search-match' : ''} ${isActiveMatch ? 'search-match-active' : ''}`}
                          >
                            <AthenaChatMessage
                              message={msg}
                              charts={msg.charts}
                              isLast={idx === messages.length - 1 && msg.role === 'assistant'}
                              onDelete={() => handleDeleteMessage(idx)}
                              messageIndex={idx}
                              userQuestion={getUserQuestionForMessage(idx)}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Loading indicator with Stop button */}
                  {isLoading && (
                    <div className="athena-loading">
                      <div className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <p className="loading-text">
                        {events.length > 0
                          ? events[events.length - 1]?.content || 'Analyzing your question...'
                          : 'Analyzing your question...'}
                      </p>
                      <button className="stop-btn" onClick={handleStopRequest}>
                        Stop
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="athena-error">
                  <span>{error}</span>
                  <button onClick={() => setError(null)}>Dismiss</button>
                </div>
              )}

              {/* Input Section */}
              <div className="athena-input-section">
                <div className="athena-toggles-row">
                  <div className="athena-followup-toggle">
                    <label className="athena-toggle-switch">
                      <input
                        type="checkbox"
                        checked={enableFollowUp}
                        onChange={(e) => {
                          setEnableFollowUp(e.target.checked);
                          try { localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(e.target.checked)); } catch {}
                        }}
                      />
                      <span className="athena-toggle-slider" />
                    </label>
                    <span className="athena-toggle-label">Follow-up mode</span>
                  </div>
                  <div className="athena-followup-toggle">
                    <label className="athena-toggle-switch">
                      <input
                        type="checkbox"
                        checked={enableXai}
                        onChange={(e) => {
                          setEnableXai(e.target.checked);
                          try { localStorage.setItem(XAI_STORAGE_KEY, JSON.stringify(e.target.checked)); } catch {}
                        }}
                      />
                      <span className="athena-toggle-slider" />
                    </label>
                    <span className="athena-toggle-label">Explainability AI</span>
                  </div>
                </div>
                <div className="athena-input-wrapper">
                  <textarea
                    ref={inputRef}
                    className="athena-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isLoading
                        ? 'Thinking...'
                        : sendOnEnter
                          ? 'Ask anything about your business...'
                          : 'Ask anything... (Cmd/Ctrl + Enter to send)'
                    }
                    disabled={isLoading}
                    rows={1}
                  />
                  <button
                    className="athena-send-btn"
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={isLoading || !inputValue.trim()}
                  >
                    {isLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </section>

            {/* Agent Thoughts Panel */}
            <AgentThoughtsPanel
              isOpen={showReasoning}
              onClose={() => setShowReasoning(false)}
              onClear={clearReasoning}
              events={events}
              currentRunId={currentRunId}
              isLoading={isLoading}
              routingReasoning={routingReasoning}
              agentsNeeded={agentsNeeded}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default VinushanPage;
