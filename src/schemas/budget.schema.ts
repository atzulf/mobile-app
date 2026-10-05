import { z } from 'zod';

export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Pilih kategori terlebih dahulu'),
  amount: z
    .string()
    .min(1, 'Nominal wajib diisi')
    .refine((v) => Number(v) > 0, 'Nominal harus lebih dari 0'),
});

export type BudgetFormValues = z.infer<typeof budgetSchema>;
