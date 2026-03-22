'use client';
import { useEffect } from 'react';
import { useFinancialData } from '@/hooks/useFinancialData';
import { formatINR } from '@/lib/formatters';
import { FileText, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function ReportsPage() {
  const { data, loading, refetch } = useFinancialData();
  useEffect(() => { refetch(); }, [refetch]);

  const catData = Object.entries(data?.category_spending || {}).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
            <span style={{ color: 'var(--blue)' }}>Financial</span> Reports
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Summary of your financial health and spending patterns</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: '60px' }}>Loading report data...</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Monthly Income', value: data?.kpis.monthly_income || 0, color: 'var(--accent)' },
              { label: 'Monthly Expenses', value: data?.kpis.monthly_expenses || 0, color: 'var(--amber)' },
              { label: 'Monthly Surplus', value: data?.kpis.monthly_surplus || 0, color: (data?.kpis.monthly_surplus || 0) >= 0 ? 'var(--accent)' : 'var(--red)' },
              { label: 'Total Debt', value: data?.kpis.total_debt || 0, color: 'var(--red)' },
              { label: 'Health Score', value: null, color: 'var(--blue)', extra: `${data?.health_score.total || 0}/100 (${data?.health_score.grade})` },
              { label: 'Risk Level', value: null, color: 'var(--purple)', extra: data?.risks.severity || 'LOW' },
            ].map(({ label, value, color, extra }) => (
              <div key={label} className="fm-card" style={{ borderTop: `2px solid ${color}` }}>
                <p style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '8px' }}>{label.toUpperCase()}</p>
                <p style={{ fontSize: '24px', fontFamily: 'var(--font-head)', fontWeight: 700, color }}>
                  {extra || formatINR(value as number)}
                </p>
              </div>
            ))}
          </div>

          {/* Spending Bar Chart */}
          {catData.length > 0 && (
            <div className="fm-card">
              <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '16px' }}>SPENDING BY CATEGORY</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={catData} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#5a7a9a', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`}/>
                  <YAxis type="category" dataKey="name" tick={{ fill: '#dce8f5', fontSize: 12 }} axisLine={false} tickLine={false} width={120}/>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '12px' }}
                    formatter={(v: any) => [formatINR(v), 'Amount']}/>
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {catData.map((_, i) => <Cell key={i} fill={`hsl(${(i * 37) % 360}, 70%, 60%)`}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Risk Summary */}
          {data?.risks.flags && data.risks.flags.length > 0 && (
            <div className="fm-card">
              <p style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '16px' }}>RISK SUMMARY</p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Debt-to-Income', value: `${data.risks.debt_to_income}%` },
                  { label: 'Expense Ratio', value: `${data.risks.expense_to_income}%` },
                  { label: 'Emergency Fund', value: `${data.risks.emergency_months} months` },
                  { label: 'Savings Rate', value: `${data.risks.savings_rate}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '12px 16px', background: 'var(--bg-panel)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', minWidth: '160px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{label}</p>
                    <p style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
