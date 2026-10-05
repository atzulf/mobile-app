import { api } from './api';

export interface DashboardStats {
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryStats {
  id: string;
  name: string;
  total: number;
  color?: string;
}

export interface TrendStats {
  label: string;
  income: number;
  expense: number;
}

export const StatisticsService = {
  getDashboard: async (month?: number, year?: number) => {
    const res = await api.get<DashboardStats>('/statistics/dashboard', { params: { month, year } });
    return res.data;
  },
  getCategories: async (month?: number, year?: number) => {
    const res = await api.get<CategoryStats[]>('/statistics/categories', { params: { month, year } });
    return res.data;
  },
  getTrend: async (year?: number, month?: number) => {
    const res = await api.get<TrendStats[]>('/statistics/trend', { params: { year, month } });
    return res.data;
  }
};
