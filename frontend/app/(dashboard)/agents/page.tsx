'use client';
import { useState } from 'react';
import { useAgentStream } from '@/hooks/useAgentStream';
import { formatINR, getScoreColor } from '@/lib/formatters';
import { Cpu, Zap, DollarSign, CreditCard, Target, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Square } from 'lucide-react';
import { AgentName } from '@/lib/types';

const AGENTS: { name: AgentName; label: string; color: string; icon: any; desc: string }[] = [
  { name: 'expense_agent', label: 'Expense', color: 'var(--amber)', icon: DollarSign, desc: 'Analyzes spending vs 50/30/20 rule' },
  { name: 'debt_agent', label: 'Debt', color: 'var(--red)', icon: CreditCard, desc: 'Avalanche debt repayment strategy' },
  { name: 'goal_agent', label: 'Goals', color: 'var(--blue)', icon: Target, desc: 'Monte Carlo goal probability' },
  { name: 'risk_agent', label: 'Risk', color: 'var(--accent)', icon: AlertTriangle, desc: 'DTI, emergency fund analysis' },
  { name: 'investment_agent', label: 'Investment', color: 'var(--purple)', icon: TrendingUp, desc: 'SIP, NPS, PPF allocation' },
];

const QUICK_PROMPTS = [
  'Can I buy a house in 8 years?',
  'How should I invest ₹10,000/month?',
  'Optimize my debt repayment strategy',
  'What is my biggest financial risk?',
];

const LOG_COLORS: Record<string, string> = {
  system: 'var(--text-2)', orchestrator: 'var(--purple)',
  expense_agent: 'var(--amber)', debt_agent: 'var(--red)',
  goal_agent: 'var(--blue)', risk_agent: 'var(--accent)',
  investment_agent: 'var(--purple)', coordinator: '#60a5fa', error: 'var(--red)',
};

