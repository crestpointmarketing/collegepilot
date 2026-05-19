'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { MessageSquare, X, Send, Loader2, Bot, RotateCcw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase';
import type { Strategy } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ResearchEntry {
  school_name: string;
  program: string;
  [key: string]: unknown;
}

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming: boolean }) {
  const isUser = msg.role === 'user';

  function renderContent(text: string) {
    if (!text && isStreaming) {
      return (
        <span className="inline-flex gap-1 items-center h-4">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-current animate-bounce opacity-60"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      );
    }
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const rendered = parts.map((part, j) =>
        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
      );
      return (
        <span key={i}>
          {rendered}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-sm'
            : 'bg-[var(--bg-soft)] text-[var(--ink)] rounded-bl-sm border border-[var(--border)]'
        }`}
      >
        {renderContent(msg.content)}
      </div>
    </div>
  );
}

const SUGGESTED = [
  'What are the strongest parts of this profile?',
  'Which school should they apply ED?',
  'What essay angle should they use?',
  'What are the biggest risks in this application?',
];

export function StudentChatBot() {
  const params = useParams<{ studentId: string }>();
  const studentId = params?.studentId;
  const { students, strategies } = useApp();
  const student = students.find(s => s.id === studentId);
  const strategy: Strategy | null = (studentId && strategies[studentId]) ? strategies[studentId] : null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [researchData, setResearchData] = useState<ResearchEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch school research when chat opens (lazy, once per session)
  const researchFetched = useRef(false);
  useEffect(() => {
    if (!open || researchFetched.current) return;
    researchFetched.current = true;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('school_research')
        .select('school_name, program, data')
        .eq('user_id', user.id)
        .then(({ data: rows }) => {
          if (rows?.length) {
            setResearchData(rows.map(r => ({ school_name: r.school_name, program: r.program, ...r.data })));
          }
        });
    });
  }, [open]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0 && student) {
      const contextParts = [];
      if (strategy) contextParts.push('generated strategy');
      if (researchData.length) contextParts.push(`research on ${researchData.length} school(s)`);
      const contextNote = contextParts.length
        ? ` I also have the ${contextParts.join(' and ')} for reference.`
        : '';

      setMessages([{
        role: 'assistant',
        content: `Hi! I have full access to ${student.name}'s profile — academics, activities, awards, and projects.${contextNote}\n\nWhat would you like to explore?`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update welcome message context note if strategy/research loads after open
  useEffect(() => {
    if (!open || messages.length !== 1 || messages[0].role !== 'assistant') return;
    if (!student) return;
    const contextParts = [];
    if (strategy) contextParts.push('generated strategy');
    if (researchData.length) contextParts.push(`research on ${researchData.length} school(s)`);
    const contextNote = contextParts.length
      ? ` I also have the ${contextParts.join(' and ')} for reference.`
      : '';
    setMessages([{
      role: 'assistant',
      content: `Hi! I have full access to ${student.name}'s profile — academics, activities, awards, and projects.${contextNote}\n\nWhat would you like to explore?`,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, researchData]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  if (!student) return null;

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const userMsg: Message = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          student,
          strategy: strategy ?? null,
          researchData: researchData.length ? researchData : undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      }
    } catch {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: 'Sorry, something went wrong. Please try again.' }];
      });
    } finally {
      setStreaming(false);
    }
  };

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    researchFetched.current = false;
    setMessages([{
      role: 'assistant',
      content: `Chat cleared. What would you like to know about ${student!.name}'s application?`,
    }]);
  }

  // Context badges shown in header
  const contextBadges = [];
  if (strategy) contextBadges.push('Strategy');
  if (researchData.length) contextBadges.push(`${researchData.length} Research`);

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-[400px] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden"
          style={{ height: '540px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--accent)] text-white flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot size={15} />
              <span className="text-[13px] font-semibold whitespace-nowrap">Admissions Advisor</span>
              <span className="text-[11px] opacity-70 truncate">· {student.name}</span>
              {contextBadges.map(b => (
                <span key={b} className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 whitespace-nowrap">
                  {b}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={clearChat} title="Clear chat" className="opacity-70 hover:opacity-100 transition-opacity">
                <RotateCcw size={13} />
              </button>
              <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                isStreaming={streaming && i === messages.length - 1}
              />
            ))}

            {messages.length === 1 && !streaming && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[11.5px] px-2.5 py-1 rounded-full border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-50)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-[var(--border)] flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKey}
                placeholder="Ask about strategy, schools, essays…"
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] overflow-y-auto disabled:opacity-50"
                style={{ minHeight: '36px', maxHeight: '120px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[var(--accent-600)] transition-colors"
              >
                {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-[10.5px] text-[var(--ink-muted)] mt-1.5 px-1">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        title="Ask AI Advisor"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center hover:bg-[var(--accent-600)] transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </button>
    </>
  );
}
