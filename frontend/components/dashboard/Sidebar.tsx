'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { BarChart2, ArrowLeftRight, Target, Cpu, MessageSquare, FileText, LogOut } from 'lucide-react';
import { clearAuth, getUser } from '@/lib/auth';

const NAV = [
  { href: '/',              label: 'Dashboard',    icon: BarChart2 },
  { href: '/transactions',  label: 'Transactions', icon: ArrowLeftRight },
  { href: '/goals',         label: 'Goals',        icon: Target },
  { href: '/agents',        label: 'AI Agents',    icon: Cpu },
  { href: '/copilot',       label: 'Copilot',      icon: MessageSquare },
  { href: '/reports',       label: 'Reports',      icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const logout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <aside style={{
      width: '240px', minHeight: '100vh', flexShrink: 0,
      background: 'var(--sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            background: 'linear-gradient(135deg, #00e5a0 0%, #3d8ef8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '16px', color: '#04080f',
            flexShrink: 0,
          }}>FM</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>FinMind</span>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '16px', color: 'var(--accent)' }}>AI</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.05em' }}>v2.0</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 20px', cursor: 'pointer',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive ? 'rgba(0,229,160,0.08)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                boxShadow: isActive ? 'inset 4px 0 12px rgba(0,229,160,0.1)' : 'none',
                transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2}
                  style={{ color: label === 'AI Agents' ? (isActive ? 'var(--purple)' : 'var(--text-2)') : 'currentColor' }} />
                <span style={{ fontSize: '13.5px', fontWeight: isActive ? 600 : 400 }}>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: '#04080f', fontFamily: 'var(--font-head)',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={logout} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '8px', background: 'rgba(255,79,114,0.1)', border: '1px solid rgba(255,79,114,0.2)',
            borderRadius: 'var(--r-md)', color: 'var(--red)', cursor: 'pointer', fontSize: '12px',
            transition: 'all 0.2s',
          }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
