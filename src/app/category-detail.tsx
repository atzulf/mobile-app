import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Category, CategoryService } from '../services/category.service';
import { Transaction, TransactionService } from '../services/transaction.service';
import { Budget, BudgetService } from '../services/budget.service';
import { NotificationService } from '../services/notification.service';
import { colors, getCategoryIcon, radius, shadow, spacing } from '../theme';
import {
  confirmAction,
  formatDateLong,
  formatMonth,
  formatRupiah,
  formatThousands,
  getErrorMessage,
  getMonthRange,
  toYMD,
  ymdToISO,
} from '../utils/format';
import { EmptyState, ErrorState, Loading } from '../components/ui/common';

type FilterType = 'ALL' | 'EXPENSE' | 'INCOME';

export default function CategoryDetailScreen() {
  const {
    categoryId,
    categoryName: initialName,
    month: paramMonth,
    year: paramYear,
  } = useLocalSearchParams<{
    categoryId: string;
    categoryName?: string;
    month?: string;
    year?: string;
  }>();

  const [date, setDate] = useState(() => {
    const now = new Date();
    const m = paramMonth ? parseInt(paramMonth, 10) - 1 : now.getMonth();
    const y = paramYear ? parseInt(paramYear, 10) : now.getFullYear();
    return new Date(y, m, 1);
  });

  const [category, setCategory] = useState<Category | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allCategoryTransactions, setAllCategoryTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search inside category
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amountInput, setAmountInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [txDate, setTxDate] = useState(toYMD(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Budget Edit Modal state
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetAmountInput, setBudgetAmountInput] = useState('');
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // Rename Wallet Modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!categoryId) return;
    try {
      setError(null);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();

      // Fetch all required data concurrently
      const [allCats, allTxs, monthBudgets] = await Promise.all([
        CategoryService.getAll().catch(() => [] as Category[]),
        TransactionService.getAll().catch(() => [] as Transaction[]),
        BudgetService.getAll(m, y).catch(() => [] as Budget[]),
      ]);

      const foundCat = allCats.find((c) => c.id === categoryId) || null;
      setCategory(foundCat);

      // Filter all-time transactions for this category
      const catAllTxs = allTxs.filter((t) => t.categoryId === categoryId);
      setAllCategoryTransactions(catAllTxs);

      // Filter month transactions for the selected month view
      const selMonth = date.getMonth();
      const selYear = date.getFullYear();
      const catMonthTxs = catAllTxs.filter((t) => {
        const d = new Date(t.transactionDate);
        return d.getMonth() === selMonth && d.getFullYear() === selYear;
      });
      setTransactions(catMonthTxs);

      const foundBudget = monthBudgets.find((b) => b.categoryId === categoryId) || null;
      setBudget(foundBudget);
      if (foundBudget) {
        setBudgetAmountInput(String(Math.round(foundBudget.amount)));
      } else {
        setBudgetAmountInput('');
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, date]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const shiftMonth = (delta: number) => {
    setLoading(true);
    setDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  // Calculations for current selected month
  const totalExpense = useMemo(
    () => transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    [transactions],
  );

  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
    [transactions],
  );

  // Cumulative all-time calculations for true wallet balance (sync with Dompet Utama)
  const cumulativeExpense = useMemo(
    () => allCategoryTransactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    [allCategoryTransactions],
  );

  const cumulativeIncome = useMemo(
    () => allCategoryTransactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
    [allCategoryTransactions],
  );

  const budgetAmount = budget?.amount ?? 0;
  const hasBudget = Boolean(budget && budget.amount > 0);

  // Saldo riil kas dompet kumulatif: murni total uang masuk dikurangi belanja agar sinkron dengan Dompet Utama
  const realBalance = cumulativeIncome - cumulativeExpense;

  // Percentage used calculation (dari plafon belanja bulanan)
  const usedPercentage = hasBudget && budgetAmount > 0
    ? Math.min(100, Math.round((totalExpense / budgetAmount) * 100))
    : 0;
  const isOverBudget = hasBudget ? totalExpense > budgetAmount : realBalance < 0;
  const isWarning = hasBudget && usedPercentage >= 80 && !isOverBudget;

  const statusColor = isOverBudget
    ? colors.expense
    : isWarning
    ? colors.warning
    : colors.income;

  const statusLabel = isOverBudget
    ? 'Melebihi Anggaran'
    : isWarning
    ? 'Mendekati Batas'
    : hasBudget || totalIncome > 0
    ? 'Aman'
    : 'Belum Ada Budget';

  // Filtered transactions for the list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'ALL' && t.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const desc = (t.description || '').toLowerCase();
        return desc.includes(q);
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  const openQuickAdd = (type: 'EXPENSE' | 'INCOME') => {
    setModalType(type);
    setAmountInput('');
    setDescInput('');
    setTxDate(toYMD(new Date()));
    setModalError(null);
    setModalVisible(true);
  };

  const handleSaveQuickAdd = async () => {
    const cleanAmount = Number(amountInput.replace(/\D/g, ''));
    if (!cleanAmount || cleanAmount <= 0) {
      setModalError('Masukkan nominal yang valid');
      return;
    }
    if (!categoryId) return;

    setModalSubmitting(true);
    setModalError(null);
    try {
      await TransactionService.create({
        categoryId,
        type: modalType,
        amount: cleanAmount,
        description: descInput.trim() || undefined,
        transactionDate: ymdToISO(txDate),
      });

      // Evaluate smart alerts for expense or reset on income
      if (modalType === 'EXPENSE') {
        const txDateObj = new Date(ymdToISO(txDate));
        const newMonthExpense = totalExpense + cleanAmount;
        const todayTxsExpense = transactions
          .filter((t) => t.type === 'EXPENSE' && toYMD(new Date(t.transactionDate)) === txDate)
          .reduce((s, t) => s + t.amount, 0);
        const newTodayExpense = todayTxsExpense + cleanAmount;
        const newRealBalance = realBalance - cleanAmount;

        NotificationService.evaluateExpenseAlerts({
          categoryId,
          categoryName: category?.name || displayName,
          budgetAmount: budget?.amount,
          monthExpense: newMonthExpense,
          todayExpense: newTodayExpense,
          realBalance: newRealBalance,
          cumulativeIncome,
          date: txDateObj,
        }).catch(() => {});
      } else if (modalType === 'INCOME') {
        NotificationService.resetLowBalanceAlert(categoryId);
      }

      setModalVisible(false);
      setLoading(true);
      await loadData();
    } catch (e) {
      setModalError(getErrorMessage(e));
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleRemoveBudget = async () => {
    if (!budget) {
      setBudgetModalVisible(false);
      return;
    }
    setBudgetSubmitting(true);
    setBudgetError(null);
    try {
      await BudgetService.delete(budget.id).catch(() => {});
      setBudgetModalVisible(false);
      setLoading(true);
      await loadData();
    } catch (e) {
      setBudgetError(getErrorMessage(e));
    } finally {
      setBudgetSubmitting(false);
    }
  };

  const handleSaveBudget = async () => {
    const cleanAmount = Number(budgetAmountInput.replace(/\D/g, ''));
    if (!categoryId) return;

    setBudgetSubmitting(true);
    setBudgetError(null);
    try {
      if (cleanAmount <= 0) {
        // Jika nominal diset 0 atau dikosongkan, hilangkan plafon anggaran yang aktif
        if (budget) {
          await BudgetService.delete(budget.id).catch(() => {});
        }
      } else {
        if (budget) {
          // Hapus entri lama lalu simpan plafon baru
          await BudgetService.delete(budget.id).catch(() => {});
        }
        await BudgetService.create({
          categoryId,
          amount: cleanAmount,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });
      }
      setBudgetModalVisible(false);
      setLoading(true);
      await loadData();
    } catch (e) {
      setBudgetError(getErrorMessage(e));
    } finally {
      setBudgetSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const ok = await confirmAction('Hapus transaksi mikro?', 'Catatan ini akan dihapus dari pos dan total aplikasi.');
    if (!ok) return;
    try {
      setLoading(true);
      await TransactionService.delete(id);
      await loadData();
    } catch (e) {
      Alert.alert('Gagal', getErrorMessage(e));
      setLoading(false);
    }
  };

  const handleSaveRename = async () => {
    const clean = renameInput.trim();
    if (!clean) {
      setRenameError('Nama dompet tidak boleh kosong');
      return;
    }
    if (!categoryId) return;
    setRenameSubmitting(true);
    setRenameError(null);
    try {
      await CategoryService.update(categoryId, { name: clean });
      setRenameModalVisible(false);
      await loadData();
    } catch (e) {
      setRenameError(getErrorMessage(e));
    } finally {
      setRenameSubmitting(false);
    }
  };

  const displayName = category?.name || initialName || 'Pos Kategori';
  const iconName = getCategoryIcon(displayName, category?.icon);

  const handleDeleteCategory = async () => {
    if (!categoryId) return;
    const ok = await confirmAction(
      'Hapus Dompet Ini?',
      `Dompet "${displayName}" beserta seluruh catatan transaksi dan pengaturan plafonnya akan dihapus.`,
    );
    if (!ok) return;

    try {
      setLoading(true);
      await CategoryService.delete(categoryId);
      router.back();
    } catch (e) {
      Alert.alert('Gagal Menghapus', getErrorMessage(e));
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Dompet ${displayName}`,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTitleStyle: { color: colors.ink, fontWeight: '700' },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleDeleteCategory}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Hapus dompet"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.expense} />
            </Pressable>
          ),
        }}
      />

      {/* Month Navigation */}
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          style={styles.monthBtn}
          accessibilityRole="button"
          accessibilityLabel="Bulan sebelumnya"
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.monthCenter}>
          <Text style={styles.monthLabel}>{formatMonth(date)}</Text>
          <Text style={styles.monthSub}>Dompet Kecil Kategori</Text>
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          style={styles.monthBtn}
          accessibilityRole="button"
          accessibilityLabel="Bulan berikutnya"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {loading && !refreshing ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} />
        ) : (
          <>
            {/* Pos Card: Sisa Saldo & Ringkasan Induk */}
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name={iconName} size={24} color={colors.blue500} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.heroCategoryName}>Dompet {displayName}</Text>
                    <Pressable
                      onPress={() => {
                        setRenameInput(category?.name || initialName || '');
                        setRenameError(null);
                        setRenameModalVisible(true);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Ubah nama dompet"
                    >
                      <Ionicons name="pencil" size={15} color={colors.primary} />
                    </Pressable>
                  </View>
                  <Text style={styles.heroSubtitle}>Dompet Kecil Terhubung</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              {/* Connected Banner */}
              <View style={styles.connectionBanner}>
                <Ionicons name="link" size={13} color={colors.blue500} />
                <Text style={styles.connectionBannerText}>
                  Terhubung ke Dompet Utama: Semua transaksi otomatis terhitung di saldo induk.
                </Text>
              </View>

              {/* Sisa Saldo / Kuota Plafon Amount */}
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceCaption}>
                  {hasBudget ? 'Sisa Plafon Anggaran Bulan Ini' : 'Sisa Saldo Dompet'}
                </Text>
                {hasBudget ? (
                  totalExpense > budgetAmount ? (
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.balanceAmount,
                          { color: colors.expense, fontSize: 18, lineHeight: 24, textAlign: 'center' },
                        ]}
                      >
                        Melebihi budget target awal
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.expense, fontWeight: '600', marginTop: 4 }}>
                        Lebih {formatRupiah(totalExpense - budgetAmount)}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.balanceAmount,
                        { color: colors.ink },
                      ]}
                    >
                      {formatRupiah(budgetAmount - totalExpense)}
                    </Text>
                  )
                ) : realBalance < 0 ? (
                  <View style={{ alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.balanceAmount,
                        { color: colors.expense, fontSize: 18, lineHeight: 24, textAlign: 'center' },
                      ]}
                    >
                      Melebihi budget target awal
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.expense, fontWeight: '600', marginTop: 4 }}>
                      Lebih {formatRupiah(Math.abs(realBalance))}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.balanceAmount,
                      { color: colors.ink },
                    ]}
                  >
                    {formatRupiah(realBalance)}
                  </Text>
                )}
              </View>

              {/* Progress Bar (if budget exists) */}
              {hasBudget && budgetAmount > 0 ? (
                <View style={styles.progressSection}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Math.max(0, usedPercentage))}%`,
                          backgroundColor: statusColor,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressText}>
                      Terpakai: {usedPercentage}% dari {formatRupiah(budgetAmount)}
                    </Text>
                    <Text style={[styles.progressText, { color: statusColor, fontWeight: '700' }]}>
                      {isOverBudget ? 'Melebihi Batas' : 'Tersedia'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Visual Calculation Formula Card */}
              <View style={styles.formulaCard}>
                <Text style={styles.formulaTitle}>
                  {hasBudget ? 'Alur Kuota Plafon Bulan Ini:' : 'Alur Saldo Kas Dompet:'}
                </Text>
                {hasBudget ? (
                  <View style={styles.formulaRow}>
                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemLabel}>Plafon Target</Text>
                      <Text style={styles.formulaItemValue} numberOfLines={1}>{formatRupiah(budgetAmount)}</Text>
                    </View>
                    <Text style={styles.formulaOp}>−</Text>
                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemLabel}>Belanja</Text>
                      <Text style={[styles.formulaItemValue, { color: colors.expense }]} numberOfLines={1}>
                        −{formatRupiah(totalExpense)}
                      </Text>
                    </View>
                    <Text style={styles.formulaOp}>=</Text>
                    <View style={[styles.formulaItem, styles.formulaResultItem]}>
                      <Text style={styles.formulaItemLabel}>Sisa Kuota</Text>
                      <Text
                        style={[
                          styles.formulaItemValue,
                          { fontWeight: '800', color: totalExpense <= budgetAmount ? colors.ink : colors.expense },
                        ]}
                        numberOfLines={1}
                      >
                        {totalExpense > budgetAmount
                          ? `Lebih ${formatRupiah(totalExpense - budgetAmount)}`
                          : formatRupiah(budgetAmount - totalExpense)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.formulaRow}>
                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemLabel}>Total Masuk</Text>
                      <Text style={[styles.formulaItemValue, { color: colors.income }]} numberOfLines={1}>
                        +{formatRupiah(cumulativeIncome)}
                      </Text>
                    </View>
                    <Text style={styles.formulaOp}>−</Text>
                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemLabel}>Total Belanja</Text>
                      <Text style={[styles.formulaItemValue, { color: colors.expense }]} numberOfLines={1}>
                        −{formatRupiah(cumulativeExpense)}
                      </Text>
                    </View>
                    <Text style={styles.formulaOp}>=</Text>
                    <View style={[styles.formulaItem, styles.formulaResultItem]}>
                      <Text style={styles.formulaItemLabel}>Saldo Kas</Text>
                      <Text
                        style={[
                          styles.formulaItemValue,
                          { fontWeight: '800', color: realBalance >= 0 ? colors.ink : colors.expense },
                        ]}
                        numberOfLines={1}
                      >
                        {realBalance < 0
                          ? `Lebih ${formatRupiah(Math.abs(realBalance))}`
                          : formatRupiah(realBalance)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Breakdown Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>Plafon Anggaran</Text>
                  <Text style={styles.statValue}>
                    {hasBudget ? formatRupiah(budgetAmount) : 'Rp 0 (Bebas)'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setBudgetError(null);
                      setBudgetModalVisible(true);
                    }}
                    style={styles.editBudgetBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Atur budget plafon"
                  >
                    <Text style={styles.editBudgetBtnText}>
                      {hasBudget ? 'Ubah Plafon' : '+ Set Plafon'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>Saldo Riil Kas</Text>
                  <Text style={[styles.statValue, { color: realBalance >= 0 ? colors.ink : colors.expense }]}>
                    {realBalance >= 0 ? formatRupiah(realBalance) : `Defisit ${formatRupiah(Math.abs(realBalance))}`}
                  </Text>
                  <Text style={styles.statSub}>
                    {cumulativeIncome > 0 ? `+${formatRupiah(cumulativeIncome)} total masuk` : 'Belum ada top-up'}
                  </Text>
                </View>

                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>Belanja Bulan Ini</Text>
                  <Text style={[styles.statValue, { color: colors.expense }]}>
                    −{formatRupiah(totalExpense)}
                  </Text>
                  <Text style={styles.statSub}>
                    {transactions.filter((t) => t.type === 'EXPENSE').length} transaksi
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Micro-Logging Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => openQuickAdd('EXPENSE')}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.expenseActionBtn,
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Catat belanja dari dompet"
              >
                <Ionicons name="arrow-up-circle" size={18} color={colors.white} />
                <Text style={styles.actionBtnText}>Belanja</Text>
              </Pressable>

              <Pressable
                onPress={() => openQuickAdd('INCOME')}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.incomeActionBtn,
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Isi saldo dompet"
              >
                <Ionicons name="arrow-down-circle" size={18} color={colors.white} />
                <Text style={styles.actionBtnText}>Isi Saldo</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push({ pathname: '/transfer', params: { sourceId: categoryId } })}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.transferActionBtn,
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pindah saldo ke dompet lain"
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.white} />
                <Text style={styles.actionBtnText}>Pindah</Text>
              </Pressable>
            </View>

            {/* Micro Transactions List Header */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Riwayat Transaksi Dompet</Text>
                <Text style={styles.sectionSubtitle}>
                  Otomatis terhitung di Dompet Utama
                </Text>
              </View>
              <Text style={styles.txCountBadge}>{filteredTransactions.length} transaksi</Text>
            </View>

            {/* Type Filters & Search */}
            <View style={styles.filterBar}>
              {(['ALL', 'EXPENSE', 'INCOME'] as const).map((ft) => {
                const active = filterType === ft;
                const label = ft === 'ALL' ? 'Semua' : ft === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan';
                return (
                  <Pressable
                    key={ft}
                    onPress={() => setFilterType(ft)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.inkTertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari catatan mikro (misal: kemeja, bensin)..."
                placeholderTextColor={colors.inkTertiary}
                style={styles.searchInput}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.inkTertiary} />
                </Pressable>
              ) : null}
            </View>

            {/* Transactions Ledger */}
            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="Belum ada catatan"
                message={
                  transactions.length === 0
                    ? `Mulai catat transaksi mikro untuk ${displayName} di bulan ${formatMonth(date)}.`
                    : 'Tidak ada transaksi yang cocok dengan filter atau kata kunci.'
                }
              />
            ) : (
              <View style={styles.transactionsCard}>
                {filteredTransactions.map((tx, idx) => {
                  const isInc = tx.type === 'INCOME';
                  const dateStr = formatDateLong(tx.transactionDate);
                  const isLast = idx === filteredTransactions.length - 1;

                  return (
                    <View
                      key={tx.id}
                      style={[styles.txItem, !isLast && styles.txItemBorder]}
                    >
                      <View
                        style={[
                          styles.txIconWrap,
                          { backgroundColor: isInc ? colors.incomeTint : colors.expenseTint },
                        ]}
                      >
                        <Ionicons
                          name={isInc ? 'arrow-down-circle' : 'arrow-up-circle'}
                          size={20}
                          color={isInc ? colors.income : colors.expense}
                        />
                      </View>

                      <View style={styles.txInfo}>
                        <Text style={styles.txDesc} numberOfLines={1}>
                          {tx.description || `${displayName} (${isInc ? 'Pemasukan' : 'Pengeluaran'})`}
                        </Text>
                        <Text style={styles.txDate}>{dateStr}</Text>
                      </View>

                      <View style={styles.txRight}>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: isInc ? colors.income : colors.ink },
                          ]}
                        >
                          {isInc ? '+' : '−'}{formatRupiah(tx.amount)}
                        </Text>
                        <View style={styles.txActions}>
                          <Pressable
                            onPress={() =>
                              router.push({
                                pathname: '/transaction-form',
                                params: { id: tx.id },
                              })
                            }
                            style={styles.txActionBtn}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="Edit catatan"
                          >
                            <Ionicons name="pencil-outline" size={16} color={colors.inkSecondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteTransaction(tx.id)}
                            style={styles.txActionBtn}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="Hapus catatan"
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.expense} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Quick Add Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {modalType === 'EXPENSE' ? 'Catat Pengeluaran Mikro' : 'Tambah Alokasi Pos'}
                </Text>
                <Text style={styles.sheetSubtitle}>Pos: {displayName}</Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.sheetCloseBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal"
              >
                <Ionicons name="close" size={22} color={colors.inkSecondary} />
              </Pressable>
            </View>

            {modalError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.expense} />
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            {/* Type selector toggle */}
            <View style={styles.modalTypeToggle}>
              {(['EXPENSE', 'INCOME'] as const).map((t) => {
                const active = modalType === t;
                const activeBg = t === 'EXPENSE' ? colors.expense : colors.income;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setModalType(t)}
                    style={[styles.modalTypeBtn, active && { backgroundColor: activeBg }]}
                  >
                    <Text style={[styles.modalTypeBtnText, active && styles.modalTypeBtnTextActive]}>
                      {t === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan / Alokasi'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Nominal Input */}
            <Text style={styles.inputLabel}>Nominal</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                value={formatThousands(amountInput)}
                onChangeText={(text) => setAmountInput(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.inkTertiary}
                style={[
                  styles.modalAmountInput,
                  { color: modalType === 'EXPENSE' ? colors.expense : colors.income },
                ]}
                autoFocus
              />
            </View>

            {/* Description Input */}
            <Text style={styles.inputLabel}>Catatan Mikro / Rincian</Text>
            <TextInput
              value={descInput}
              onChangeText={setDescInput}
              placeholder={
                modalType === 'EXPENSE'
                  ? 'Contoh: Kemeja kantor, celana jeans'
                  : 'Contoh: Alokasi gaji, refund barang'
              }
              placeholderTextColor={colors.inkTertiary}
              style={styles.modalTextInput}
            />

            {/* Date Picker row */}
            <View style={styles.datePickerRow}>
              <Text style={styles.inputLabel}>Tanggal Transaksi</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={styles.dateSelectBtn}
                accessibilityRole="button"
                accessibilityLabel="Pilih tanggal"
              >
                <Ionicons name="calendar-outline" size={16} color={colors.blue500} />
                <Text style={styles.dateSelectText}>{txDate}</Text>
              </Pressable>
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

            {/* Submit Button */}
            <Pressable
              onPress={handleSaveQuickAdd}
              disabled={modalSubmitting}
              style={({ pressed }) => [
                styles.modalSubmitBtn,
                { backgroundColor: modalType === 'EXPENSE' ? colors.expense : colors.income },
                pressed && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Simpan transaksi mikro"
            >
              {modalSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSubmitText}>Simpan Catatan</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Budget Plafon Modal */}
      <Modal
        visible={budgetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setBudgetModalVisible(false)} />
          <View style={styles.budgetModalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={styles.sheetTitle}>Atur Budget Plafon</Text>
                <Text style={styles.sheetSubtitle}>
                  Batas alokasi anggaran {displayName} untuk bulan {formatMonth(date)}
                </Text>
              </View>
              <Pressable
                onPress={() => setBudgetModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal"
              >
                <Ionicons name="close" size={22} color={colors.inkSecondary} />
              </Pressable>
            </View>

            {budgetError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.expense} />
                <Text style={styles.modalErrorText}>{budgetError}</Text>
              </View>
            ) : null}

            <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Target Plafon Bulanan (Rp)</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                value={formatThousands(budgetAmountInput)}
                onChangeText={(text) => setBudgetAmountInput(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.inkTertiary}
                style={[styles.modalAmountInput, { color: colors.blue500 }]}
                autoFocus
              />
            </View>

            <Text style={styles.budgetHintText}>
              Bisa diatur bebas atau dijadikan Rp 0. Masukkan 0 atau kosongkan untuk menghilangkan batas plafon dompet ini.
            </Text>

            {budgetAmountInput && budgetAmountInput !== '0' ? (
              <Pressable
                onPress={() => setBudgetAmountInput('0')}
                style={styles.zeroPillBtn}
                accessibilityRole="button"
                accessibilityLabel="Nolkan plafon ke 0"
              >
                <Ionicons name="refresh-outline" size={13} color={colors.blue500} />
                <Text style={styles.zeroPillText}>Nolkan Plafon (Rp 0)</Text>
              </Pressable>
            ) : null}

            <View style={styles.modalButtonsRow}>
              {budget ? (
                <Pressable
                  onPress={handleRemoveBudget}
                  disabled={budgetSubmitting}
                  style={styles.modalRemoveBudgetBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus plafon dompet"
                >
                  <Ionicons name="trash-outline" size={16} color={colors.expense} />
                  <Text style={styles.modalRemoveBudgetText}>Hapus Plafon</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setBudgetModalVisible(false)}
                  style={styles.modalCancelBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Batal"
                >
                  <Text style={styles.modalCancelText}>Batal</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleSaveBudget}
                disabled={budgetSubmitting}
                style={[styles.modalConfirmBtn, budgetSubmitting && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Simpan budget"
              >
                {budgetSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename Wallet Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setRenameModalVisible(false)} />
          <View style={styles.budgetModalCard}>
            <Text style={styles.sheetTitle}>Ubah Nama Dompet</Text>
            <Text style={styles.sheetSubtitle}>Kustomisasi nama pos dompet kecil</Text>

            {renameError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.expense} />
                <Text style={styles.modalErrorText}>{renameError}</Text>
              </View>
            ) : null}

            <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Nama Dompet</Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Nama dompet"
              placeholderTextColor={colors.inkTertiary}
              style={styles.modalTextInput}
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setRenameModalVisible(false)}
                style={styles.modalCancelBtn}
                accessibilityRole="button"
                accessibilityLabel="Batal"
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveRename}
                disabled={renameSubmitting}
                style={[styles.modalConfirmBtn, renameSubmitting && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Simpan nama dompet"
              >
                {renameSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Simpan Nama</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  monthBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  monthSub: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.inkSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCategoryName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  heroSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.sky100,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.control,
    marginBottom: spacing.sm,
  },
  connectionBannerText: {
    fontSize: 11,
    color: colors.blue500,
    fontWeight: '600',
    flex: 1,
  },
  balanceContainer: {
    marginVertical: spacing.sm,
    paddingVertical: spacing.xs,
  },
  balanceCaption: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inkSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  progressSection: {
    marginVertical: spacing.sm,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.canvas,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: colors.inkSecondary,
  },
  formulaCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  formulaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    marginBottom: 6,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  formulaItem: {
    flex: 1,
    alignItems: 'center',
  },
  formulaItemLabel: {
    fontSize: 10,
    color: colors.inkTertiary,
    marginBottom: 2,
  },
  formulaItemValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  formulaOp: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkTertiary,
    marginBottom: 2,
  },
  formulaResultItem: {
    backgroundColor: colors.white,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statColumn: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: colors.inkTertiary,
    marginBottom: 2,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  statSub: {
    fontSize: 10,
    color: colors.inkSecondary,
  },
  editBudgetBtn: {
    marginTop: 2,
    paddingVertical: 2,
  },
  editBudgetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.blue500,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  expenseActionBtn: {
    backgroundColor: colors.expense,
  },
  incomeActionBtn: {
    backgroundColor: colors.income,
  },
  transferActionBtn: {
    backgroundColor: colors.blue500,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  txCountBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
    backgroundColor: colors.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
  },
  filterBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.navy900,
    borderColor: colors.navy900,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    height: '100%',
  },
  transactionsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  txItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  txRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  txActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  txActionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 28, 74, 0.45)',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
    ...shadow.hero,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.expenseTint,
    padding: spacing.sm,
    borderRadius: radius.chip,
    marginBottom: spacing.md,
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.expense,
    fontWeight: '600',
    flex: 1,
  },
  modalTypeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: 3,
    marginBottom: spacing.md,
  },
  modalTypeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.control - 2,
  },
  modalTypeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  modalTypeBtnTextActive: {
    color: colors.white,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
    marginBottom: spacing.xs,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    height: 52,
    marginBottom: spacing.md,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.inkSecondary,
    marginRight: spacing.sm,
  },
  modalAmountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    height: '100%',
  },
  modalTextInput: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.ink,
    minHeight: 46,
    marginBottom: spacing.md,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.sky100,
    borderRadius: radius.chip,
  },
  dateSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.blue500,
  },
  modalSubmitBtn: {
    height: 50,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    ...shadow.card,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  budgetModalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    margin: spacing.xl,
    marginBottom: 'auto',
    marginTop: 'auto',
    padding: spacing.xl,
    ...shadow.hero,
  },
  budgetHintText: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 16,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  zeroPillBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.chip,
    marginBottom: spacing.md,
  },
  zeroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue500,
  },
  modalRemoveBudgetBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: colors.expenseTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalRemoveBudgetText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.expense,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
