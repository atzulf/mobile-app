import { z } from 'zod';

export const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'Pilih kategori terlebih dahulu'),
  amount: z
    .string()
    .min(1, 'Nominal wajib diisi')
    .refine((v) => Number(v) > 0, 'Nominal harus lebih dari 0'),
  description: z.string().max(100, 'Maksimal 100 karakter').optional(),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal: YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Tanggal tidak valid'),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
