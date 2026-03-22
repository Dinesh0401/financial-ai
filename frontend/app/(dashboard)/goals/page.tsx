'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Target, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Goal } from '@/lib/types';
import { formatINR, getPriorityColor, getScoreColor } from '@/lib/formatters';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: (id: string) => void }) {
  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
  const probColor = goal.probability >= 70 ? 'var(--accent)' : goal.probability >= 40 ? 'var(--amber)' : 'var(--red)';
  const priorityColor = getPriorityColor(goal.priority);

  return (
    <div className="fm-card" style={{ position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{goal.name}</h3>
          <span className="badge" style={{ background: `${priorityColor}15`, color: priorityColor }}>{goal.priority.toUpperCase()}</span>
        </div>
        <button onClick={() => onDelete(goal.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
          <Trash2 size={14}/>
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
            {formatINR(goal.current_amount)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-2)' }}>
            / {formatINR(goal.target_amount)}
          </span>
        </div>
        <div className="progress-bar" style={{ height: '8px' }}>
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%`, background: probColor }}/>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
          {Math.round(progress)}% of target • {goal.deadline_years}yr remaining
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: `${probColor}0d`, borderRadius: 'var(--r-md)', border: `1px solid ${probColor}20` }}>
        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Monte Carlo Probability</span>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '20px', color: probColor }}>
          {goal.probability?.toFixed(1) || 0}%
        </span>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '0', deadline_years: '5', priority: 'medium' });
  const [simulating, setSimulating] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const g = await api.goals.list() as Goal[];
      setGoals(g);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      await api.goals.create({
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount),
        deadline_years: parseFloat(form.deadline_years),
        priority: form.priority,
      });
      setShowForm(false);
      setForm({ name: '', target_amount: '', current_amount: '0', deadline_years: '5', priority: 'medium' });
      await fetchGoals();
    } catch (e: any) { alert(e.message); }
    finally { setSimulating(false); }
  };

  const handleDelete = async (id: string) => {
    await api.goals.delete(id);
    setGoals(g => g.filter(x => x.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
            <span style={{ color: 'var(--blue)' }}>Financial</span> Goals
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Monte Carlo simulation shows probability of achieving each goal</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <Plus size={16} /> Add Goal
        </button>
      </div>

      {showForm && (
        <div className="fm-card slide-down" style={{ border: '1px solid var(--blue)', background: 'rgba(61,142,248,0.05)' }}>
          <h3 style={{ color: 'var(--text)', marginBottom: '16px' }}>New Financial Goal</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Goal name (e.g. Goa Trip)" required className="fm-input"/>
            <input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="Target ₹" required className="fm-input"/>
            <input type="number" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} placeholder="Already saved ₹" className="fm-input"/>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input type="number" value={form.deadline_years} onChange={e => setForm(f => ({ ...f, deadline_years: e.target.value }))} placeholder="Years" className="fm-input"/>
              <span style={{ color: 'var(--text-2)', whiteSpace: 'nowrap', marginLeft: '8px' }}>years</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['low', 'medium', 'high'].map(p => (
                <button type="button" key={p} onClick={() => setForm(f => ({ ...f, priority: p }))} style={{
                  flex: 1, padding: '8px', borderRadius: 'var(--r-md)', border: '1px solid',
                  borderColor: form.priority === p ? getPriorityColor(p) : 'var(--border)',
                  background: form.priority === p ? `${getPriorityColor(p)}15` : 'transparent',
                  color: form.priority === p ? getPriorityColor(p) : 'var(--text-2)',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                }}>{p}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={simulating} className="btn btn-primary" style={{ flex: 1 }}>
                {simulating ? 'Running Monte Carlo...' : 'Create Goal'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-2)' }}>Loading goals...</div>
      ) : goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Target size={48} style={{ color: 'var(--text-3)', margin: '0 auto 16px', display: 'block' }}/>
          <p style={{ color: 'var(--text-2)', fontSize: '16px' }}>No goals yet</p>
          <p style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: '8px' }}>Add your first financial goal to see Monte Carlo probability</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {goals.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDelete}/>)}
        </div>
      )}
    </div>
  );
}
