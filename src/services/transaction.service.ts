import { api } from './api';
import { Category, CategoryType } from './category.service';

export interface Transaction {
  id: string;
  categoryId: string;
  type: CategoryType;
  amount: number;
  description?: string | null;
  transactionDate: string;
  category?: Category;
}

export interface TransactionFilter {
  type?: CategoryType;
  categoryId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface TransactionPayload {
  categoryId: string;
  type: CategoryType;
  amount: number;
  description?: string;
  transactionDate: string; // ISO
}

export const TransactionService = {
  getAll: async (filter: TransactionFilter = {}) => {
    const response = await api.get<Transaction[]>('/transactions', { params: filter });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },
  create: async (data: TransactionPayload) => {
    const response = await api.post<Transaction>('/transactions', data);
    return response.data;
  },
  update: async (id: string, data: Partial<TransactionPayload>) => {
    const response = await api.patch<Transaction>(`/transactions/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },
};
