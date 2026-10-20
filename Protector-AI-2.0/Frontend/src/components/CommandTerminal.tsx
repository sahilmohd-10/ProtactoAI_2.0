import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Plus } from 'lucide-react';
import type { TerminalResult } from '../types';
import { api } from '../services/api';

interface CommandTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
  isAdministrator: boolean;
  onThemeSwitch?: (theme: 'dark' | 'light') => void;
}

interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: string;
  result: TerminalResult;
}

interface TerminalConversation {
  id: string;
  title: string;
  updated_at: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
};

const QUICK_ACTIONS = [
  { label: '⚡ Run Audit', command: 'ai Perform an immediate autonomous OSHA safety audit on current active camera feeds, evaluating head protection and active hazard exposure.' },
  { label: 'PPE Stats', command: 'ppe stats' },
  { label: 'Status', command: 'status' }
];

const parseBold = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const renderFormattedContent = (content: string) => {
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} style={{ height: '6px' }} />;
    }
    if (trimmed.startsWith('#### ') || trimmed.startsWith('### ')) {
      return (
        <h4
          key={idx}
          style={{
            fontSize: '11.5px',
            fontWeight: 700,
            color: 'var(--accent-citron)',
            margin: '8px 0 3px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}
        >
          {trimmed.replace(/^#{3,4}\s+/, '')}
        </h4>
      );
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      return (
        <h3
          key={idx}
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '10px 0 4px',
            letterSpacing: '-0.01em'
          }}
        >
          {trimmed.replace(/^#{1,2}\s+/, '')}
        </h3>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.replace(/^[-*]\s+/, '');
      return (
        <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '4px', margin: '2px 0', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-citron)', flexShrink: 0 }}>•</span>
          <div style={{ flex: 1 }}>{parseBold(bulletText)}</div>
        </div>
      );
    }
    return (
      <div key={idx} style={{ margin: '2px 0', color: 'var(--text-secondary)' }}>
        {parseBold(trimmed)}
      </div>
    );
  });
};

export const CommandTerminal: React.FC<CommandTerminalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  isAdministrator,
  onThemeSwitch
}) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([
    {
      id: 'init-1',
      command: 'system init --ai openrouter',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      result: {
        type: 'text',
        output: 'PROTECTOR AI 2.0 COMMAND TERMINAL · OPENROUTER NEURAL KERNEL READY\nType "help" for structured command reference or ask any question in natural language.'
      }
    }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversations, setConversations] = useState<TerminalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [isLoadingConversation, setIsLoadingConversation] = useState<boolean>(true);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // OpenRouter Config State
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-4o-mini');
  const [openrouterStatus, setOpenrouterStatus] = useState<{
    connected: boolean;
    masked_key: string;
    active_model: string;
    available_models: { id: string; name: string; tier: string }[];
  } | null>(null);

  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const conversationLoadRef = useRef<number>(0);

  const makeWelcomeHistory = (): CommandHistoryItem[] => [{
    id: 'init-1',
    command: 'system init --ai openrouter',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    result: {
      type: 'text',
      output: 'PROTECTOR AI 2.0 COMMAND TERMINAL · OPENROUTER NEURAL KERNEL READY\nType "help" for structured command reference or ask any question in natural language.'
    }
  }];

  useEffect(() => {
    let isMounted = true;
    const loadConversations = async () => {
      try {
        let items = await api.getTerminalConversations();
        if (items.length === 0) {
          items = [await api.createTerminalConversation()];
        }
        if (!isMounted) return;

        setConversations(items);
        setActiveConversationId(items[0].id);
        const response = await api.getTerminalConversationHistory(items[0].id);
        if (isMounted) {
          setHistory(response.history.length > 0
            ? response.history.map((message) => ({ ...message }))
            : makeWelcomeHistory());
        }
      } catch (err) {
        if (isMounted) setTerminalError(err instanceof Error ? err.message : 'Unable to load saved conversations.');
      } finally {
        if (isMounted) setIsLoadingConversation(false);
      }
    };
    loadConversations();

    return () => {
      isMounted = false;
      recognitionRef.current?.stop();
    };
  }, []);

  // Load OpenRouter Status on mount
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const st = await api.getOpenRouterStatus();
        setOpenrouterStatus(st);
        if (st.active_model) {
          setSelectedModel(st.active_model);
        }
      } catch {
        // quiet
      }
    };
    loadStatus();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      recognitionRef.current?.stop();
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  const handleCreateConversation = async () => {
    try {
      setTerminalError(null);
      setIsLoadingConversation(true);
      conversationLoadRef.current += 1;
      const conversation = await api.createTerminalConversation();
      setConversations((previous) => [conversation, ...previous]);
      setActiveConversationId(conversation.id);
      setHistory(makeWelcomeHistory());
      setHistoryIndex(-1);
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Unable to create a new conversation.');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    const loadId = ++conversationLoadRef.current;
    setActiveConversationId(conversationId);
    setIsLoadingConversation(true);
    setTerminalError(null);
    try {
      const response = await api.getTerminalConversationHistory(conversationId);
      if (loadId === conversationLoadRef.current) {
        setHistory(response.history.length > 0
          ? response.history.map((message) => ({ ...message }))
          : makeWelcomeHistory());
        setHistoryIndex(-1);
      }
    } catch (err) {
      if (loadId === conversationLoadRef.current) {
        setTerminalError(err instanceof Error ? err.message : 'Unable to load this conversation.');
      }
    } finally {
      if (loadId === conversationLoadRef.current) setIsLoadingConversation(false);
    }
  };

  const handleClearConversation = async () => {
    if (!activeConversationId) return;
    try {
      setTerminalError(null);
      await api.clearTerminalConversation(activeConversationId);
      setHistory([]);
      setConversations((previous) => previous.map((conversation) => (
        conversation.id === activeConversationId
          ? { ...conversation, title: 'New chat', updated_at: new Date().toISOString() }
          : conversation
      )));
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Unable to clear this conversation.');
    }
  };

  const toggleVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported by this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (transcript) {
        setInputVal((previous) => [previous.trim(), transcript].filter(Boolean).join(' '));
      }
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === 'not-allowed'
        ? 'Microphone access was denied. Allow microphone access in your browser settings.'
        : `Voice input error: ${event.error}.`);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    setVoiceError(null);
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError(err instanceof Error ? err.message : 'Unable to start voice input.');
    }
  };

  const handleExecute = async (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed || !activeConversationId || isLoadingConversation) return;

    setInputVal('');
    setHistoryIndex(-1);
    setIsLoading(true);
    setTerminalError(null);

    try {
      const message = await api.sendTerminalConversationMessage(activeConversationId, trimmed);
      const res = message.result;

      if (res.type === 'clear') {
        setHistory([]);
      } else {
        setHistory((prev) => [
          ...prev,
          {
            id: message.id,
            command: message.command,
            timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            result: res
          }
        ]);
      }
      setConversations((previous) => previous.map((conversation) => (
        conversation.id === activeConversationId
          ? {
            ...conversation,
            title: conversation.title === 'New chat'
              ? (trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed)
              : conversation.title,
            updated_at: message.timestamp
          }
          : conversation
      )));

      if (res.type === 'navigation' && res.target) {
        onNavigate(res.target);
      }

      if (res.type === 'theme_switch' && res.theme && onThemeSwitch) {
        if (res.theme === 'dark' || res.theme === 'light') {
          onThemeSwitch(res.theme);
        }
      }
    } catch (err: any) {
      setTerminalError(`Terminal execution error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecute(inputVal);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const pastCommands = history.map((h) => h.command);
      if (pastCommands.length > 0) {
        const nextIdx = historyIndex + 1 < pastCommands.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setInputVal(pastCommands[pastCommands.length - 1 - nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const pastCommands = history.map((h) => h.command);
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(pastCommands[pastCommands.length - 1 - nextIdx] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const handleSaveKeyConfig = async () => {
    if (!isAdministrator) return;
    if (!keyInput.trim()) return;
    try {
      await api.updateOpenRouterConfig({ api_key: keyInput.trim(), model: selectedModel });
      const st = await api.getOpenRouterStatus();
      setOpenrouterStatus(st);
    } catch {
      // quiet
    }
    setShowKeyModal(false);
  };

  const renderResult = (res: TerminalResult) => {
    if (res.type === 'ai_response') {
      return (
        <div style={{
          backgroundColor: '#0D1015',
          border: '1px solid var(--border-charcoal)',
          borderRadius: '6px',
          padding: '12px 14px',
          margin: '6px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--safety-safe)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                {res.title || 'AI AUDIT REPORT'}
              </span>
            </div>
            {res.data && (res.data as any).elapsed_ms && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {(res.data as any).elapsed_ms}ms · {(res.data as any).tokens || 0} tokens
              </span>
            )}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            fontFamily: 'var(--font-sans)'
          }}>
            {renderFormattedContent(res.output || '')}
          </div>
        </div>
      );
    }

    if (res.type === 'metric_card' && res.data) {
      const d = res.data;
      return (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '6px',
          padding: '12px 16px',
          margin: '6px 0'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
            {res.title || 'TELEMETRY RESULT'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--safety-safe)', fontFamily: 'var(--font-mono)' }}>
              {d.compliance_rate}%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Operational Compliance
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {res.output}
          </div>
        </div>
      );
    }

    if (res.type === 'status_card' && res.data) {
      return (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '6px',
          padding: '12px 16px',
          margin: '6px 0'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-citron)', marginBottom: '8px' }}>
            {res.title?.toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            {Object.entries(res.data).map(([k, v]) => (
              <div key={k}>
                <span style={{ color: 'var(--text-tertiary)' }}>{k.toUpperCase()}: </span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (res.type === 'table' && res.columns && res.rows) {
      return (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-charcoal)',
          borderRadius: '6px',
          overflow: 'hidden',
          margin: '6px 0',
          maxWidth: '100%'
        }}>
          {res.title && (
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-citron)' }}>
              {res.title.toUpperCase()}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)' }}>
                  {res.columns.map((col, idx) => (
                    <th key={idx} style={{ padding: '6px 10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.rows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '6px 10px', color: cIdx === 0 ? 'var(--accent-citron)' : '#FFFFFF' }}>
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (res.type === 'error') {
      return (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--safety-violation-bg)',
          border: '1px solid var(--safety-violation-border)',
          borderRadius: '6px',
          color: 'var(--safety-violation)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          margin: '6px 0'
        }}>
          {res.output}
        </div>
      );
    }

    return (
      <pre style={{
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit',
        fontSize: '11.5px',
        color: '#D8DCD3',
        lineHeight: 1.5,
        margin: '4px 0'
      }}>
        {res.output}
      </pre>
    );
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 95,
            transition: 'opacity 0.2s ease'
          }}
        />
      )}

      {/* Slidebar of Terminal */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '580px',
          maxWidth: '92vw',
          backgroundColor: '#090B0F',
          borderLeft: '1px solid var(--border-charcoal)',
          boxShadow: 'var(--shadow-elevated)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          userSelect: 'none'
        }}
      >
        {/* Slidebar Top Header - Simple & Clean */}
        <div style={{
          height: '50px',
          backgroundColor: '#11151B',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              TERMINAL
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--safety-safe)'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--safety-safe)' }} />
              <span>AI Online</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                api.updateOpenRouterConfig({ model: e.target.value });
              }}
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-charcoal)',
                borderRadius: '5px',
                padding: '3px 8px',
                color: 'var(--accent-citron)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3</option>
              <option value="deepseek/deepseek-chat">DeepSeek V3</option>
            </select>

            {isAdministrator && <button
              type="button"
              onClick={() => {
                setKeyInput('');
                setShowKeyModal(true);
              }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                padding: '3px 8px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-charcoal)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
              title="Configure OpenRouter API Key"
            >
              Key
            </button>}

            <button
              onClick={onClose}
              style={{
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '5px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="Close Terminal [Esc]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Saved conversations are scoped to the signed-in user. */}
        <div style={{
          padding: '7px 12px',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#0C0F14',
          flexShrink: 0
        }}>
          <select
            aria-label="Saved conversations"
            value={activeConversationId}
            onChange={(event) => handleSelectConversation(event.target.value)}
            disabled={isLoading || isLoadingConversation || conversations.length === 0}
            style={{
              flex: 1,
              minWidth: 0,
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-charcoal)',
              borderRadius: '5px',
              padding: '5px 8px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px'
            }}
          >
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateConversation}
            disabled={isLoading || isLoadingConversation}
            className="btn-secondary"
            style={{ padding: '4px 9px', fontSize: '11px', flexShrink: 0 }}
            title="Start a new saved conversation"
          >
            <Plus size={13} />
            New chat
          </button>
        </div>

        {/* Minimal Quick Action Strip */}
        <div style={{
          padding: '6px 16px',
          backgroundColor: '#0C0F14',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0
        }}>
          {QUICK_ACTIONS.map((qa, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExecute(qa.command)}
              disabled={isLoading || isLoadingConversation}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {qa.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearConversation}
            disabled={!activeConversationId || isLoading || isLoadingConversation}
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '3px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>

        {/* Terminal Log Viewport */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          fontSize: '12px',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          color: '#E5E7EB',
          userSelect: 'text'
        }}>
          {isLoadingConversation && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '10px' }}>
              Loading saved conversation...
            </div>
          )}
          {history.map((item) => (
            <div key={item.id} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--accent-citron)', fontWeight: 700 }}>protector@ops</span>
                <span style={{ color: 'var(--text-muted)' }}>:~$</span>
                <span style={{ color: '#F4F5F2', fontWeight: 600 }}>{item.command}</span>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{item.timestamp}</span>
              </div>

              <div style={{ marginTop: '4px' }}>
                {renderResult(item.result)}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ color: 'var(--accent-citron)', fontSize: '11px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0' }} className="animate-signal-pulse">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-citron)' }} />
              <span>OpenRouter AI executing command / reasoning neural inferences...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar - Simple & Clean */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#11151B',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0
        }}>
          {(terminalError || voiceError) && (
            <div role="status" style={{
              color: 'var(--safety-violation)',
              fontSize: '11px',
              marginBottom: '8px',
              lineHeight: 1.4
            }}>
              {terminalError || voiceError}
            </div>
          )}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-charcoal)',
            borderRadius: '6px',
            padding: '4px 12px'
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent-citron)', fontWeight: 700 }}>
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isLoadingConversation}
              placeholder="Ask AI or enter command..."
              aria-label="Ask AI or enter a command"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: '#FFFFFF',
                padding: '6px 0'
              }}
            />
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading || isLoadingConversation}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop voice input' : 'Speak your message'}
              style={{
                width: '32px',
                height: '30px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '5px',
                border: `1px solid ${isListening ? 'var(--safety-violation-border)' : 'var(--border-medium)'}`,
                backgroundColor: isListening ? 'var(--safety-violation-bg)' : 'var(--bg-surface-elevated)',
                color: isListening ? 'var(--safety-violation)' : 'var(--text-secondary)',
                cursor: isLoading || isLoadingConversation ? 'not-allowed' : 'pointer',
                flexShrink: 0
              }}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={() => handleExecute(inputVal)}
              disabled={isLoading || isLoadingConversation || !inputVal.trim()}
              className="btn-citron"
              style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px' }}
            >
              Run
            </button>
          </div>
        </div>
      </aside>

      {/* OpenRouter Key Configuration Modal */}
      {showKeyModal && isAdministrator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '90%',
            maxWidth: '520px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            padding: '24px 28px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 800, color: 'var(--accent-citron)' }}>
                  OPENROUTER API KEY CONFIGURATION
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Configure your active OpenRouter API key for autonomous computer vision safety inspections and intelligent operations commands.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                OpenRouter Key (sk-or-v1-...)
              </label>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKeyConfig}
                className="btn-citron"
                style={{ fontSize: '12px', padding: '8px 18px' }}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
