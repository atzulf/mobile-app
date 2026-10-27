import { api } from './api';

export type CategoryType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon?: string | null;
}

export const CategoryService = {
  getAll: async () => {
    const response = await api.get<Category[]>('/categories');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },
  create: async (data: Omit<Category, 'id'>) => {
    const response = await api.post<Category>('/categories', data);
    return response.data;
  },
  update: async (id: string, data: Partial<Omit<Category, 'id'>>) => {
    const response = await api.patch<Category>(`/categories/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    // Clean up child transactions and budgets first to prevent foreign key constraint violations (500 Internal Server Error)
    try {
      const txRes = await api.get<{ id: string }[]>('/transactions', { params: { categoryId: id } });
      if (Array.isArray(txRes.data) && txRes.data.length > 0) {
        await Promise.all(txRes.data.map((tx) => api.delete(`/transactions/${tx.id}`).catch(() => {})));
      }
    } catch {
      // Ignore cleanup error and proceed
    }

    try {
      const budgetRes = await api.get<{ id: string; categoryId: string }[]>('/budgets');
      if (Array.isArray(budgetRes.data)) {
        const matchingBudgets = budgetRes.data.filter((b) => b.categoryId === id);
        if (matchingBudgets.length > 0) {
          await Promise.all(matchingBudgets.map((b) => api.delete(`/budgets/${b.id}`).catch(() => {})));
        }
      }
    } catch {
      // Ignore cleanup error and proceed
    }

    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};
