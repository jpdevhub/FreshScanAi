import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquareCode, X, Send, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

// Definition of Chat Message
interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'up' | 'down';
}

// Map react-router-dom location pathnames to descriptive page and feature names
function getPageContext(pathname: string): { page: string; feature: string } {
  switch (pathname) {
    case '/scanner':
      return { page: 'Scanner', feature: 'Real-time Camera/Upload Image Assessment' };
    case '/map':
      return { page: 'Market Map', feature: 'Crowdsourced Market Trust Heatmap' };
    case '/mode':
      return { page: 'Mode Selection', feature: 'Scan Protocol selector (Auto vs Multi-Image)' };
    case '/analysis':
      return { page: 'Analysis Dashboard', feature: 'Biomarker fresh index (gill, eye, body) results' };
    case '/results':
      return { page: 'History Results', feature: 'Aggregate user scans history & metrics' };
    case '/auth':
      return { page: 'Authentication', feature: 'Google Secure Sign-in / Dev Bypass' };
    case '/':
      return { page: 'Landing Page', feature: 'Hero CTA & Platform features summary' };
    default:
      return { page: 'App Shell', feature: 'General Navigation' };
  }
}

export default function ChatAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat window when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Suggested onboarding questions shown on initial load
  const suggestedQuestions = [
    { label: 'How does FreshScanAI work?', text: 'How does FreshScanAI work?' },
    { label: 'How do I upload a file?', text: 'How do I upload a file?' },
    { label: 'Where can I see the Trust Map?', text: 'Where can I see the Trust Map?' },
    { label: '⚡ I am new here (Start Onboarding)', text: 'I am new here' }
  ];

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Determine page context from current path
      const { page, feature } = getPageContext(location.pathname);
      
      // Clean history to match expected format on backend: [{role, content}]
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call API
      const response = await api.chatMessage(text, page, feature, historyPayload);

      const assistantMsg: Message = {
        id: response.message_id,
        role: 'assistant',
        content: response.response
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Failed to get chat response:', err);
      const errorMsg: Message = {
        role: 'assistant',
        content: '⚠️ I encountered an error connecting to the FreshScanAI neural chat hub. Please verify your internet connection or check LLM configurations.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (msgId: string, idx: number, type: 'up' | 'down') => {
    const msg = messages[idx];
    if (msg.feedback) return; // Prevent double rating

    try {
      await api.submitChatFeedback(msgId, type);
      setMessages(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], feedback: type };
        return updated;
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  // Basic formatter for markdown-like text to avoid requiring external packages
  const formatText = (text: string) => {
    const paragraphs = text.split('\n');
    return paragraphs.map((para, pIdx) => {
      // Inline formatting helpers: bold (**text**), code (`code`)
      let content: React.ReactNode = para;
      
      // Handle bold blocks
      if (para.includes('**')) {
        const parts = para.split('**');
        content = parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-neon-text font-semibold">{part}</strong> : part);
      }

      // Check if paragraph is a bullet point
      if (para.trim().startsWith('- ') || para.trim().startsWith('* ')) {
        const listText = para.trim().substring(2);
        return (
          <li key={pIdx} className="ml-4 list-disc text-xs text-on-surface-variant font-body mt-1">
            {listText}
          </li>
        );
      }

      // Check if paragraph is numbered list
      const numMatch = para.trim().match(/^(\d+)\.\s+(.+)$/);
      if (numMatch) {
        return (
          <li key={pIdx} className="ml-4 list-decimal text-xs text-on-surface-variant font-body mt-1">
            {numMatch[2]}
          </li>
        );
      }

      // Check for code blocks / console styling
      if (para.trim().startsWith('>')) {
        return (
          <blockquote key={pIdx} className="border-l border-neon bg-surface-lowest px-3 py-1 my-2 text-[11px] font-mono text-on-surface-variant italic">
            {para.trim().substring(1).trim()}
          </blockquote>
        );
      }

      return (
        <p key={pIdx} className="text-xs text-on-surface font-body leading-relaxed mb-1.5 break-words">
          {content}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-[5rem] right-6 md:bottom-6 md:right-6 z-45 w-12 h-12 bg-surface border border-outline hover:border-neon hover:bg-surface-low text-neon flex items-center justify-center cursor-pointer shadow-lg pulse-glow transition-all duration-200"
        title="Open AI Chat Assistant"
        aria-label="Toggle chat assistant"
      >
        {isOpen ? <X size={20} /> : <MessageSquareCode size={20} />}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="fixed bottom-[9.5rem] right-6 md:bottom-20 md:right-6 w-[360px] max-w-[calc(100vw-3rem)] h-[480px] max-h-[calc(100vh-14rem)] bg-surface border border-outline-variant/40 flex flex-col shadow-2xl z-45 animate-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-low border-b border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-neon animate-pulse shrink-0" />
              <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-widest text-neon font-bold">
                FRESHSCAN_AI_ASSISTANT_HUD
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-neon cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-surface-lowest">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-4 px-2 py-6">
                <div className="w-10 h-10 bg-surface-mid border border-outline-variant/30 flex items-center justify-center">
                  <Sparkles size={18} className="text-neon" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold tracking-wide font-[family-name:var(--font-display)] text-heading">
                    AI CHAT ASSISTANT
                  </h3>
                  <p className="text-[11px] text-on-surface-variant max-w-[240px] leading-relaxed">
                    Ask questions about fish freshness analysis, scanning workflows, market mappings, or troubleshoot issues.
                  </p>
                </div>

                {/* Suggestions List */}
                <div className="w-full pt-4 space-y-2">
                  <span className="font-[family-name:var(--font-mono)] text-[9px] text-outline tracking-wider block text-left uppercase">
                    Suggested Prompts:
                  </span>
                  <div className="flex flex-col gap-2">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(q.text)}
                        className="w-full text-left bg-surface border border-outline-variant/20 hover:border-neon hover:bg-surface-mid p-2.5 text-[11px] text-on-surface-variant font-mono cursor-pointer transition-all duration-150"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Role Tag */}
                    <span className="font-[family-name:var(--font-mono)] text-[9px] text-outline tracking-wider">
                      {isUser ? '[USER]' : '[ASSISTANT]'}
                    </span>
                    
                    {/* Message Bubble */}
                    <div
                      className={`p-3 max-w-[90%] border border-transparent ${
                        isUser
                          ? 'bg-surface-low border-outline-variant/15 text-on-surface'
                          : 'bg-surface border-outline-variant/30 text-on-surface'
                      }`}
                    >
                      {formatText(msg.content)}

                      {/* Feedback Rating Icons (Assistant Only) */}
                      {!isUser && msg.id && (
                        <div className="flex items-center justify-end gap-3 mt-3 pt-2 border-t border-outline-variant/10">
                          <button
                            onClick={() => handleFeedback(msg.id!, idx, 'up')}
                            disabled={!!msg.feedback}
                            className={`cursor-pointer transition-colors ${
                              msg.feedback === 'up'
                                ? 'text-neon'
                                : 'text-outline hover:text-neon disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                            title="Helpful response"
                          >
                            <ThumbsUp size={12} />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id!, idx, 'down')}
                            disabled={!!msg.feedback}
                            className={`cursor-pointer transition-colors ${
                              msg.feedback === 'down'
                                ? 'text-error'
                                : 'text-outline hover:text-error disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                            title="Unhelpful response"
                          >
                            <ThumbsDown size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing Loader */}
            {isLoading && (
              <div className="flex flex-col space-y-1 items-start">
                <span className="font-[family-name:var(--font-mono)] text-[9px] text-outline tracking-wider">
                  [ASSISTANT]
                </span>
                <div className="bg-surface border border-outline-variant/30 p-3 max-w-[90%]">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 bg-neon animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-neon animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-neon animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-outline ml-2 uppercase animate-pulse">
                      Processing...
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="flex border-t border-outline-variant/25 bg-surface-low"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="ASK CHAT ASSISTANT..."
              disabled={isLoading}
              className="flex-1 bg-surface-lowest text-xs text-on-surface px-4 py-3.5 border-none focus:outline-none focus:bg-surface-mid placeholder:font-mono placeholder:text-[9px] placeholder:text-outline disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-neon text-on-primary font-mono text-[10px] tracking-wider font-bold px-4 hover:bg-neon-dim cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1"
            >
              <Send size={11} />
              <span>SEND</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
