import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, LogBox } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { transactionSchema, TransactionFormValues } from '../schemas/transaction.schema';
import { TransactionService } from '../services/transaction.service';
import { Category, CategoryService } from '../services/category.service';
import { colors, getCategoryIcon, radius, spacing } from '../theme';
import { confirmAction, formatThousands, getErrorMessage, toYMD, ymdToISO } from '../utils/format';
import { Loading } from '../components/ui/common';

// Suppress react-native-chart-kit and SVG warnings on Web
if (Platform.OS === 'web') {
  LogBox.ignoreLogs(['Unknown event handler property `onPressIn`']);
}

export default function TransactionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [categories, setCategories] = useState<Category[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'EXPENSE',
      categoryId: '',
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
        const [cats, tx] = await Promise.all([
          CategoryService.getAll(),
          id ? TransactionService.getById(id) : Promise.resolve(null),
        ]);
        setCategories(cats);
        if (tx) {
          reset({
            type: tx.type,
            categoryId: tx.categoryId,
            amount: String(Math.round(tx.amount)),
            description: tx.description ?? '',
            transactionDate: toYMD(new Date(tx.transactionDate)),
          });
        }
      } catch (e) {
        setSubmitError(getErrorMessage(e));
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [id, reset]);

  const changeType = (t: 'INCOME' | 'EXPENSE') => {
    if (t === type) return;
    setValue('type', t);
    setValue('categoryId', ''); // categories differ per type
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
  const filteredCategories = categories.filter((c) => c.type === type);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEdit ? 'Edit Transaksi' : 'Tambah Transaksi' }} />
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

          {/* Amount */}
          <Text style={styles.label}>Nominal</Text>
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

          {/* Category */}
          <Text style={styles.label}>Kategori</Text>
          <View style={styles.categoryGrid}>
            {filteredCategories.map((c) => {
              const active = selectedCategory === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setValue('categoryId', c.id, { shouldValidate: true })}
                  style={[styles.categoryItem, active && { borderColor: accent, backgroundColor: type === 'INCOME' ? colors.incomeSoft : colors.expenseSoft }]}
                >
                  <Ionicons name={getCategoryIcon(c.name)} size={22} color={active ? accent : colors.muted} />
                  <Text style={[styles.categoryText, active && { color: accent }]} numberOfLines={1}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.categoryId && <Text style={styles.error}>{errors.categoryId.message}</Text>}

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
            onPress={handleSubmit(onSubmit)}
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
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: spacing.xl, marginBottom: spacing.sm },
  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: 'transparent' },
  currency: { fontSize: 22, fontWeight: '700', marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '800', paddingVertical: spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryItem: {
    width: '23%', flexGrow: 1, maxWidth: '24%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'transparent', padding: spacing.xs,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: colors.muted },
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
