'use client';
import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Transaction } from '@/lib/types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchTransactions = useCallback(async (filters?: { category?: string; tx_type?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.transactions.list({ limit: 200, ...filters }) as Transaction[];
      setTransactions(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadCSV = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const result = await api.transactions.uploadCSV(file);
      await fetchTransactions();
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
    }
  }, [fetchTransactions]);

  const updateCategory = useCallback(async (id: string, category: string) => {
    await api.transactions.update(id, { category });
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, category } : t));
  }, []);

  return { transactions, loading, error, uploading, fetchTransactions, uploadCSV, updateCategory };
}