export default function AgentsPage() {
  const [query, setQuery] = useState('');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const { events, agentStatus, final, isRunning, logs, runAgent, stop, reset } = useAgentStream();

  const handleRun = () => {
    if (!query.trim() || isRunning) return;
    reset();
    runAgent(query);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>
      <div>
        <h1 style={{ fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
          <span style={{ color: 'var(--purple)' }}>AI Agent</span> Pipeline
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>5 specialized AI agents analyze your finances in real-time</p>
      </div>

      {/* System Objective Banner */}
      <div className="fm-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px' }}>
        {[
          { label: 'MAXIMIZE', value: 'Financial Health Score', color: 'var(--accent)' },
          { label: 'MINIMIZE', value: 'Debt Risk & Interest Burden', color: 'var(--red)' },
          { label: 'ACHIEVE', value: 'All User-Defined Goals', color: 'var(--blue)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', padding: '12px', borderRadius: 'var(--r-md)', background: `${color}08`, border: `1px solid ${color}20` }}>
            <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color, letterSpacing: '0.15em', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Query Input */}
      <div className="fm-card">
        <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '12px' }}>ASK THE AGENTS</p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            placeholder="e.g. Can I afford a house in 8 years? How should I invest my surplus?"
            className="fm-input" style={{ flex: 1, fontSize: '15px', padding: '14px 18px' }}
          />
          {isRunning ? (
            <button onClick={stop} style={{
              padding: '14px 24px', background: 'rgba(255,79,114,0.15)', border: '1px solid var(--red)',
              borderRadius: 'var(--r-md)', color: 'var(--red)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
            }}><Square size={14} /> STOP</button>
          ) : (
            <button onClick={handleRun} style={{
              padding: '14px 28px', background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--r-md)', color: '#04080f', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-head)', fontSize: '15px',
            }}>ANALYZE →</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => setQuery(p)} style={{
              padding: '6px 12px', background: 'rgba(61,142,248,0.1)', border: '1px solid rgba(61,142,248,0.2)',
              borderRadius: '20px', color: 'var(--blue)', cursor: 'pointer', fontSize: '12px',
              transition: 'all 0.2s',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Pipeline + Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>
        {/* Agent Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={18} style={{ color: 'var(--purple)' }} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Orchestrator</p>
              <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>Plans agent activation dynamically</p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span className={`badge ${events.length > 0 ? 'badge-purple' : 'badge-gray'}`}>
                {events.length > 0 ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
          </div>

          {AGENTS.map(({ name, label, color, icon: Icon, desc }) => {
            const status = agentStatus[name] || 'idle';
            const output = final?.agent_outputs?.[name];
            const isExpanded = expandedAgent === name;

            return (
              <div key={name} style={{
                border: `1px solid ${status === 'running' ? color : status === 'done' ? `${color}40` : 'var(--border)'}`,
                borderRadius: 'var(--r-lg)', padding: '16px', background: 'var(--bg-card)',
                boxShadow: status === 'running' ? `0 0 20px ${color}20` : 'none',
                animation: status === 'running' ? 'agent-pulse 2s infinite' : 'none',
                transition: 'all 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: output ? 'pointer' : 'default' }}
                  onClick={() => output && setExpandedAgent(isExpanded ? null : name)}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{label} Agent</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>{desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${status === 'running' ? 'badge-green' : status === 'done' ? 'badge-blue' : 'badge-gray'}`}
                      style={status === 'running' ? { color, background: `${color}20` } : {}}>
                      {status === 'running' ? 'RUNNING' : status === 'done' ? 'DONE ✓' : 'IDLE'}
                    </span>
                    {output && (isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-2)' }}/> : <ChevronDown size={14} style={{ color: 'var(--text-2)' }}/>)}
                  </div>
                </div>

                {isExpanded && output && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)', overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
                      {JSON.stringify(output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {/* Final Output */}
          {final && (
            <div className="fm-card slide-down" style={{ border: '1px solid var(--accent)', background: 'rgba(0,229,160,0.05)', marginTop: '8px' }}>
              <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '16px' }}>✓ FINAL PLAN GENERATED</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <p style={{ fontSize: '42px', fontFamily: 'var(--font-head)', fontWeight: 800, color: getScoreColor(final.health_score?.total || 0) }}>
                    {Math.round(final.health_score?.total || 0)}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>Health Score</p>
                </div>
                <div style={{ flex: 1 }}>
                  {final.conflict_resolution && final.conflict_resolution !== 'No conflicts detected' && (
                    <div style={{ background: 'rgba(245,183,49,0.1)', border: '1px solid rgba(245,183,49,0.2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 600, marginBottom: '4px' }}>CONFLICT RESOLVED</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>{final.conflict_resolution}</p>
                    </div>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', letterSpacing: '0.08em', marginBottom: '10px' }}>PRIORITY ACTIONS</p>
              {(final.priority_actions || []).slice(0, 5).map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'flex-start' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#04080f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                  <p style={{ fontSize: '13px', color: 'var(--text)' }}>{a.action}</p>
                </div>
              ))}

              {final.month1_allocation && (
                <>
                  <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', letterSpacing: '0.08em', marginTop: '16px', marginBottom: '10px' }}>MONTH 1 ALLOCATION</p>
                  {Object.entries(final.month1_allocation).map(([label, amt]: any) => amt > 0 && (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text)' }}>{formatINR(amt)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Execution Log */}
        <div className="fm-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '700px' }}>
          <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-2)', marginBottom: '12px', flexShrink: 0 }}>
            EXECUTION LOG {isRunning && <span style={{ color: 'var(--accent)' }}> ● LIVE</span>}
          </p>
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.8', background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '12px' }}>
            {logs.length === 0 && (
              <p style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: '40px' }}>
                $ waiting for input...<span style={{ animation: 'agent-pulse 1s infinite', display: 'inline-block' }}>_</span>
              </p>
            )}
            {logs.map((log, i) => (
              <div key={i} className="log-line" style={{ marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-3)' }}>[{log.ts}]</span>{' '}
                <span style={{ color: LOG_COLORS[log.agent] || 'var(--text-2)' }}>{log.agent}</span>{' '}
                <span style={{ color: 'var(--text)' }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
