'use client';
import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { DashboardSummary } from '@/lib/types';

export function useFinancialData() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.dashboard.summary() as DashboardSummary;
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refetch: fetch };
}
