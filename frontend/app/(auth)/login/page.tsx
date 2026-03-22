'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, TrendingUp, Shield, Zap } from 'lucide-react';
import { setToken, setUser } from '@/lib/auth';
import api from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

const MOCK_CHART = [
  { m: 'Oct', v: 42000 }, { m: 'Nov', v: 38000 }, { m: 'Dec', v: 51000 },
  { m: 'Jan', v: 47000 }, { m: 'Feb', v: 55000 }, { m: 'Mar', v: 62000 },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res: any = await api.auth.login({ email, password });
      setToken(res.access_token);
      setUser(res.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Left Panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              background: 'linear-gradient(135deg, #00e5a0, #3d8ef8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '20px', color: '#04080f',
            }}>FM</div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '24px', color: 'var(--text)' }}>
                FinMind<span style={{ color: 'var(--accent)' }}> AI</span>
              </h1>
              <p style={{ color: 'var(--accent)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>The Bloomberg Terminal for Every Indian</p>
            </div>
          </div>

          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '28px', color: 'var(--text)', marginBottom: '8px' }}>
            Your Money. Your Agents.
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: '15px', marginBottom: '36px', lineHeight: '1.7' }}>
            5 AI agents analyze your finances simultaneously — debt, spending, goals, risk, and investment.
          </p>

          {/* Mini chart */}
          <div style={{ marginBottom: '32px', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)', padding: '16px', background: 'var(--bg-card)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', marginBottom: '12px', letterSpacing: '0.1em' }}>
              NET WORTH TRAJECTORY
            </p>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={MOCK_CHART}>
                <defs>
                  <linearGradient id="loginGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00e5a0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fill: '#5a7a9a', fontSize: 10 }} axisLine={false} tickLine={false}/>
                <Area type="monotone" dataKey="v" stroke="#00e5a0" strokeWidth={2} fill="url(#loginGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { icon: Shield, text: 'Bank-grade security — your data stays private' },
              { icon: Zap, text: 'Real-time AI analysis — 5 agents in parallel' },
              { icon: TrendingUp, text: 'Indian finance context — SIP, EMI, PPF, CIBIL' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-2)', fontSize: '14px' }}>
                <Icon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '28px', color: 'var(--text)', marginBottom: '8px' }}>Welcome back</h2>
          <p style={{ color: 'var(--text-2)', marginBottom: '32px' }}>Sign in to your FinMind AI account</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', display: 'block', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@example.com"
                className="fm-input"
                style={{ borderBottom: '2px solid var(--border)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderRadius: 0, background: 'transparent' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px', display: 'block', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="fm-input"
                  style={{ borderBottom: '2px solid var(--border)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderRadius: 0, background: 'transparent', paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '8px' }}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="slide-down" style={{ background: 'rgba(255,79,114,0.1)', border: '1px solid rgba(255,79,114,0.3)', borderRadius: 'var(--r-md)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                marginTop: '8px', padding: '14px', borderRadius: 'var(--r-md)',
                background: loading ? 'var(--border-2)' : 'var(--accent)',
                color: '#04080f', fontFamily: 'var(--font-head)', fontWeight: 700,
                fontSize: '15px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #04080f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></span>
                  Signing in...
                </>
              ) : 'Sign In →'}
            </button>
          </form>

          <p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-2)', fontSize: '14px' }}>
            New to FinMind AI?{' '}
            <a href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Create account →</a>
          </p>

          <div style={{ marginTop: '32px', padding: '14px', background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 'var(--r-md)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', textAlign: 'center' }}>
              Demo: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>demo@finmind.ai</span> / <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>demo1234</span>
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
