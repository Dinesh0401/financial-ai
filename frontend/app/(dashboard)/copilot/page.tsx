'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Paperclip } from 'lucide-react';
import api from '@/lib/api';
import { ChatMessage } from '@/lib/types';
import { getUser } from '@/lib/auth';
import { formatINR } from '@/lib/formatters';

const SUGGESTED_PROMPTS = [
  'Can I afford a car next year?',
  'How should I invest ₹10,000 monthly?',
  'What is my biggest financial risk?',
  'Show SIP projection for 10 years',
];

const TYPING_TEXTS = ['Analyzing your data...', 'Running agent...', 'Generating response...'];

function TypingIndicator() {
  const [textIdx, setTextIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTextIdx(i => (i + 1) % TYPING_TEXTS.length), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: 'var(--bg-card)', borderRadius: '12px', maxWidth: '280px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        <span className="dot-1" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block' }}/>
        <span className="dot-2" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block' }}/>
        <span className="dot-3" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block' }}/>
      </div>
      <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{TYPING_TEXTS[textIdx]}</span>
    </div>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const user = getUser();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res: any = await api.copilot.chat({ message: text, conversation_history: history });
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: res.response, timestamp: new Date(), confidence: res.confidence,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: `Error: ${e.message}. Is the backend running and ANTHROPIC_API_KEY set?`,
        timestamp: new Date(),
      }]);
    } finally { setLoading(false); }
  }, [messages, loading]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '0', height: 'calc(100vh - 100px)', maxWidth: '1400px' }}>
      {/* Left Context Panel */}
      <div className="fm-card" style={{ borderRadius: 'var(--r-lg) 0 0 var(--r-lg)', borderRight: 'none', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} style={{ color: '#04080f' }}/>
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>FinMind Copilot</p>
              <p style={{ fontSize: '11px', color: 'var(--accent)' }}>● Full access to your data</p>
            </div>
          </div>
          <div style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 'var(--r-md)', padding: '12px', fontSize: '12px', color: 'var(--text-2)' }}>
            Copilot uses your real financial data — income, expenses, loans, and goals — for personalized advice.
          </div>
        </div>

        <div>
          <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', letterSpacing: '0.1em', marginBottom: '12px' }}>SUGGESTED QUESTIONS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SUGGESTED_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)} disabled={loading} style={{
                textAlign: 'left', padding: '10px 14px', background: 'var(--bg-hover)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '0 var(--r-lg) var(--r-lg) 0' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <Bot size={48} style={{ color: 'var(--text-3)', margin: '0 auto 16px', display: 'block' }}/>
              <p style={{ color: 'var(--text-2)', fontSize: '16px', fontWeight: 600 }}>Ask me anything about your finances</p>
              <p style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: '8px' }}>I have access to your income, expenses, goals, and loans</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '85%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--blue)' : 'linear-gradient(135deg, var(--accent), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user' ? <User size={14} style={{ color: '#fff' }}/> : <Bot size={14} style={{ color: '#04080f' }}/>}
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user' ? 'rgba(61,142,248,0.2)' : 'var(--bg-card)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(61,142,248,0.3)' : 'var(--border)'}`,
                  fontSize: '14px', color: 'var(--text)', lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
              {msg.confidence && (
                <span style={{ fontSize: '11px', color: 'var(--text-3)', paddingLeft: msg.role === 'assistant' ? '38px' : '0', paddingRight: msg.role === 'user' ? '38px' : '0' }}>
                  Confidence: {msg.confidence}
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} style={{ color: '#04080f' }}/>
              </div>
              <TypingIndicator />
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about your finances... (Enter to send, Shift+Enter for newline)"
            rows={2} className="fm-input" style={{ flex: 1, resize: 'none', lineHeight: '1.5', padding: '12px 16px' }}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{
            width: 44, height: 44, borderRadius: 'var(--r-md)',
            background: input.trim() ? 'var(--accent)' : 'var(--border-2)',
            border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}>
            <Send size={16} style={{ color: input.trim() ? '#04080f' : 'var(--text-3)' }}/>
          </button>
        </div>
      </div>
    </div>
  );
}
