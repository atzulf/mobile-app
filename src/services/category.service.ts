import { api } from './api';

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon?: string;
}

export const CategoryService = {
  getAll: async () => {
    const response = await api.get<Category[]>('/categories');
    return response.data;
  },
  create: async (data: Omit<Category, 'id'>) => {
    const response = await api.post<Category>('/categories', data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};
