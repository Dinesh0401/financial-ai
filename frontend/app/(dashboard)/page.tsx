'use client';
import { useEffect, useState, useRef } from 'react';
import { useFinancialData } from '@/hooks/useFinancialData';
import { formatINR, getScoreColor, getRiskColor, getCategoryColor, animateCounter } from '@/lib/formatters';
import { TrendingUp, TrendingDown, Archive, CreditCard, Shield, Activity, AlertTriangle, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => { animateCounter(0, value, 1200, setDisplay); }, [value]);
  return <>{prefix}{formatINR(display)}{suffix}</>;
}

function HealthGauge({ score }: { score: number }) {
  const radius = 80; const circumference = 2 * Math.PI * radius;
  const angle = (score / 100) * 251;
  const dashOffset = circumference - angle;
  const color = getScoreColor(score);

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <svg width="200" height="140" viewBox="0 0 200 140">
        <path d="M 20 120 A 80 80 0 0 1 180 120" stroke="var(--border-2)" strokeWidth="12" fill="none" strokeLinecap="round"/>
        <path d="M 20 120 A 80 80 0 0 1 180 120" stroke={color} strokeWidth="12" fill="none"
          strokeLinecap="round" strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset} style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}/>
        <text x="100" y="110" textAnchor="middle" fontFamily="var(--font-head)" fontSize="32" fontWeight="700" fill={color}>{score}</text>
        <text x="100" y="132" textAnchor="middle" fontFamily="var(--font-body)" fontSize="12" fill="var(--text-2)">/100</text>
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, refetch } = useFinancialData();
  const initted = useRef(false);

  useEffect(() => {
    if (!initted.current) { refetch(); initted.current = true; }
  }, [refetch]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: 48, height: 48, border: '3px solid var(--border-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>Fetching your financial data...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <AlertCircle size={48} style={{ color: 'var(--red)', margin: '0 auto 16px', display: 'block' }}/>
      <p style={{ color: 'var(--text-2)' }}>Could not connect to backend: {error}</p>
      <p style={{ color: 'var(--text-2)', fontSize: '13px', marginTop: '8px' }}>Make sure the FastAPI server is running on port 8000</p>
      <button onClick={refetch} className="btn btn-secondary" style={{ marginTop: '16px' }}>Retry</button>
    </div>
  );

  const kpis = data?.kpis;
  const health = data?.health_score;
  const risks = data?.risks;
  const recent = data?.recent_transactions || [];
  const categorySpending = data?.category_spending || {};
  const cashflow = data?.cashflow;

  const kpiCards = [
    { label: 'Monthly Income', value: kpis?.monthly_income || 0, icon: TrendingUp, color: 'var(--accent)', border: 'var(--accent)' },
    { label: 'Monthly Expenses', value: kpis?.monthly_expenses || 0, icon: Activity, color: 'var(--amber)', border: 'var(--amber)' },
    { label: 'Monthly Surplus', value: kpis?.monthly_surplus || 0, icon: TrendingUp, color: (kpis?.monthly_surplus || 0) >= 0 ? 'var(--accent)' : 'var(--red)', border: (kpis?.monthly_surplus || 0) >= 0 ? 'var(--accent)' : 'var(--red)' },
    { label: 'Total Debt', value: kpis?.total_debt || 0, icon: CreditCard, color: 'var(--red)', border: 'var(--red)' },
    { label: 'Emergency Fund', value: null, icon: Shield, color: 'var(--blue)', border: 'var(--blue)', extra: `${kpis?.emergency_months?.toFixed(1) || '0.0'} months` },
  ];

  const pieData = Object.entries(categorySpending).map(([name, value]) => ({ name, value }));

  const chartData = cashflow?.projections?.map((p: any, i: number) => ({
    name: `M+${p.month}`, spend: p.projected_spend,
    income: kpis?.monthly_income || 0,
  })) || [];

  const breakdownItems = health?.breakdown ? [
    { label: 'Savings Rate', ...health.breakdown.savings_rate },
    { label: 'Debt Ratio', ...health.breakdown.debt_ratio },
    { label: 'Emergency Fund', ...health.breakdown.emergency_fund },
    { label: 'Goal Readiness', ...health.breakdown.goal_readiness },
    { label: 'Expense Efficiency', ...health.breakdown.expense_efficiency },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
            Welcome back, <span style={{ color: 'var(--accent)' }}>{data?.user?.name || 'User'}</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>Financial overview — updated just now</p>
        </div>
        <button onClick={refetch} className="btn btn-secondary" style={{ fontSize: '13px' }}>↻ Refresh</button>
      </div>

      {/* ROW 1: KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        {kpiCards.map(({ label, value, icon: Icon, color, border, extra }) => (
          <div key={label} className="fm-card kpi-card" style={{ borderTop: `2px solid ${border}`, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
              <Icon size={14} style={{ color }} />
            </div>
            <p style={{ fontSize: '22px', fontFamily: 'var(--font-head)', fontWeight: 700, color }}>
              {extra ? extra : (value !== null ? <AnimatedNumber value={value as number} /> : '—')}
            </p>
          </div>
        ))}
      </div>

      {/* ROW 2: Health Score + Cashflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '16px' }}>
        <div className="fm-card">
          <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '16px' }}>FINANCIAL HEALTH SCORE</p>
          {health && <HealthGauge score={Math.round(health.total)} />}
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-head)', fontWeight: 700, color: getScoreColor(health?.total || 0), marginBottom: '20px' }}>
            {health?.grade} — {health?.label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {breakdownItems.map(({ label, score, max }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{score}/{max}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(score / max) * 100}%`, background: getScoreColor((score / max) * 100) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fm-card">
          <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '16px' }}>
            CASHFLOW PROJECTION — {cashflow?.risk || 'LOW'} TREND
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00e5a0" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5b731" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f5b731" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#5a7a9a', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: '#5a7a9a', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`}/>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '12px' }}
                formatter={(v: any) => [formatINR(v), '']}/>
              <Area type="monotone" dataKey="income" stroke="#00e5a0" strokeWidth={2} fill="url(#incGrad)" name="Income"/>
              <Area type="monotone" dataKey="spend" stroke="#f5b731" strokeWidth={2} fill="url(#expGrad)" name="Projected Spend"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROW 3: Recent Transactions + Spending Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: '16px' }}>
        <div className="fm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>RECENT TRANSACTIONS</p>
            <a href="/transactions" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>View all →</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {recent.length === 0 && <p style={{ color: 'var(--text-2)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>No transactions yet. Upload a CSV to get started.</p>}
            {recent.slice(0, 8).map((tx: any, i) => (
              <div key={tx.id || i} className="slide-right" style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px',
                gap: '12px', padding: '10px 4px', borderBottom: i < 7 ? '1px solid rgba(19,32,64,0.4)' : 'none',
                alignItems: 'center', animationDelay: `${i * 40}ms`,
              }}>
                <span style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{tx.date}</span>
                <span style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.merchant || tx.description}</span>
                <span className="badge" style={{ background: `rgba(${getCategoryColor(tx.category || 'Other').includes('#') ? '90,122,154' : '90,122,154'},0.15)`, color: getCategoryColor(tx.category || 'Other'), fontSize: '10px' }}>{tx.category || 'Other'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: tx.type === 'credit' ? 'var(--accent)' : 'var(--red)', textAlign: 'right' }}>
                  {tx.type === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="fm-card">
          <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '16px' }}>SPENDING BY CATEGORY</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} dataKey="value">
                  {pieData.map(({ name }, idx) => (
                    <Cell key={idx} fill={getCategoryColor(name)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '12px' }}
                  formatter={(v: any) => [formatINR(v), '']}/>
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-2)' }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: '13px' }}>Upload transactions to see breakdown</div>
          )}
        </div>
      </div>

      {/* ROW 4: Risk Alerts */}
      {risks && risks.flags && risks.flags.length > 0 && (
        <div className="fm-card">
          <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '16px' }}>
            RISK FLAGS — <span style={{ color: getRiskColor(risks.severity) }}>{risks.severity}</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {risks.flags.map((flag: any, i: number) => (
              <div key={i} className="alert-enter" style={{
                border: `1px solid ${getRiskColor(flag.severity)}30`,
                borderLeft: `3px solid ${getRiskColor(flag.severity)}`,
                borderRadius: 'var(--r-md)', padding: '14px',
                background: `${getRiskColor(flag.severity)}08`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <AlertTriangle size={14} style={{ color: getRiskColor(flag.severity), flexShrink: 0 }} className={flag.severity === 'CRITICAL' ? 'shake' : ''} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{flag.title}</span>
                  <span className="badge" style={{ marginLeft: 'auto', background: `${getRiskColor(flag.severity)}15`, color: getRiskColor(flag.severity) }}>
                    {flag.severity}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px' }}>{flag.msg}</p>
                <p style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>→ {flag.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
