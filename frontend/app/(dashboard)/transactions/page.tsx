'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { formatINR, formatDateShort, getCategoryColor } from '@/lib/formatters';
import { Upload, CloudUpload, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const CATEGORIES = ['Food Delivery','Groceries','Transport','EMI','Shopping','Subscription','Housing','Utilities','Health','Fuel','Dining','Investment','Insurance','Education','Entertainment','Travel','Salary','Transfer','Other'];

export default function TransactionsPage() {
  const { transactions, loading, uploading, fetchTransactions, uploadCSV, updateCategory } = useTransactions();
  const [filter, setFilter] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    try {
      const res = await uploadCSV(files[0]);
      setUploadSuccess(`✓ Imported ${res.imported} transactions successfully`);
      setTimeout(() => setUploadSuccess(''), 5000);
    } catch (e: any) { alert(e.message); }
  }, [uploadCSV]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, multiple: false,
    onDragEnter: () => setIsDragging(true), onDragLeave: () => setIsDragging(false),
  });

  const filtered = transactions.filter(t =>
    !filter || t.category?.toLowerCase().includes(filter.toLowerCase()) ||
    t.description?.toLowerCase().includes(filter.toLowerCase()) ||
    t.merchant?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <div>
        <h1 style={{ fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
          <span style={{ color: 'var(--amber)' }}>Transaction</span> Manager
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Upload bank CSV or track transactions manually with AI classification</p>
      </div>

      {/* Upload Zone */}
      <div {...getRootProps()} className={`drop-zone ${isDragActive ? 'dragging' : ''}`}
        style={{ borderRadius: 'var(--r-xl)', padding: '48px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
        <input {...getInputProps()}/>
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 48, height: 48, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
            <p style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>Classifying transactions with AI...</p>
          </div>
        ) : uploadSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={40} style={{ color: 'var(--accent)' }}/>
            <p style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 600 }}>{uploadSuccess}</p>
          </div>
        ) : (
          <>
            <CloudUpload size={40} style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-3)', margin: '0 auto 16px', display: 'block', transition: 'color 0.2s' }}/>
            <p style={{ fontSize: '16px', color: isDragActive ? 'var(--accent)' : 'var(--text)', fontWeight: 600, marginBottom: '8px' }}>
              {isDragActive ? 'Drop to upload →' : 'Drop your bank CSV here'}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>Supports HDFC, ICICI, SBI, Axis Bank, PhonePe formats</p>
            <button className="btn btn-secondary" type="button" style={{ display: 'inline-flex' }}>
              <Upload size={14} /> Browse files
            </button>
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search transactions..." className="fm-input" style={{ maxWidth: '300px' }}/>
        <select onChange={e => setFilter(e.target.value)} className="fm-input" style={{ maxWidth: '200px', height: '42px' }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ color: 'var(--text-2)', fontSize: '13px', marginLeft: 'auto' }}>
          {filtered.length} transactions
        </span>
      </div>

      {/* Transaction Table */}
      <div className="fm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 130px 120px', gap: '0', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
          {['Date', 'Description', 'Merchant', 'Category', 'Amount'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {loading && <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-2)' }}>Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-2)' }}>No transactions. Upload a CSV to get started.</p>
        )}
        {filtered.slice(0, 100).map((tx, i) => (
          <div key={tx.id} className="slide-right" style={{
            display: 'grid', gridTemplateColumns: '100px 1fr 120px 130px 120px',
            gap: '0', padding: '10px 16px',
            borderBottom: i < filtered.length - 1 ? '1px solid rgba(19,32,64,0.4)' : 'none',
            background: i % 2 === 0 ? 'transparent' : 'rgba(10,21,37,0.5)',
            alignItems: 'center', animationDelay: `${Math.min(i * 30, 600)}ms`,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)' }}>{formatDateShort(tx.date)}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>{tx.description}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.merchant || '—'}</span>
            <div>
              <select value={tx.category || 'Other'}
                onChange={e => updateCategory(tx.id, e.target.value)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: getCategoryColor(tx.category || 'Other'), fontSize: '12px',
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                }}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: 'var(--bg-card)', color: 'var(--text)' }}>{c}</option>)}
              </select>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: tx.type === 'credit' ? 'var(--accent)' : 'var(--red)', textAlign: 'right', display: 'block' }}>
              {tx.type === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
