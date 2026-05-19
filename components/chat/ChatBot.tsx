'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, Loader2, Bot, RotateCcw, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase';
import type { Student, Strategy } from '@/types';

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
    return text.split('\n').map((line, i, arr) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          {i < arr.length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        isUser
          ? 'bg-[var(--accent)] text-white rounded-br-sm'
          : 'bg-[var(--bg-soft)] text-[var(--ink)] rounded-bl-sm border border-[var(--border)]'
      }`}>
        {renderContent(msg.content)}
      </div>
    </div>
  );
}

const SUGGESTED = [
  'What are the strongest parts of this profile?',
  'Which school should they apply ED?',
  'What essay angle should they use?',
  'What are the biggest risks?',
];

export function ChatBot() {
  const pathname = usePathname();
  const { students, strategies } = useApp();

  // Detect current student from URL /students/[studentId]/...
  const urlStudentId = pathname.match(/\/students\/([^/]+)/)?.[1] ?? null;

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [researchData, setResearchData] = useState<ResearchEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const researchFetched = useRef<string | null>(null);

  // Auto-select student from URL
  useEffect(() => {
    if (urlStudentId && urlStudentId !== selectedId) {
      setSelectedId(urlStudentId);
      setMessages([]);
      setResearchData([]);
      researchFetched.current = null;
    }
  }, [urlStudentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const student: Student | null = students.find(s => s.id === selectedId) ?? null;
  const strategy: Strategy | null = (selectedId && strategies[selectedId]) ? strategies[selectedId] : null;

  // Fetch school research when open and student selected (once per student)
  useEffect(() => {
    if (!open || !selectedId || researchFetched.current === selectedId) return;
    researchFetched.current = selectedId;

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
  }, [open, selectedId]);

  // Welcome message when student is selected and chat opens
  useEffect(() => {
    if (!open) return;
    if (!student) {
      setMessages([{
        role: 'assistant',
        content: 'Hi! Select a student above to get personalized admissions advice.',
      }]);
      return;
    }
    if (messages.length === 0 || (messages.length === 1 && messages[0].content.startsWith('Hi! Select'))) {
      const contextParts = [];
      if (strategy) contextParts.push('strategy');
      if (researchData.length) contextParts.push(`${researchData.length} school research`);
      const ctxNote = contextParts.length ? ` I also have the ${contextParts.join(' and ')} loaded.` : '';
      setMessages([{
        role: 'assistant',
        content: `Hi! I have full access to **${student.name}**'s profile.${ctxNote}\n\nWhat would you like to explore?`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, strategy, researchData.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function selectStudent(id: string) {
    setSelectedId(id);
    setShowPicker(false);
    setMessages([]);
    setResearchData([]);
    researchFetched.current = null;
  }

  function clearChat() {
    setMessages([]);
    researchFetched.current = null;
  }

  async function sendMessage(text?: string) {
    if (!student) return;
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
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const contextBadges = [];
  if (strategy) contextBadges.push('Strategy');
  if (researchData.length) contextBadges.push(`${researchData.length} Research`);

  const showSuggested = student && messages.length === 1 && messages[0].role === 'assistant' && !streaming;

  return (
    <>
      {open && (
        <div
          className="fixed bottom-[132px] right-6 z-50 w-[400px] flex flex-col rounded-2xl border border-[var(--border)] bg-white shadow-2xl overflow-hidden"
          style={{ height: '560px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--accent)] text-white flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Bot size={15} className="flex-shrink-0" />
              <span className="text-[13px] font-semibold whitespace-nowrap">Admissions Advisor</span>
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

          {/* Student Picker */}
          <div className="px-3 pt-2.5 pb-1.5 border-b border-[var(--border)] flex-shrink-0 relative">
            <button
              onClick={() => setShowPicker(v => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[13px] text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
            >
              <span className={student ? 'font-medium' : 'text-[var(--ink-muted)]'}>
                {student ? student.name : 'Select a student…'}
              </span>
              <ChevronDown size={14} className={`text-[var(--ink-soft)] transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>
            {showPicker && students.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 z-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-soft)] transition-colors ${
                      s.id === selectedId ? 'bg-[var(--accent-50)] text-[var(--accent)] font-medium' : 'text-[var(--ink)]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: s.color }}
                    />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto text-[11px] text-[var(--ink-muted)] whitespace-nowrap">{s.grade}th · {s.major}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" onClick={() => setShowPicker(false)}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                isStreaming={streaming && i === messages.length - 1}
              />
            ))}

            {showSuggested && (
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
                placeholder={student ? 'Ask about strategy, schools, essays…' : 'Select a student first…'}
                rows={1}
                disabled={streaming || !student}
                className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] overflow-y-auto disabled:opacity-40"
                style={{ minHeight: '36px', maxHeight: '120px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming || !student}
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

      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        title="AI Admissions Advisor"
        className="fixed bottom-[72px] right-6 z-50 w-12 h-12 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center hover:bg-[var(--accent-600)] transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </button>
    </>
  );
}
