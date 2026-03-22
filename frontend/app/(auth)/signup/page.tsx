'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { setToken, setUser } from '@/lib/auth';
import api from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', name: '', monthly_income: '', risk_tolerance: 'moderate' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res: any = await api.auth.signup({
        ...form,
        monthly_income: parseFloat(form.monthly_income) || 0,
      });
      setToken(res.access_token); setUser(res.user);
      router.push('/');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', display: 'block', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>{label}</label>
      <input
        type={type === 'password' ? (showPass ? 'text' : 'password') : type}
        value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder} className="fm-input"
        style={{ borderBottom: '2px solid var(--border)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderRadius: 0, background: 'transparent' }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '14px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #00e5a0, #3d8ef8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '22px', color: '#04080f',
          }}>FM</div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '26px', color: 'var(--text)' }}>
            Start your financial journey
          </h1>
          <p style={{ color: 'var(--text-2)', marginTop: '6px' }}>5 AI agents analyze your money so you don't have to</p>
        </div>

        <div className="fm-card" style={{ borderRadius: 'var(--r-xl)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {field('name', 'FULL NAME', 'text', 'Rahul Sharma')}
            {field('email', 'EMAIL ADDRESS', 'email', 'you@example.com')}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', display: 'block', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters" className="fm-input"
                  style={{ borderBottom: '2px solid var(--border)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderRadius: 0, background: 'transparent', paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            {field('monthly_income', 'MONTHLY INCOME (₹)', 'number', '50000')}

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>RISK TOLERANCE</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['conservative', 'moderate', 'aggressive'].map(r => (
                  <button key={r} type="button" onClick={() => setForm(f => ({ ...f, risk_tolerance: r }))}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 'var(--r-md)', border: '1px solid',
                      borderColor: form.risk_tolerance === r ? 'var(--accent)' : 'var(--border)',
                      background: form.risk_tolerance === r ? 'rgba(0,229,160,0.1)' : 'transparent',
                      color: form.risk_tolerance === r ? 'var(--accent)' : 'var(--text-2)',
                      cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                    }}>{r}</button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,79,114,0.1)', border: '1px solid rgba(255,79,114,0.3)', borderRadius: 'var(--r-md)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: '4px', padding: '14px', borderRadius: 'var(--r-md)',
              background: loading ? 'var(--border-2)' : 'var(--accent)',
              color: '#04080f', fontFamily: 'var(--font-head)', fontWeight: 700,
              fontSize: '15px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}>
              {loading ? 'Creating account...' : 'Create Account & Start →'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: '20px', textAlign: 'center', color: 'var(--text-2)', fontSize: '14px' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in →</a>
        </p>
      </div>
    </div>
  );
}
