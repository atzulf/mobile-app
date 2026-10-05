import { api } from './api';
import { Category } from './category.service';

export interface Transaction {
  id: string;
  categoryId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description?: string;
  transactionDate: string;
  category?: Category;
}

export const TransactionService = {
  getAll: async () => {
    const response = await api.get<Transaction[]>('/transactions');
    return response.data;
  },
  create: async (data: Omit<Transaction, 'id' | 'category'>) => {
    const response = await api.post<Transaction>('/transactions', data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  }
};
