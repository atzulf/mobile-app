import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Budget, BudgetService } from '../../services/budget.service';
import { Category, CategoryService } from '../../services/category.service';
import { colors, getCategoryIcon, radius, spacing, shadow } from '../../theme';
import { formatMonth, formatRupiah, formatThousands, getErrorMessage, confirmAction } from '../../utils/format';
import { ErrorState, Loading, Fab, EmptyState } from '../../components/ui/common';
import { budgetSchema, BudgetFormValues } from '../../schemas/budget.schema';

export default function BudgetScreen() {
  const [date, setDate] = useState(() => new Date());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { categoryId: '', amount: '' }
  });

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await BudgetService.getAll(date.getMonth() + 1, date.getFullYear());
      setBudgets(data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    if (showForm) {
      CategoryService.getAll().then(cats => setCategories(cats.filter(c => c.type === 'EXPENSE'))).catch(() => {});
    }
  }, [showForm]);

  const shiftMonth = (delta: number) => {
    setLoading(true);
    setDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const onSubmit = async (values: BudgetFormValues) => {
    setFormError(null);
    try {
      await BudgetService.create({
        categoryId: values.categoryId,
        amount: Number(values.amount),
        month: date.getMonth() + 1,
        year: date.getFullYear()
      });
      setShowForm(false);
      reset();
      setLoading(true);
      loadData();
    } catch (e) {
      setFormError(getErrorMessage(e));
    }
  };

  const onDelete = async (id: string) => {
    if (!await confirmAction('Hapus Budget?', 'Anda yakin ingin menghapus budget ini?')) return;
    try {
      setLoading(true);
      await BudgetService.delete(id);
      loadData();
    } catch (e) {
      alert(getErrorMessage(e));
      setLoading(false);
    }
  };

  const selectedCategory = watch('categoryId');

  if (showForm) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          <View style={styles.formHeader}>
            <Pressable onPress={() => setShowForm(false)} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.formTitle}>Tambah Budget</Text>
            <View style={{ width: 24 }} />
          </View>
          <Text style={styles.formSubtitle}>Untuk {formatMonth(date)}</Text>

          <Text style={styles.label}>Kategori Pengeluaran</Text>
          <View style={styles.categoryGrid}>
            {categories.map((c) => {
              const active = selectedCategory === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setValue('categoryId', c.id, { shouldValidate: true })}
                  style={[styles.categoryItem, active && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                >
                  <Ionicons name={getCategoryIcon(c.name)} size={22} color={active ? colors.primary : colors.muted} />
                  <Text style={[styles.categoryText, active && { color: colors.primary }]} numberOfLines={1}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.categoryId && <Text style={styles.error}>{errors.categoryId.message}</Text>}

          <Text style={styles.label}>Nominal Budget</Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { value, onChange } }) => (
              <View style={[styles.amountBox, errors.amount && styles.inputError]}>
                <Text style={styles.currency}>Rp</Text>
                <TextInput
                  value={formatThousands(value)}
                  onChangeText={(t) => onChange(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  style={styles.amountInput}
                />
              </View>
            )}
          />
          {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}

          {formError && <Text style={[styles.error, { marginTop: spacing.md }]}>{formError}</Text>}

          <Pressable onPress={handleSubmit(onSubmit)} disabled={isSubmitting} style={styles.submitBtn}>
            <Text style={styles.submitBtnText}>{isSubmitting ? 'Menyimpan...' : 'Simpan Budget'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonth(date)}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {loading ? <Loading /> :
         error ? <ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} /> :
         budgets.length === 0 ? <EmptyState icon="wallet-outline" title="Belum ada budget" message={`Buat budget untuk mengontrol pengeluaran di ${formatMonth(date)}`} /> :
         budgets.map(b => {
           const used = b.used || 0;
           const pct = Math.min((used / b.amount) * 100, 100);
           const isWarning = pct >= 80 && pct < 100;
           const isExceeded = pct >= 100;
           const statusColor = isExceeded ? colors.expense : (isWarning ? '#F59E0B' : colors.income);
           const statusText = isExceeded ? 'EXCEEDED' : (isWarning ? 'WARNING' : 'SAFE');
           
           return (
             <View key={b.id} style={styles.budgetCard}>
               <View style={styles.bHeader}>
                 <View style={styles.bTitleRow}>
                   <View style={[styles.iconWrap, { backgroundColor: statusColor + '20' }]}>
                     <Ionicons name={getCategoryIcon(b.category?.name)} size={18} color={statusColor} />
                   </View>
                   <Text style={styles.bCategory}>{b.category?.name}</Text>
                 </View>
                 <Pressable onPress={() => onDelete(b.id)} hitSlop={10}>
                   <Ionicons name="trash-outline" size={18} color={colors.muted} />
                 </Pressable>
               </View>

               <View style={styles.bStats}>
                 <View>
                   <Text style={styles.bStatLabel}>Budget</Text>
                   <Text style={styles.bStatValue}>{formatRupiah(b.amount)}</Text>
                 </View>
                 <View style={{ alignItems: 'flex-end' }}>
                   <Text style={styles.bStatLabel}>Terpakai</Text>
                   <Text style={styles.bStatValue}>{formatRupiah(used)}</Text>
                 </View>
               </View>

               <View style={styles.progressBg}>
                 <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: statusColor }]} />
               </View>
               
               <View style={styles.bFooter}>
                 <Text style={[styles.bStatus, { color: statusColor }]}>{statusText}</Text>
                 <Text style={styles.bPct}>{pct.toFixed(0)}%</Text>
               </View>
             </View>
           );
         })
        }
      </ScrollView>
      <Fab onPress={() => setShowForm(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  monthBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  list: { padding: spacing.lg, paddingBottom: 100 },
  budgetCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, ...shadow },
  bHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  bTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bCategory: { fontSize: 16, fontWeight: '700', color: colors.text },
  bStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  bStatLabel: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  bStatValue: { fontSize: 15, fontWeight: '600' },
  progressBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', borderRadius: 4 },
  bFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  bStatus: { fontSize: 11, fontWeight: '700' },
  bPct: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  
  formContainer: { padding: spacing.lg, paddingBottom: 100 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  backBtn: { padding: 4 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  formSubtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: spacing.sm, marginTop: spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryItem: {
    width: '23%', flexGrow: 1, maxWidth: '24%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'transparent', padding: spacing.xs,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: 'transparent' },
  currency: { fontSize: 22, fontWeight: '700', marginRight: spacing.sm, color: colors.text },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '800', paddingVertical: spacing.md, color: colors.text },
  inputError: { borderColor: colors.expense },
  error: { color: colors.expense, fontSize: 12, marginTop: spacing.xs },
  submitBtn: { marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' }
});
