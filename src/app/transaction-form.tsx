import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, LogBox } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { transactionSchema, TransactionFormValues } from '../schemas/transaction.schema';
import { Transaction, TransactionService } from '../services/transaction.service';
import { Category, CategoryService } from '../services/category.service';
import { Budget, BudgetService } from '../services/budget.service';
import { colors, getCategoryIcon, radius, spacing } from '../theme';
import { confirmAction, formatRupiah, formatThousands, getErrorMessage, getMonthRange, toYMD, ymdToISO } from '../utils/format';
import { Loading } from '../components/ui/common';

// Suppress react-native-chart-kit and SVG warnings on Web
if (Platform.OS === 'web') {
  LogBox.ignoreLogs(['Unknown event handler property `onPressIn`']);
}

export default function TransactionFormScreen() {
  const { id, categoryId: paramCategoryId, type: paramType } = useLocalSearchParams<{
    id?: string;
    categoryId?: string;
    type?: 'INCOME' | 'EXPENSE';
  }>();
  const isEdit = Boolean(id);

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const initialFormType = paramType ?? 'EXPENSE';

  const { control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: initialFormType,
      categoryId: paramCategoryId ?? '',
      amount: '',
      description: '',
      transactionDate: toYMD(new Date()),
    },
  });

  const type = watch('type');
  const selectedCategory = watch('categoryId');
  const dateValue = watch('transactionDate');

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const [cats, tx, txList, budgetList] = await Promise.all([
          CategoryService.getAll(),
          id ? TransactionService.getById(id) : Promise.resolve(null),
          TransactionService.getAll(getMonthRange(now)).catch(() => [] as Transaction[]),
          BudgetService.getAll(now.getMonth() + 1, now.getFullYear()).catch(() => [] as Budget[]),
        ]);
        setCategories(cats);
        setTransactions(txList);
        setBudgets(budgetList);
        if (tx) {
          reset({
            type: tx.type,
            categoryId: tx.categoryId,
            amount: String(Math.round(tx.amount)),
            description: tx.description ?? '',
            transactionDate: toYMD(new Date(tx.transactionDate)),
          });
        } else if (paramCategoryId) {
          setValue('categoryId', paramCategoryId, { shouldValidate: true });
          if (paramType) setValue('type', paramType);
        }
      } catch (e) {
        setSubmitError(getErrorMessage(e));
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [id, paramCategoryId, paramType, reset, setValue]);

  const changeType = (t: 'INCOME' | 'EXPENSE') => {
    if (t === type) return;
    setValue('type', t);
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);
    const payload = {
      type: values.type,
      categoryId: values.categoryId,
      amount: Number(values.amount),
      description: values.description?.trim() || undefined,
      transactionDate: ymdToISO(values.transactionDate),
    };
    try {
      if (isEdit && id) await TransactionService.update(id, payload);
      else await TransactionService.create(payload);
      router.back();
    } catch (e) {
      setSubmitError(getErrorMessage(e));
    }
  };

  const onDelete = async () => {
    if (!id) return;
    const ok = await confirmAction('Hapus transaksi?', 'Transaksi yang dihapus tidak dapat dikembalikan.');
    if (!ok) return;
    try {
      setDeleting(true);
      await TransactionService.delete(id);
      router.back();
    } catch (e) {
      setSubmitError(getErrorMessage(e));
      setDeleting(false);
    }
  };

  const today = toYMD(new Date());
  const yesterday = toYMD(new Date(Date.now() - 86_400_000));
  const accent = type === 'INCOME' ? colors.income : colors.expense;
  const filteredCategories = categories;
  const amountVal = watch('amount');
  const amountNum = Number(amountVal ? String(amountVal).replace(/\D/g, '') : 0);

  // Dompet balances calculation
  const mainIncome = useMemo(() => {
    return transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  }, [transactions]);

  const mainExpense = useMemo(() => {
    return transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  }, [transactions]);

  const mainBalance = mainIncome - mainExpense;

  const walletBalances = useMemo(() => {
    const map = new Map<string, { sisa: number; hasBudget: boolean; budgetAmount: number; name: string }>();
    categories.forEach((cat) => {
      const catTxs = transactions.filter((t) => t.categoryId === cat.id);
      const catIncome = catTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const catExpense = catTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      const catBudget = budgets.find((b) => b.categoryId === cat.id);
      const budgetAmount = catBudget?.amount ?? 0;
      const hasBudget = Boolean(catBudget && catBudget.amount > 0);
      const sisa = hasBudget ? budgetAmount + catIncome - catExpense : catIncome - catExpense;
      map.set(cat.id, { sisa, hasBudget, budgetAmount, name: cat.name });
    });
    return map;
  }, [categories, transactions, budgets]);

  const selectedWallet = selectedCategory ? walletBalances.get(selectedCategory) : null;
  const selectedWalletName = selectedWallet?.name ?? categories.find((c) => c.id === selectedCategory)?.name ?? '';
  const currentWalletSisa = selectedWallet?.sisa ?? 0;

  const simulatedWalletAfter = type === 'EXPENSE'
    ? currentWalletSisa - amountNum
    : currentWalletSisa + amountNum;

  const simulatedMainAfter = type === 'EXPENSE'
    ? mainBalance - amountNum
    : mainBalance + amountNum;

  const isWalletDeficit = type === 'EXPENSE' && amountNum > currentWalletSisa;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEdit ? 'Edit Transaksi Dompet' : 'Catat Transaksi Dompet' }} />
      {initialLoading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Type segmented control */}
          <View style={styles.segment}>
            {(['EXPENSE', 'INCOME'] as const).map((t) => {
              const active = type === t;
              const c = t === 'INCOME' ? colors.income : colors.expense;
              return (
                <Pressable key={t} onPress={() => changeType(t)} style={[styles.segmentBtn, active && { backgroundColor: c }]}>
                  <Ionicons name={t === 'INCOME' ? 'arrow-down' : 'arrow-up'} size={16} color={active ? colors.white : colors.muted} />
                  <Text style={[styles.segmentText, active && { color: colors.white }]}>
                    {t === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Saldo Dompet Utama Info Card */}
          <View style={styles.mainWalletCard}>
            <View style={styles.mainWalletHeader}>
              <View style={styles.mainWalletIconWrap}>
                <Ionicons name="wallet-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mainWalletTitle}>Saldo Dompet Utama Saat Ini</Text>
                <Text style={styles.mainWalletSubtitle}>Total kas keseluruhan akun</Text>
              </View>
              <View style={styles.mainWalletRight}>
                <Text style={styles.mainWalletAmount}>{formatRupiah(mainBalance)}</Text>
                {amountNum > 0 && (
                  <Text style={[styles.mainWalletDiff, { color: type === 'INCOME' ? colors.income : colors.expense }]}>
                    {type === 'INCOME' ? '+' : '-'}{formatRupiah(amountNum)} ({formatRupiah(simulatedMainAfter)})
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Amount */}
          <Text style={styles.label}>Nominal Transaksi</Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { value, onChange } }) => (
              <View style={[styles.amountBox, errors.amount && styles.inputError]}>
                <Text style={[styles.currency, { color: accent }]}>Rp</Text>
                <TextInput
                  value={formatThousands(value)}
                  onChangeText={(t) => onChange(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.border}
                  style={[styles.amountInput, { color: accent }]}
                />
              </View>
            )}
          />
          {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}

          {/* Dompet Selection */}
          <Text style={styles.label}>
            {type === 'EXPENSE' ? 'Pilih Dompet Sumber (Belanja dari mana?)' : 'Pilih Dompet Tujuan (Uang masuk ke mana?)'}
          </Text>
          <Text style={styles.dompetHelpText}>
            Setiap dompet menampilkan sisa saldo real-time. Transaksi akan menyinkronkan saldo dompet dan Dompet Utama.
          </Text>
          <View style={styles.categoryGrid}>
            {filteredCategories.map((c) => {
              const active = selectedCategory === c.id;
              const bal = walletBalances.get(c.id);
              const sisaNominal = bal?.sisa ?? 0;
              const isNegative = sisaNominal < 0;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setValue('categoryId', c.id, { shouldValidate: true })}
                  style={[
                    styles.categoryItem,
                    active && {
                      borderColor: accent,
                      backgroundColor: type === 'INCOME' ? colors.incomeSoft : colors.expenseSoft,
                    },
                  ]}
                >
                  <View style={[styles.categoryIconWrap, active && { backgroundColor: colors.white }]}>
                    <Ionicons name={getCategoryIcon(c.name)} size={18} color={active ? accent : colors.muted} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryText, active && { color: accent, fontWeight: '700' }]} numberOfLines={1}>
                      Dompet {c.name}
                    </Text>
                    <Text
                      style={[
                        styles.categorySisa,
                        active ? { color: accent } : isNegative ? { color: colors.expense } : undefined,
                      ]}
                      numberOfLines={1}
                    >
                      Sisa: {formatRupiah(sisaNominal)}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={16} color={accent} style={styles.checkIcon} />
                  )}
                </Pressable>
              );
            })}
          </View>
          {errors.categoryId && <Text style={styles.error}>{errors.categoryId.message}</Text>}

          {/* Live Impact & Synchronization Card */}
          {selectedCategory ? (
            <View style={styles.impactCard}>
              <View style={styles.impactHeader}>
                <Ionicons name="swap-horizontal" size={16} color={colors.blue500} />
                <Text style={styles.impactTitle}>Simulasi & Dampak Saldo:</Text>
              </View>
              <View style={styles.impactRow}>
                <View style={styles.impactCol}>
                  <Text style={styles.impactColName} numberOfLines={1}>
                    Dompet {selectedWalletName}
                  </Text>
                  <Text style={styles.impactBalanceBefore}>
                    Sisa awal: <Text style={styles.impactBold}>{formatRupiah(currentWalletSisa)}</Text>
                  </Text>
                  {amountNum > 0 ? (
                    <>
                      <Text style={[styles.impactColVal, { color: accent }]}>
                        {type === 'EXPENSE' ? '-' : '+'}{formatRupiah(amountNum)}
                      </Text>
                      <Text style={styles.impactBalanceAfter}>
                        Estimasi sisa: <Text style={{ color: simulatedWalletAfter < 0 ? colors.expense : accent, fontWeight: '800' }}>{formatRupiah(simulatedWalletAfter)}</Text>
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.impactColSub}>
                      {type === 'EXPENSE' ? 'Pilih nominal untuk simulasi belanja' : 'Pilih nominal untuk simulasi uang masuk'}
                    </Text>
                  )}
                </View>
                <View style={styles.impactDivider} />
                <View style={styles.impactCol}>
                  <Text style={styles.impactColName}>Dompet Utama</Text>
                  <Text style={styles.impactBalanceBefore}>
                    Saldo awal: <Text style={styles.impactBold}>{formatRupiah(mainBalance)}</Text>
                  </Text>
                  {amountNum > 0 ? (
                    <>
                      <Text style={[styles.impactColVal, { color: accent }]}>
                        {type === 'EXPENSE' ? '-' : '+'}{formatRupiah(amountNum)}
                      </Text>
                      <Text style={styles.impactBalanceAfter}>
                        Estimasi saldo: <Text style={{ color: simulatedMainAfter < 0 ? colors.expense : colors.ink, fontWeight: '800' }}>{formatRupiah(simulatedMainAfter)}</Text>
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.impactColSub}>
                      {type === 'EXPENSE' ? 'Kas utama akan berkurang sesuai nominal' : 'Kas utama akan bertambah sesuai nominal'}
                    </Text>
                  )}
                </View>
              </View>

              {isWalletDeficit && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={15} color={colors.expense} />
                  <Text style={styles.warningText}>
                    Nominal belanja melebihi sisa Dompet {selectedWalletName} ({formatRupiah(currentWalletSisa)}). Saldo dompet kecil ini akan menjadi minus.
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Date */}
          <Text style={styles.label}>Tanggal</Text>
          <View style={styles.dateChips}>
            {[{ label: 'Hari ini', v: today }, { label: 'Kemarin', v: yesterday }].map((d) => (
              <Pressable
                key={d.v}
                onPress={() => setValue('transactionDate', d.v, { shouldValidate: true })}
                style={[styles.dateChip, dateValue === d.v && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.dateChipText, dateValue === d.v && { color: colors.white }]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
          <Controller
            control={control}
            name="transactionDate"
            render={({ field: { value, onChange } }) => (
              <>
                <Pressable
                  onPress={() => Platform.OS !== 'web' && setShowDatePicker(true)}
                  style={[styles.inputRow, errors.transactionDate && styles.inputError, { paddingVertical: Platform.OS === 'web' ? 0 : 14 }]}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.muted} />
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, padding: '14px 0', color: colors.text, fontFamily: 'inherit' }}
                    />
                  ) : (
                    <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{value}</Text>
                  )}
                </Pressable>
                
                {Platform.OS !== 'web' && showDatePicker && (
                  <DateTimePicker
                    value={new Date(value)}
                    mode="date"
                    display="default"
                    onChange={(_, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) onChange(toYMD(selectedDate));
                    }}
                  />
                )}
              </>
            )}
          />
          {errors.transactionDate && <Text style={styles.error}>{errors.transactionDate.message}</Text>}

          {/* Description */}
          <Text style={styles.label}>Catatan (opsional)</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <View style={[styles.inputRow, errors.description && styles.inputError]}>
                <Ionicons name="create-outline" size={18} color={colors.muted} />
                <TextInput value={value} onChangeText={onChange} placeholder="Contoh: Makan siang" style={styles.input} maxLength={100} />
              </View>
            )}
          />
          {errors.description && <Text style={styles.error}>{errors.description.message}</Text>}

          {submitError && (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={18} color={colors.expense} />
              <Text style={styles.submitErrorText}>{submitError}</Text>
            </View>
          )}

          {/* Actions */}
          <Pressable
            onPress={() => handleSubmit(onSubmit)()}
            disabled={isSubmitting || deleting}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: accent }, (pressed || isSubmitting) && { opacity: 0.8 }]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>{isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</Text>}
          </Pressable>

          {isEdit && (
            <Pressable onPress={onDelete} disabled={deleting || isSubmitting} style={styles.deleteBtn}>
              {deleting ? <ActivityIndicator color={colors.expense} /> : (
                <>
                  <Ionicons name="trash-outline" size={18} color={colors.expense} />
                  <Text style={styles.deleteText}>Hapus Transaksi</Text>
                </>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radius.sm },
  segmentText: { fontWeight: '700', color: colors.muted },

  // Dompet Utama Card
  mainWalletCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainWalletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mainWalletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainWalletTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  mainWalletSubtitle: {
    fontSize: 11,
    color: colors.inkTertiary,
    marginTop: 1,
  },
  mainWalletRight: {
    alignItems: 'flex-end',
  },
  mainWalletAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  mainWalletDiff: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: spacing.xl, marginBottom: spacing.xs },
  dompetHelpText: { fontSize: 11, color: colors.inkTertiary, marginBottom: spacing.sm },
  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: 'transparent' },
  currency: { fontSize: 22, fontWeight: '700', marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '800', paddingVertical: spacing.md },

  // Category Grid & Items
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryItem: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.xs,
    minHeight: 52,
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  categorySisa: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSecondary,
    marginTop: 2,
  },
  checkIcon: {
    marginLeft: 2,
  },

  // Real-Time Impact & Sync Card
  impactCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  impactTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue500,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  impactCol: {
    flex: 1,
  },
  impactColName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  impactBalanceBefore: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginBottom: 4,
  },
  impactBold: {
    fontWeight: '700',
    color: colors.ink,
  },
  impactColVal: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  impactBalanceAfter: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  impactColSub: {
    fontSize: 10,
    color: colors.inkTertiary,
    marginTop: 2,
  },
  impactDivider: {
    width: 1,
    height: 54,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.expenseSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.expense,
  },

  dateChips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dateChip: { paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  dateChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: 'transparent' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text },
  inputError: { borderColor: colors.expense },
  error: { color: colors.expense, fontSize: 12, marginTop: spacing.xs },
  submitError: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.expenseSoft, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.xl },
  submitErrorText: { color: colors.expense, flex: 1, fontSize: 13 },
  primaryBtn: { marginTop: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.md },
  deleteText: { color: colors.expense, fontWeight: '600' },
});
