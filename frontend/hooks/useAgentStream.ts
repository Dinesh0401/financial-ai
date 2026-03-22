'use client';
import { useState, useCallback, useRef } from 'react';
import { AgentEvent, AgentName, AgentStatus, FinalRecommendation } from '@/lib/types';
import { getToken } from '@/lib/auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useAgentStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<Record<AgentName, AgentStatus>>({} as any);
  const [final, setFinal] = useState<FinalRecommendation | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<Array<{ ts: string; agent: string; msg: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((agent: string, msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    setLogs(prev => [...prev, { ts, agent, msg }]);
  }, []);

  const runAgent = useCallback(async (query: string) => {
    setIsRunning(true);
    setEvents([]);
    setFinal(null);
    setLogs([]);
    setAgentStatus({} as any);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getToken();
      const response = await fetch(`${BASE_URL}/agents/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const ev: AgentEvent = JSON.parse(line.slice(6));
            setEvents(prev => [...prev, ev]);

            switch (ev.phase) {
              case 'start':
              case 'tools':
              case 'orchestrate':
              case 'coordinating':
                addLog('system', ev.msg || ev.phase);
                break;
              case 'plan':
                addLog('orchestrator', `Activating: ${ev.agents?.join(', ')}`);
                break;
              case 'agent_start':
                if (ev.agent) {
                  setAgentStatus(s => ({ ...s, [ev.agent!]: 'running' }));
                  addLog(ev.agent, 'Starting analysis...');
                }
                break;
              case 'agent_done':
                if (ev.agent) {
                  setAgentStatus(s => ({ ...s, [ev.agent!]: 'done' }));
                  addLog(ev.agent, 'Analysis complete ✓');
                }
                break;
              case 'final':
                setFinal(ev.data);
                addLog('coordinator', 'Final plan generated ✓');
                break;
              case 'error':
                addLog('error', ev.msg || 'An error occurred');
                break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog('error', 'Connection failed — is the backend running?');
      }
    } finally {
      setIsRunning(false);
    }
  }, [addLog]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setFinal(null);
    setLogs([]);
    setAgentStatus({} as any);
  }, []);

  return { events, agentStatus, final, isRunning, logs, runAgent, stop, reset };
}
