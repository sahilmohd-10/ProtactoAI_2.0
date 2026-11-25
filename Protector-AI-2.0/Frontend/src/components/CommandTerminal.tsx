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

const parseInlineMarkdown = (text: string) => {
  // Parse `code` and **bold**
  const codeParts = text.split(/(`.*?`)/g);
  return codeParts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`c-${i}`}
          style={{
            backgroundColor: '#E2E8F0',
            color: '#0F172A',
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const boldParts = part.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((bPart, j) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return (
          <strong key={`b-${i}-${j}`} style={{ color: '#0F172A', fontWeight: 700 }}>
            {bPart.slice(2, -2)}
          </strong>
        );
      }
      return bPart;
    });
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
            fontSize: '12px',
            fontWeight: 800,
            color: '#0F5132',
            margin: '8px 0 3px',
            letterSpacing: '0.02em',
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
            fontSize: '14px',
            fontWeight: 800,
            color: '#0F172A',
            margin: '10px 0 4px',
            letterSpacing: '-0.01em'
          }}
        >
          {trimmed.replace(/^#{1,2}\s+/, '')}
        </h3>
      );
    }
    // Blockquote
    if (trimmed.startsWith('> ')) {
      return (
        <div
          key={idx}
          style={{
            borderLeft: '3px solid #0F5132',
            paddingLeft: '10px',
            margin: '6px 0',
            backgroundColor: '#F8FAFC',
            paddingTop: '4px',
            paddingBottom: '4px',
            borderRadius: '0 6px 6px 0',
            color: '#1E293B',
            fontSize: '12px'
          }}
        >
          {parseInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
        </div>
      );
    }
    // Numbered list item e.g. "1. " or "2. "
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s+(.*)/);
      const num = match ? match[1] : '';
      const body = match ? match[2] : trimmed;
      return (
        <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '4px', margin: '4px 0', color: '#1E293B' }}>
          <span style={{ color: '#0F5132', flexShrink: 0, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{num}</span>
          <div style={{ flex: 1, color: '#0F172A', fontWeight: 600 }}>{parseInlineMarkdown(body)}</div>
        </div>
      );
    }
    // Bullet list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const bulletText = trimmed.replace(/^[-*•]\s+/, '');
      return (
        <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '8px', margin: '3px 0', color: '#334155' }}>
          <span style={{ color: '#0F5132', flexShrink: 0, fontWeight: 800 }}>•</span>
          <div style={{ flex: 1, color: '#1E293B' }}>{parseInlineMarkdown(bulletText)}</div>
        </div>
      );
    }
    // Subsection headers e.g. "Post-Evacuation:" or "Status:"
    if (trimmed.endsWith(':') && trimmed.length < 50 && !trimmed.includes('.')) {
      return (
        <div
          key={idx}
          style={{
            fontWeight: 800,
            color: '#0F5132',
            fontSize: '12px',
            margin: '8px 0 2px',
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
          }}
        >
          {trimmed}
        </div>
      );
    }
    return (
      <div key={idx} style={{ margin: '3px 0', color: '#1E293B', lineHeight: 1.6 }}>
        {parseInlineMarkdown(trimmed)}
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
        output: 'PROTECTOR AI 2.0 COMMAND TERMINAL · OPERATIONAL COMMAND SYSTEM READY\nType "help" for structured command reference or ask any question in natural language.'
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
      output: 'PROTECTOR AI 2.0 COMMAND TERMINAL · OPERATIONAL COMMAND SYSTEM READY\nType "help" for structured command reference or ask any question in natural language.'
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

  // Load OpenRouter Status on mount & sync persistent client key
  useEffect(() => {
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('protector_ai_openrouter_key') : null;
    if (storedKey) {
      setKeyInput(storedKey);
    }
    const loadStatus = async () => {
      try {
        const st = await api.getOpenRouterStatus();
        if (st.connected) {
          setOpenrouterStatus(st);
        } else if (storedKey) {
          try {
            await api.updateOpenRouterConfig({ api_key: storedKey, model: selectedModel });
            const refreshed = await api.getOpenRouterStatus();
            setOpenrouterStatus(refreshed);
          } catch {
            setOpenrouterStatus({ ...st, connected: true, masked_key: `${storedKey.slice(0, 10)}...` });
          }
        } else {
          setOpenrouterStatus(st);
        }
        if (st.active_model) {
          setSelectedModel(st.active_model);
        }
      } catch {
        // quiet
      }
    };
    loadStatus();
  }, [selectedModel]);

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
      const storedKey = typeof window !== 'undefined' ? localStorage.getItem('protector_ai_openrouter_key') || undefined : undefined;
      const message = await api.sendTerminalConversationMessage(activeConversationId, trimmed, {
        model: selectedModel,
        custom_api_key: storedKey
      });
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
    if (!keyInput.trim()) return;
    const trimmedKey = keyInput.trim();
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('protector_ai_openrouter_key', trimmedKey);
      }
      await api.updateOpenRouterConfig({ api_key: trimmedKey, model: selectedModel });
      const st = await api.getOpenRouterStatus();
      setOpenrouterStatus(st);
    } catch {
      setOpenrouterStatus((prev) => prev ? { ...prev, connected: true, masked_key: `${trimmedKey.slice(0, 10)}...` } : null);
    }
    setShowKeyModal(false);
  };

  const renderResult = (res: TerminalResult) => {
    if (res.type === 'ai_response') {
      return (
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 16px',
          margin: '8px 0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, color: '#0F5132', letterSpacing: '0.04em' }}>
                {res.title || 'AI AUDIT & ADVISORY REPORT'}
              </span>
            </div>
            {res.data && (res.data as any).elapsed_ms && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#64748B' }}>
                {(res.data as any).elapsed_ms}ms · {(res.data as any).tokens || 0} tokens
              </span>
            )}
          </div>
          <div style={{
            fontSize: '12.5px',
            color: '#1E293B',
            lineHeight: 1.6,
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
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 18px',
          margin: '8px 0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
            {res.title || 'TELEMETRY RESULT'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#0F5132', fontFamily: 'var(--font-mono)' }}>
              {d.compliance_rate}%
            </span>
            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>
              Operational Compliance
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
            {res.output}
          </div>
        </div>
      );
    }

    if (res.type === 'status_card' && res.data) {
      return (
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 18px',
          margin: '8px 0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, color: '#0F5132', marginBottom: '10px' }}>
            {res.title?.toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            {Object.entries(res.data).map(([k, v]) => (
              <div key={k}>
                <span style={{ color: '#64748B' }}>{k.toUpperCase()}: </span>
                <span style={{ color: '#0F172A', fontWeight: 700 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (res.type === 'table' && res.columns && res.rows) {
      return (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          overflow: 'hidden',
          margin: '8px 0',
          maxWidth: '100%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          {res.title && (
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, color: '#0F5132' }}>
              {res.title.toUpperCase()}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  {res.columns.map((col, idx) => (
                    <th key={idx} style={{ padding: '8px 12px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.rows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '8px 12px', color: cIdx === 0 ? '#0F5132' : '#0F172A', fontWeight: cIdx === 0 ? 700 : 500 }}>
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
      const isKeyError = res.output?.toLowerCase().includes('openrouter api key') || res.output?.toLowerCase().includes('sk-or-v1');
      return (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '10px',
          color: '#B91C1C',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          margin: '8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div>{res.output}</div>
          {isKeyError && isAdministrator && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setKeyInput('');
                  setShowKeyModal(true);
                }}
                style={{
                  fontSize: '11px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  backgroundColor: '#0F5132',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600
                }}
              >
                Configure OpenRouter Key
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <pre style={{
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit',
        fontSize: '11.5px',
        color: '#1E293B',
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '10px 14px',
        lineHeight: 1.6,
        margin: '6px 0'
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
          backgroundColor: '#FFFFFF',
          borderLeft: '1.5px solid #E2E8F0',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.15)',
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
          height: '52px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 800, color: '#0F172A', letterSpacing: '0.04em' }}>
              HELP & OPS CONSOLE
            </span>
            <button
              type="button"
              onClick={() => {
                if (isAdministrator) setShowKeyModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: openrouterStatus?.connected ? '#0F5132' : '#B45309',
                backgroundColor: openrouterStatus?.connected ? '#ECFDF5' : '#FEF3C7',
                border: `1px solid ${openrouterStatus?.connected ? '#A7F3D0' : '#FDE68A'}`,
                padding: '3px 8px',
                borderRadius: '6px',
                cursor: isAdministrator ? 'pointer' : 'default',
                fontWeight: 600
              }}
              title={openrouterStatus?.connected ? 'OpenRouter Cloud Neural Engine Online' : 'Local Safety Kernel Active. Click to configure OpenRouter API Key for Cloud LLM.'}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: openrouterStatus?.connected ? '#10B981' : '#F59E0B'
              }} />
              <span>{openrouterStatus?.connected ? 'Cloud AI Online' : 'Local Safety AI'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                api.updateOpenRouterConfig({ model: e.target.value });
              }}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '4px 10px',
                color: '#0F172A',
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                fontWeight: 600,
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
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#334155',
                cursor: 'pointer'
              }}
              title="Configure OpenRouter API Key"
            >
              Key
            </button>}

            <button
              onClick={onClose}
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: '13px'
              }}
              title="Close Terminal [Esc]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Saved conversations are scoped to the signed-in user. */}
        <div style={{
          padding: '8px 16px',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
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
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#0F172A',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 500
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 600,
              backgroundColor: '#0F5132',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(15, 81, 50, 0.2)'
            }}
            title="Start a new saved conversation"
          >
            <Plus size={13} />
            New chat
          </button>
        </div>

        {/* Minimal Quick Action Strip */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
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
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
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
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
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
          padding: '16px 20px',
          fontSize: '12.5px',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          userSelect: 'text'
        }}>
          {isLoadingConversation && (
            <div style={{ color: '#64748B', fontSize: '11.5px', marginBottom: '10px' }}>
              Loading saved conversation...
            </div>
          )}
          {history.map((item) => (
            <div key={item.id} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#0F5132', fontWeight: 800 }}>protector@ops</span>
                <span style={{ color: '#64748B' }}>:~$</span>
                <span style={{ color: '#0F172A', fontWeight: 700 }}>{item.command}</span>
                <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: 'auto' }}>{item.timestamp}</span>
              </div>

              <div style={{ marginTop: '6px' }}>
                {renderResult(item.result)}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ color: '#0F5132', fontSize: '11.5px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#0F5132' }} />
              <span style={{ fontWeight: 600 }}>Executing command & processing system telemetry...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar - Simple & Clean */}
        <div style={{
          padding: '14px 18px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          flexShrink: 0
        }}>
          {(terminalError || voiceError) && (
            <div role="status" style={{
              color: '#DC2626',
              fontSize: '11.5px',
              marginBottom: '8px',
              lineHeight: 1.4,
              fontWeight: 500
            }}>
              {terminalError || voiceError}
            </div>
          )}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#F8FAFC',
            border: '1.5px solid #CBD5E1',
            borderRadius: '8px',
            padding: '5px 12px'
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#0F5132', fontWeight: 800 }}>
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
                fontSize: '12.5px',
                color: '#0F172A',
                fontWeight: 500,
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
                borderRadius: '6px',
                border: `1px solid ${isListening ? '#FECACA' : '#CBD5E1'}`,
                backgroundColor: isListening ? '#FEF2F2' : '#FFFFFF',
                color: isListening ? '#DC2626' : '#475569',
                cursor: isLoading || isLoadingConversation ? 'not-allowed' : 'pointer',
                flexShrink: 0
              }}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={() => handleExecute(inputVal)}
              disabled={isLoading || isLoadingConversation || !inputVal.trim()}
              style={{
                fontSize: '11.5px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#0F5132',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                cursor: isLoading || isLoadingConversation || !inputVal.trim() ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(15, 81, 50, 0.25)',
                opacity: isLoading || isLoadingConversation || !inputVal.trim() ? 0.6 : 1
              }}
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
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '90%',
            maxWidth: '520px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: '0 24px 64px rgba(15, 23, 42, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                  OPENROUTER API KEY CONFIGURATION
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5, marginBottom: '16px' }}>
              Configure your active OpenRouter API key for autonomous computer vision safety inspections and intelligent operations commands.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#334155', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                OpenRouter Key (sk-or-v1-...)
              </label>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                style={{
                  width: '100%',
                  backgroundColor: '#F8FAFC',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#0F172A',
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
                style={{
                  fontSize: '12px',
                  padding: '8px 16px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKeyConfig}
                style={{
                  fontSize: '12px',
                  padding: '8px 18px',
                  backgroundColor: '#0F5132',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(15, 81, 50, 0.2)'
                }}
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
