import { api } from './api';
import { Category } from './category.service';

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: number;
  year: number;
  category?: Category;
  used?: number; // augmented from backend
}

export interface BudgetPayload {
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}

export const BudgetService = {
  getAll: async (month?: number, year?: number) => {
    const res = await api.get<Budget[]>('/budgets', { params: { month, year } });
    return res.data;
  },
  create: async (data: BudgetPayload) => {
    const res = await api.post<Budget>('/budgets', data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/budgets/${id}`);
    return res.data;
  }
};
