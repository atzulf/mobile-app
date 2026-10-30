import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Category, CategoryService } from '../services/category.service';
import { Transaction, TransactionService } from '../services/transaction.service';
import { Budget, BudgetService } from '../services/budget.service';
import { NotificationService } from '../services/notification.service';
import { colors, getCategoryIcon, radius, shadow, spacing } from '../theme';
import { formatRupiah, formatThousands, getErrorMessage, toYMD, ymdToISO } from '../utils/format';
import { Loading } from '../components/ui/common';

const QUICK_AMOUNTS = [50_000, 100_000, 250_000, 500_000];

export default function TransferScreen() {
  const { sourceId: initialSourceId, targetId: initialTargetId } = useLocalSearchParams<{
    sourceId?: string;
    targetId?: string;
  }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [sourceId, setSourceId] = useState<string>(initialSourceId ?? '');
  const [targetId, setTargetId] = useState<string>(initialTargetId ?? '');
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(toYMD(new Date()));
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const now = new Date();
        const [cats, txList, budgetList] = await Promise.all([
          CategoryService.getAll().catch(() => [] as Category[]),
          TransactionService.getAll().catch(() => [] as Transaction[]),
          BudgetService.getAll(now.getMonth() + 1, now.getFullYear()).catch(() => [] as Budget[]),
        ]);
        setCategories(cats);
        setTransactions(txList);
        setBudgets(budgetList);

        if (!sourceId && cats.length > 0) {
          setSourceId(cats[0].id);
        }
        if (!targetId && cats.length > 1) {
          const second = cats.find((c) => c.id !== (initialSourceId || cats[0].id));
          if (second) setTargetId(second.id);
        }
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute real cumulative cash balances for all categories
  const walletBalances = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((cat) => {
      const catTxs = transactions.filter((t) => t.categoryId === cat.id);
      const inc = catTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const exp = catTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      map.set(cat.id, inc - exp);
    });
    return map;
  }, [categories, transactions]);

  // Overall main wallet balance
  const mainBalance = useMemo(() => {
    const inc = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    return inc - exp;
  }, [transactions]);

  const sourceWallet = categories.find((c) => c.id === sourceId);
  const targetWallet = categories.find((c) => c.id === targetId);

  const sourceBalance = sourceId ? walletBalances.get(sourceId) ?? 0 : 0;
  const targetBalance = targetId ? walletBalances.get(targetId) ?? 0 : 0;

  const amountNum = Number(amountStr ? amountStr.replace(/\D/g, '') : 0);

  // Available target categories (cannot transfer to the same wallet)
  const availableTargets = useMemo(() => {
    return categories.filter((c) => c.id !== sourceId);
  }, [categories, sourceId]);

  // Swap source and target
  const handleSwap = () => {
    if (!targetId) return;
    const prevSource = sourceId;
    setSourceId(targetId);
    setTargetId(prevSource);
  };

  const simulatedSourceAfter = sourceBalance - amountNum;
  const simulatedTargetAfter = targetBalance + amountNum;
  const isSourceExceeded = amountNum > sourceBalance && sourceBalance >= 0;

  const handleTransfer = async () => {
    if (!sourceId) {
      Alert.alert('Perhatian', 'Silakan pilih dompet asal terlebih dahulu.');
      return;
    }
    if (!targetId) {
      Alert.alert('Perhatian', 'Silakan pilih dompet tujuan terlebih dahulu.');
      return;
    }
    if (sourceId === targetId) {
      Alert.alert('Perhatian', 'Dompet asal dan dompet tujuan tidak boleh sama.');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal transfer yang valid.');
      return;
    }

    if (isSourceExceeded) {
      const confirmExceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Saldo Dompet Sumber Kurang',
          `Saldo dompet ${sourceWallet?.name} (${formatRupiah(sourceBalance)}) lebih kecil dari nominal transfer (${formatRupiah(amountNum)}). Dompet sumber akan mengalami defisit. Lanjutkan?`,
          [
            { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Tetap Transfer', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmExceed) return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await TransactionService.transfer({
        sourceCategoryId: sourceId,
        targetCategoryId: targetId,
        sourceCategoryName: sourceWallet?.name ?? 'Sumber',
        targetCategoryName: targetWallet?.name ?? 'Tujuan',
        amount: amountNum,
        description: description.trim() || undefined,
        transactionDate: ymdToISO(txDate),
      });

      // Evaluate smart alerts for source wallet after transfer out
      if (sourceWallet) {
        const sourceBudget = budgets.find((b) => b.categoryId === sourceId);
        const txDateObj = new Date(ymdToISO(txDate));
        const txMonth = txDateObj.getMonth();
        const txYear = txDateObj.getFullYear();

        const currentMonthExpense = transactions
          .filter((t) => {
            if (t.categoryId !== sourceId || t.type !== 'EXPENSE') return false;
            const d = new Date(t.transactionDate);
            return d.getMonth() === txMonth && d.getFullYear() === txYear;
          })
          .reduce((s, t) => s + t.amount, 0);
        const newMonthExpense = currentMonthExpense + amountNum;

        const currentTodayExpense = transactions
          .filter((t) => {
            if (t.categoryId !== sourceId || t.type !== 'EXPENSE') return false;
            return toYMD(new Date(t.transactionDate)) === txDate;
          })
          .reduce((s, t) => s + t.amount, 0);
        const newTodayExpense = currentTodayExpense + amountNum;

        const sourceIncome = transactions
          .filter((t) => t.categoryId === sourceId && t.type === 'INCOME')
          .reduce((s, t) => s + t.amount, 0);

        NotificationService.evaluateExpenseAlerts({
          categoryId: sourceId,
          categoryName: sourceWallet.name,
          budgetAmount: sourceBudget?.amount,
          monthExpense: newMonthExpense,
          todayExpense: newTodayExpense,
          realBalance: simulatedSourceAfter,
          cumulativeIncome: sourceIncome,
          date: txDateObj,
        }).catch(() => {});
      }

      // Reset low balance alert on target wallet since it received funds
      if (targetId) {
        NotificationService.resetLowBalanceAlert(targetId);
      }

      Alert.alert(
        'Transfer Berhasil',
        `Saldo ${formatRupiah(amountNum)} berhasil dipindahkan dari Dompet ${sourceWallet?.name} ke Dompet ${targetWallet?.name}.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      setError(getErrorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Transfer Antar Dompet',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
        }}
      />

      {loading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header Banner */}
          <View style={styles.banner}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="swap-horizontal" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Pindah Alokasi Saldo</Text>
              <Text style={styles.bannerSubtitle}>
                Pindahkan saldo antar dompet kecil dengan aman tanpa mengubah total uang di Dompet Utama.
              </Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.expense} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Visual Transfer Overview Card */}
          <View style={styles.visualFlowCard}>
            <View style={styles.visualNode}>
              <View style={[styles.visualIcon, { backgroundColor: colors.expenseTint }]}>
                <Ionicons
                  name={sourceWallet ? getCategoryIcon(sourceWallet.name, sourceWallet.icon) : 'wallet-outline'}
                  size={20}
                  color={colors.expense}
                />
              </View>
              <Text style={styles.visualLabel} numberOfLines={1}>
                {sourceWallet ? sourceWallet.name : 'Pilih Sumber'}
              </Text>
              <Text style={styles.visualBalance} numberOfLines={1}>
                {formatRupiah(sourceBalance)}
              </Text>
            </View>

            <Pressable onPress={handleSwap} style={styles.swapBtn} hitSlop={8} accessibilityLabel="Tukar posisi dompet">
              <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
            </Pressable>

            <View style={styles.visualNode}>
              <View style={[styles.visualIcon, { backgroundColor: colors.incomeTint }]}>
                <Ionicons
                  name={targetWallet ? getCategoryIcon(targetWallet.name, targetWallet.icon) : 'wallet-outline'}
                  size={20}
                  color={colors.income}
                />
              </View>
              <Text style={styles.visualLabel} numberOfLines={1}>
                {targetWallet ? targetWallet.name : 'Pilih Tujuan'}
              </Text>
              <Text style={styles.visualBalance} numberOfLines={1}>
                {formatRupiah(targetBalance)}
              </Text>
            </View>
          </View>

          {/* 1. Pilih Dompet Asal */}
          <Text style={styles.sectionHeading}>1. Pilih Dompet Asal (Sumber Dana)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalSelector}>
            {categories.map((cat) => {
              const active = cat.id === sourceId;
              const bal = walletBalances.get(cat.id) ?? 0;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setSourceId(cat.id);
                    if (targetId === cat.id) {
                      const other = categories.find((c) => c.id !== cat.id);
                      if (other) setTargetId(other.id);
                    }
                  }}
                  style={[styles.walletPill, active && styles.walletPillActiveSource]}
                >
                  <View style={[styles.walletPillIcon, active && { backgroundColor: colors.white }]}>
                    <Ionicons
                      name={getCategoryIcon(cat.name, cat.icon)}
                      size={16}
                      color={active ? colors.expense : colors.inkSecondary}
                    />
                  </View>
                  <View>
                    <Text style={[styles.walletPillName, active && { color: colors.white, fontWeight: '700' }]} numberOfLines={1}>
                      Dompet {cat.name}
                    </Text>
                    <Text style={[styles.walletPillBal, active && { color: colors.white }]}>
                      {bal < 0 ? `Defisit ${formatRupiah(Math.abs(bal))}` : formatRupiah(bal)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 2. Pilih Dompet Tujuan */}
          <Text style={styles.sectionHeading}>2. Pilih Dompet Tujuan (Penerima Dana)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalSelector}>
            {availableTargets.map((cat) => {
              const active = cat.id === targetId;
              const bal = walletBalances.get(cat.id) ?? 0;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setTargetId(cat.id)}
                  style={[styles.walletPill, active && styles.walletPillActiveTarget]}
                >
                  <View style={[styles.walletPillIcon, active && { backgroundColor: colors.white }]}>
                    <Ionicons
                      name={getCategoryIcon(cat.name, cat.icon)}
                      size={16}
                      color={active ? colors.income : colors.inkSecondary}
                    />
                  </View>
                  <View>
                    <Text style={[styles.walletPillName, active && { color: colors.white, fontWeight: '700' }]} numberOfLines={1}>
                      Dompet {cat.name}
                    </Text>
                    <Text style={[styles.walletPillBal, active && { color: colors.white }]}>
                      {bal < 0 ? `Defisit ${formatRupiah(Math.abs(bal))}` : formatRupiah(bal)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 3. Nominal Transfer */}
          <Text style={styles.sectionHeading}>3. Nominal Transfer</Text>
          <View style={styles.amountBox}>
            <Text style={styles.currencyPrefix}>Rp</Text>
            <TextInput
              value={formatThousands(amountStr)}
              onChangeText={(t) => setAmountStr(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.inkTertiary}
              style={styles.amountInput}
            />
          </View>

          {/* Quick Amount Chips */}
          <View style={styles.quickChipsRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setAmountStr(String(amt))}
                style={styles.quickChip}
                accessibilityRole="button"
              >
                <Text style={styles.quickChipText}>{formatRupiah(amt)}</Text>
              </Pressable>
            ))}
            {sourceBalance > 0 ? (
              <Pressable
                onPress={() => setAmountStr(String(Math.round(sourceBalance)))}
                style={[styles.quickChip, styles.quickChipFull]}
                accessibilityRole="button"
              >
                <Text style={styles.quickChipFullText}>Semua Saldo</Text>
              </Pressable>
            ) : null}
          </View>

          {/* 4. Tanggal & Catatan */}
          <View style={styles.metaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Tanggal Transfer</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
                <Ionicons name="calendar-outline" size={16} color={colors.blue500} />
                <Text style={styles.dateBtnText}>{txDate}</Text>
              </Pressable>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={new Date(txDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selected) => {
                setShowDatePicker(false);
                if (selected) setTxDate(toYMD(selected));
              }}
            />
          )}

          <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Catatan Mikro (Opsional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Contoh: Pindah sisa uang jajan ke tabungan"
            placeholderTextColor={colors.inkTertiary}
            style={styles.textInput}
          />

          {/* Live Impact Simulation Card */}
          <View style={styles.impactCard}>
            <View style={styles.impactTitleRow}>
              <Ionicons name="analytics-outline" size={16} color={colors.primary} />
              <Text style={styles.impactTitle}>Simulasi Dampak Kas:</Text>
            </View>

            <View style={styles.impactDetails}>
              {/* Source Simulation */}
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel} numberOfLines={1}>
                  Dompet {sourceWallet?.name ?? 'Sumber'}:
                </Text>
                <Text style={styles.impactValues}>
                  {formatRupiah(sourceBalance)} →{' '}
                  <Text style={{ fontWeight: '800', color: simulatedSourceAfter < 0 ? colors.expense : colors.ink }}>
                    {simulatedSourceAfter < 0
                      ? `Defisit ${formatRupiah(Math.abs(simulatedSourceAfter))}`
                      : formatRupiah(simulatedSourceAfter)}
                  </Text>
                </Text>
              </View>

              {/* Target Simulation */}
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel} numberOfLines={1}>
                  Dompet {targetWallet?.name ?? 'Tujuan'}:
                </Text>
                <Text style={styles.impactValues}>
                  {formatRupiah(targetBalance)} →{' '}
                  <Text style={{ fontWeight: '800', color: colors.income }}>
                    {formatRupiah(simulatedTargetAfter)}
                  </Text>
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Main Wallet (Dompet Utama) Status */}
              <View style={styles.impactRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.income} />
                  <Text style={[styles.impactLabel, { fontWeight: '700', color: colors.ink }]}>Dompet Utama:</Text>
                </View>
                <Text style={[styles.impactValues, { fontWeight: '800', color: colors.income }]}>
                  {formatRupiah(mainBalance)} (Tetap Utuh)
                </Text>
              </View>
            </View>

            <View style={styles.impactFooterNote}>
              <Text style={styles.impactFooterText}>
                Transfer internal ini tidak menambah maupun mengurangi total saldo di Dompet Utama.
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleTransfer}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              submitting && { opacity: 0.6 },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Konfirmasi transfer saldo"
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="swap-horizontal" size={18} color={colors.white} />
                <Text style={styles.submitBtnText}>
                  {amountNum > 0 ? `Transfer ${formatRupiah(amountNum)}` : 'Transfer Sekarang'}
                </Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.expenseTint,
    padding: spacing.md,
    borderRadius: radius.control,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: colors.expense,
    fontWeight: '600',
    flex: 1,
  },
  visualFlowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  visualNode: {
    flex: 1,
    alignItems: 'center',
  },
  visualIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  visualLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  visualBalance: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  horizontalSelector: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 140,
  },
  walletPillActiveSource: {
    backgroundColor: colors.expense,
    borderColor: colors.expense,
  },
  walletPillActiveTarget: {
    backgroundColor: colors.income,
    borderColor: colors.income,
  },
  walletPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletPillName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  walletPillBal: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    height: 60,
    marginBottom: spacing.sm,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  quickChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  quickChipFull: {
    backgroundColor: colors.sky100,
    borderColor: colors.blue500,
  },
  quickChipFullText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue500,
  },
  metaRow: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
    marginBottom: 6,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  dateBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 13,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  impactCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  impactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  impactTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  impactDetails: {
    gap: 6,
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: 12,
    color: colors.inkSecondary,
    flex: 1,
  },
  impactValues: {
    fontSize: 12,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
  impactFooterNote: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  impactFooterText: {
    fontSize: 11,
    color: colors.inkSecondary,
    lineHeight: 15,
  },
  submitBtn: {
    height: 52,
    borderRadius: radius.control,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.hero,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
