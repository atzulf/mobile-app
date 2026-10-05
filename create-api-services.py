import os

os.makedirs('src/services', exist_ok=True)

files = {
    'src/services/api.ts': '''import axios from 'axios';
import { Platform } from 'react-native';

// Gunakan 10.0.2.2 untuk Android Emulator, atau IP lokal Anda jika menggunakan fisik/Expo Go (misal 192.168.x.x)
// Sementara untuk iOS Simulator gunakan localhost
const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});
''',
    'src/services/category.service.ts': '''import { api } from './api';

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
''',
    'src/services/transaction.service.ts': '''import { api } from './api';
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
'''
}

for path, content in files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Created Mobile API Services")
