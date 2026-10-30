import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Budget, BudgetService } from '../../services/budget.service';
import { Category, CategoryService } from '../../services/category.service';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { NotificationService } from '../../services/notification.service';
import { colors, getCategoryIcon, radius, shadow, spacing, WALLET_AVAILABLE_ICONS, WalletIconName } from '../../theme';
import {
  confirmAction,
  formatMonth,
  formatRupiah,
  formatThousands,
  getErrorMessage,
} from '../../utils/format';
import { EmptyState, ErrorState, Loading } from '../../components/ui/common';

export default function DompetScreen() {
  const [date, setDate] = useState(() => new Date());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Create Custom Wallet Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletIcon, setNewWalletIcon] = useState<WalletIconName>('wallet');
  const [hasManuallyPickedIcon, setHasManuallyPickedIcon] = useState(false);
  const [newWalletBudget, setNewWalletBudget] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit / Rename Wallet Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editingWalletName, setEditingWalletName] = useState('');
  const [editingWalletIcon, setEditingWalletIcon] = useState<WalletIconName>('wallet');
  const [editingWalletBudget, setEditingWalletBudget] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();

      const [budgetData, catData, allTxData] = await Promise.all([
        BudgetService.getAll(m, y).catch(() => [] as Budget[]),
        CategoryService.getAll().catch(() => [] as Category[]),
        TransactionService.getAll().catch(() => [] as Transaction[]),
      ]);

      setBudgets(budgetData);
      setCategories(catData);
      setTransactions(allTxData);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const shiftMonth = (delta: number) => {
    setLoading(true);
    setDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  // Transactions belonging to the currently selected month
  const monthTransactions = useMemo(() => {
    const selMonth = date.getMonth();
    const selYear = date.getFullYear();
    return transactions.filter((t) => {
      const d = new Date(t.transactionDate);
      return d.getMonth() === selMonth && d.getFullYear() === selYear;
    });
  }, [transactions, date]);

  // Compute rich wallet details
  const wallets = useMemo(() => {
    return categories
      .map((cat) => {
        // Real cumulative cash balance for this wallet across all-time transactions
        const catAllTxs = transactions.filter((t) => t.categoryId === cat.id);
        const catAllIncome = catAllTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const catAllExpense = catAllTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        // Monthly activity for the selected month to evaluate against budget ceiling
        const catMonthTxs = monthTransactions.filter((t) => t.categoryId === cat.id);
        const catMonthExpense = catMonthTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        const catMonthIncome = catMonthTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);

        const catBudget = budgets.find((b) => b.categoryId === cat.id);
        const budgetAmount = catBudget?.amount ?? 0;
        const hasBudget = Boolean(catBudget && catBudget.amount > 0);

        // Saldo riil dompet: murni pemasukan dikurangi pengeluaran transaksi agar total uang tetap sama persis dengan Dompet Utama
        const sisa = catAllIncome - catAllExpense;

        const pctUsed = hasBudget && budgetAmount > 0
          ? Math.min(100, Math.round((catMonthExpense / budgetAmount) * 100))
          : 0;
        const isExceeded = hasBudget ? catMonthExpense > budgetAmount : sisa < 0;
        const isWarning = hasBudget ? pctUsed >= 80 && !isExceeded : false;

        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          hasBudget,
          budgetAmount,
          budgetId: catBudget?.id ?? null,
          income: catAllIncome,
          expense: catAllExpense,
          monthExpense: catMonthExpense,
          monthIncome: catMonthIncome,
          sisa,
          txCount: catAllTxs.length,
          pctUsed,
          isExceeded,
          isWarning,
        };
      })
      .sort((a, b) => {
        if (a.hasBudget && !b.hasBudget) return -1;
        if (!a.hasBudget && b.hasBudget) return 1;
        return (b.expense + b.income) - (a.expense + a.income);
      });
  }, [categories, transactions, monthTransactions, budgets]);

  const filteredWallets = useMemo(() => {
    if (!searchQuery.trim()) return wallets;
    const q = searchQuery.toLowerCase().trim();
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [wallets, searchQuery]);

  // Overall totals across all wallets
  const totalWalletBalance = useMemo(
    () => wallets.reduce((s, w) => s + w.sisa, 0),
    [wallets],
  );
  const totalSpentAll = useMemo(
    () => monthTransactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    [monthTransactions],
  );
  const totalIncomeAll = useMemo(
    () => monthTransactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
    [monthTransactions],
  );

  // Evaluate budget threshold alerts for active wallets
  useEffect(() => {
    wallets.forEach((w) => {
      if (w.hasBudget && w.budgetAmount > 0) {
        NotificationService.checkBudgetAlert({
          categoryId: w.id,
          categoryName: w.name,
          budgetAmount: w.budgetAmount,
          monthExpense: w.monthExpense,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        }).catch(() => {});
      }
    });
  }, [wallets, date]);

  // Handler: Create Custom Wallet
  const handleCreateWallet = async () => {
    const cleanName = newWalletName.trim();
    if (!cleanName) {
      setCreateError('Masukkan nama dompet baru');
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      // 1. Create the custom category in backend
      const newCat = await CategoryService.create({
        name: cleanName,
        type: 'EXPENSE',
        icon: newWalletIcon,
      });

      // 2. If budget ceiling specified, create the monthly budget
      const cleanBudget = Number(newWalletBudget.replace(/\D/g, ''));
      if (cleanBudget > 0) {
        await BudgetService.create({
          categoryId: newCat.id,
          amount: cleanBudget,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });
      }

      setCreateModalVisible(false);
      setNewWalletName('');
      setNewWalletIcon('wallet');
      setHasManuallyPickedIcon(false);
      setNewWalletBudget('');
      setLoading(true);
      await loadData();
    } catch (e) {
      setCreateError(getErrorMessage(e));
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handler: Open Edit/Rename Wallet
  const openEditWallet = (wallet: (typeof wallets)[0]) => {
    setEditingWalletId(wallet.id);
    setEditingWalletName(wallet.name);
    setEditingWalletIcon(getCategoryIcon(wallet.name, wallet.icon));
    setEditingBudgetId(wallet.budgetId);
    setEditingWalletBudget(wallet.hasBudget ? String(Math.round(wallet.budgetAmount)) : '');
    setEditError(null);
    setEditModalVisible(true);
  };

  // Handler: Save Edited Wallet
  const handleSaveEditWallet = async () => {
    if (!editingWalletId) return;
    const cleanName = editingWalletName.trim();
    if (!cleanName) {
      setEditError('Nama dompet tidak boleh kosong');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    try {
      // Update custom name and icon
      await CategoryService.update(editingWalletId, {
        name: cleanName,
        icon: editingWalletIcon,
      });

      // Update or create budget ceiling
      const cleanBudget = Number(editingWalletBudget.replace(/\D/g, ''));
      if (cleanBudget > 0) {
        if (editingBudgetId) {
          await BudgetService.delete(editingBudgetId).catch(() => {});
        }
        await BudgetService.create({
          categoryId: editingWalletId,
          amount: cleanBudget,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });
      } else if (editingBudgetId) {
        await BudgetService.delete(editingBudgetId).catch(() => {});
      }

      setEditModalVisible(false);
      setLoading(true);
      await loadData();
    } catch (e) {
      setEditError(getErrorMessage(e));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handler: Delete Wallet
  const handleDeleteWallet = async () => {
    if (!editingWalletId) return;
    const ok = await confirmAction(
      'Hapus Dompet Ini?',
      `Dompet "${editingWalletName}" beserta seluruh catatan transaksi dan pengaturan plafonnya akan dihapus.`,
    );
    if (!ok) return;

    setEditSubmitting(true);
    try {
      await CategoryService.delete(editingWalletId);
      setEditModalVisible(false);
      setLoading(true);
      await loadData();
    } catch (e) {
      Alert.alert('Gagal Menghapus', getErrorMessage(e));
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Month Selector */}
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
          <Text style={styles.monthSub}>Kelola Dompet Kecil</Text>
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
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Helper Banner */}
        <View style={styles.helperBanner}>
          <Ionicons name="wallet" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.helperTitle}>Pos Dompet Serbaguna</Text>
            <Text style={styles.helperText}>
              Kelola pos uangmu ke dalam dompet serbaguna. Setiap transaksi otomatis tersinkronisasi dengan Dompet Utama.
            </Text>
          </View>
        </View>

        {/* Global Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Saldo Dompet</Text>
            <Text
              style={[
                styles.summaryVal,
                { color: totalWalletBalance >= 0 ? colors.ink : colors.expense },
              ]}
            >
              {totalWalletBalance < 0
                ? `Defisit ${formatRupiah(Math.abs(totalWalletBalance))}`
                : formatRupiah(totalWalletBalance)}
            </Text>
            <Text style={styles.summarySub}>{wallets.length} dompet aktif</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Belanja</Text>
            <Text style={[styles.summaryVal, { color: colors.expense }]}>
              {formatRupiah(totalSpentAll)}
            </Text>
            <Text style={styles.summarySub}>Uang keluar</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Uang Masuk</Text>
            <Text style={[styles.summaryVal, { color: colors.income }]}>
              {formatRupiah(totalIncomeAll)}
            </Text>
            <Text style={styles.summarySub}>Uang masuk</Text>
          </View>
        </View>

        {/* Action Header: Search, Transfer & Create Wallet Button */}
        <View style={styles.actionHeaderRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.inkTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari dompet..."
              placeholderTextColor={colors.inkTertiary}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={colors.inkTertiary} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => router.push('/transfer')}
            style={({ pressed }) => [styles.transferHeaderBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Transfer saldo antar dompet"
          >
            <Ionicons name="swap-horizontal" size={15} color={colors.blue500} />
            <Text style={styles.transferHeaderBtnText}>Transfer</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setNewWalletName('');
              setNewWalletBudget('');
              setCreateError(null);
              setCreateModalVisible(true);
            }}
            style={({ pressed }) => [styles.createWalletBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Buat dompet kecil baru"
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.createWalletBtnText}>Buat</Text>
          </Pressable>
        </View>

        {loading && !refreshing ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} />
        ) : filteredWallets.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="Tidak ada dompet ditemukan"
            message={
              categories.length === 0
                ? 'Belum ada dompet kecil. Buat dompet pertamamu dengan tombol "Buat Dompet" di atas!'
                : 'Tidak ada dompet yang cocok dengan pencarian kata kunci.'
            }
          />
        ) : (
          filteredWallets.map((wallet) => {
            const statusColor = (wallet.isExceeded || wallet.sisa < 0)
              ? colors.expense
              : wallet.isWarning
              ? colors.warning
              : wallet.hasBudget
              ? colors.income
              : colors.inkTertiary;

            const statusText = (wallet.isExceeded || wallet.sisa < 0)
              ? 'Melebihi Plafon'
              : wallet.isWarning
              ? 'Mendekati Batas'
              : wallet.hasBudget
              ? 'Aman'
              : 'Belum Ada Plafon';

            return (
              <Pressable
                key={wallet.id}
                style={({ pressed }) => [styles.walletCard, pressed && { opacity: 0.95 }]}
                onPress={() =>
                  router.push({
                    pathname: '/category-detail',
                    params: {
                      categoryId: wallet.id,
                      categoryName: wallet.name,
                      month: String(date.getMonth() + 1),
                      year: String(date.getFullYear()),
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Buka rincian detail dompet ${wallet.name}`}
              >
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIconWrap, { backgroundColor: statusColor + '18' }]}>
                      <Ionicons
                        name={getCategoryIcon(wallet.name, wallet.icon)}
                        size={18}
                        color={statusColor === colors.inkTertiary ? colors.primary : statusColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardWalletName} numberOfLines={1}>
                        Dompet {wallet.name}
                      </Text>
                      <View style={styles.connectedBadgeRow}>
                        <Ionicons name="link" size={10} color={colors.blue500} />
                        <Text style={styles.connectedBadgeText}>Terhubung ke Dompet Utama</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openEditWallet(wallet);
                      }}
                      style={styles.cardEditBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Ubah nama dompet ${wallet.name}`}
                      hitSlop={8}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.inkSecondary} />
                    </Pressable>
                    <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                  </View>
                </View>

                {/* Sisa Boleh Dipakai */}
                <View style={styles.cardBalanceRow}>
                  <View style={{ flex: 1, paddingRight: spacing.xs }}>
                    <Text style={styles.cardBalanceLabel}>
                      {wallet.hasBudget ? 'Sisa Plafon Bulan Ini' : 'Sisa Saldo Dompet'}
                    </Text>
                    {wallet.isExceeded || (!wallet.hasBudget && wallet.sisa < 0) ? (
                      <View>
                        <Text
                          style={[
                            styles.cardBalanceValue,
                            { color: colors.expense, fontSize: 15, lineHeight: 20 },
                          ]}
                        >
                          Melebihi budget target awal
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.expense, fontWeight: '600', marginTop: 2 }}>
                          Lebih {formatRupiah(wallet.hasBudget ? Math.max(0, wallet.monthExpense - wallet.budgetAmount) : Math.abs(wallet.sisa))}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.cardBalanceValue,
                          { color: colors.ink },
                        ]}
                      >
                        {formatRupiah(wallet.hasBudget ? Math.max(0, wallet.budgetAmount - wallet.monthExpense) : wallet.sisa)}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.cardStatusBadge,
                      { backgroundColor: statusColor + '18', borderColor: statusColor + '40' },
                    ]}
                  >
                    <Text style={[styles.cardStatusBadgeText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                  </View>
                </View>

                {/* Progress bar or unbudgeted prompt */}
                {wallet.hasBudget ? (
                  <View style={styles.cardProgressWrap}>
                    <View style={styles.cardProgressBg}>
                      <View
                        style={[
                          styles.cardProgressFill,
                          { width: `${wallet.pctUsed}%`, backgroundColor: statusColor },
                        ]}
                      />
                    </View>
                    <View style={styles.cardProgressLabels}>
                      <Text style={styles.cardProgressText}>
                        Plafon: {formatRupiah(wallet.budgetAmount)}
                      </Text>
                      <Text style={styles.cardProgressText}>
                        Terpakai: {formatRupiah(wallet.monthExpense)} ({wallet.pctUsed}%)
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openEditWallet(wallet);
                    }}
                    style={styles.setBudgetPromptBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Pasang plafon anggaran"
                  >
                    <Ionicons name="add-circle-outline" size={14} color={colors.blue500} />
                    <Text style={styles.setBudgetPromptText}>
                      Plafon: Rp 0 (Bebas) • Pasang target anggaran
                    </Text>
                  </Pressable>
                )}

                {/* Quick Action Buttons */}
                <View style={styles.cardActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cardActionBtn,
                      styles.cardSpendBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push({
                        pathname: '/transaction-form',
                        params: { categoryId: wallet.id, type: 'EXPENSE' },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Catat belanja dompet ${wallet.name}`}
                  >
                    <Ionicons name="cart" size={14} color={colors.expense} />
                    <Text style={styles.cardSpendText}>Belanja</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.cardActionBtn,
                      styles.cardTopupBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push({
                        pathname: '/transaction-form',
                        params: { categoryId: wallet.id, type: 'INCOME' },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Isi saldo dompet ${wallet.name}`}
                  >
                    <Ionicons name="wallet" size={14} color={colors.income} />
                    <Text style={styles.cardTopupText}>Isi Saldo</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.cardActionBtn,
                      styles.cardTransferBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push({
                        pathname: '/transfer',
                        params: { sourceId: wallet.id },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pindah saldo dari dompet ${wallet.name}`}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={colors.blue500} />
                    <Text style={styles.cardTransferText}>Pindah</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Modal: Buat Dompet Baru (Custom Name & Icon) */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setCreateModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name={newWalletIcon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Buat Dompet Baru</Text>
                <Text style={styles.modalSubtitle}>Kustomisasi nama dan ikon pos dompet sesukamu</Text>
              </View>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal"
              >
                <Ionicons name="close" size={22} color={colors.inkSecondary} />
              </Pressable>
            </View>

            {createError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.expense} />
                <Text style={styles.modalErrorText}>{createError}</Text>
              </View>
            ) : null}

            {/* Custom Name Input */}
            <Text style={styles.inputLabel}>Nama Dompet Kecil *</Text>
            <TextInput
              value={newWalletName}
              onChangeText={(text) => {
                setNewWalletName(text);
                if (!hasManuallyPickedIcon && text.trim().length > 0) {
                  const autoIcon = getCategoryIcon(text);
                  if (autoIcon && autoIcon !== 'pricetag') {
                    setNewWalletIcon(autoIcon);
                  }
                }
              }}
              placeholder="Contoh: Skincare, Kucing, Hobi, Gadget, Liburan"
              placeholderTextColor={colors.inkTertiary}
              style={styles.modalTextInput}
              autoFocus
            />

            {/* Icon Picker Section */}
            <View style={styles.iconSectionHeader}>
              <Text style={styles.inputLabel}>Pilih Ikon Dompet</Text>
              <View style={styles.iconSelectedPill}>
                <Ionicons name={newWalletIcon} size={13} color={colors.primary} />
                <Text style={styles.iconSelectedText}>{newWalletIcon}</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconScrollRow}
              style={styles.iconScrollView}
            >
              {WALLET_AVAILABLE_ICONS.map((icon) => {
                const isSelected = newWalletIcon === icon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => {
                      setNewWalletIcon(icon);
                      setHasManuallyPickedIcon(true);
                    }}
                    style={[
                      styles.iconChip,
                      isSelected && styles.iconChipSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih ikon ${icon}`}
                    hitSlop={4}
                  >
                    <Ionicons
                      name={icon}
                      size={20}
                      color={isSelected ? colors.white : colors.inkSecondary}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Optional Budget Ceiling Input */}
            <Text style={styles.inputLabel}>Plafon Anggaran Bulanan (Opsional)</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                value={formatThousands(newWalletBudget)}
                onChangeText={(t) => setNewWalletBudget(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="0 (Bisa diatur nanti)"
                placeholderTextColor={colors.inkTertiary}
                style={styles.modalAmountInput}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalCancelBtn}
                accessibilityRole="button"
                accessibilityLabel="Batal"
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateWallet}
                disabled={createSubmitting}
                style={[styles.modalConfirmBtn, createSubmitting && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Simpan dompet baru"
              >
                {createSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Simpan Dompet</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Edit / Rename Wallet */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setEditModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name={editingWalletIcon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Kelola Dompet</Text>
                <Text style={styles.modalSubtitle}>Ubah nama, ikon, atau plafon dompet</Text>
              </View>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal"
              >
                <Ionicons name="close" size={22} color={colors.inkSecondary} />
              </Pressable>
            </View>

            {editError ? (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.expense} />
                <Text style={styles.modalErrorText}>{editError}</Text>
              </View>
            ) : null}

            {/* Custom Name Input */}
            <Text style={styles.inputLabel}>Nama Dompet Kecil</Text>
            <TextInput
              value={editingWalletName}
              onChangeText={setEditingWalletName}
              placeholder="Nama dompet"
              placeholderTextColor={colors.inkTertiary}
              style={styles.modalTextInput}
            />

            {/* Icon Picker Section */}
            <View style={styles.iconSectionHeader}>
              <Text style={styles.inputLabel}>Pilih Ikon Dompet</Text>
              <View style={styles.iconSelectedPill}>
                <Ionicons name={editingWalletIcon} size={13} color={colors.primary} />
                <Text style={styles.iconSelectedText}>{editingWalletIcon}</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconScrollRow}
              style={styles.iconScrollView}
            >
              {WALLET_AVAILABLE_ICONS.map((icon) => {
                const isSelected = editingWalletIcon === icon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => setEditingWalletIcon(icon)}
                    style={[
                      styles.iconChip,
                      isSelected && styles.iconChipSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih ikon ${icon}`}
                    hitSlop={4}
                  >
                    <Ionicons
                      name={icon}
                      size={20}
                      color={isSelected ? colors.white : colors.inkSecondary}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Budget Ceiling Input */}
            <Text style={styles.inputLabel}>Plafon Anggaran Bulanan (Rp)</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                value={formatThousands(editingWalletBudget)}
                onChangeText={(t) => setEditingWalletBudget(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.inkTertiary}
                style={styles.modalAmountInput}
              />
            </View>

            <Text style={styles.budgetHintText}>
              Bisa diatur bebas atau diset Rp 0. Ketik 0 atau kosongkan untuk menghilangkan plafon dompet ini.
            </Text>

            {editingWalletBudget && editingWalletBudget !== '0' ? (
              <Pressable
                onPress={() => setEditingWalletBudget('0')}
                style={styles.zeroPillBtn}
                accessibilityRole="button"
                accessibilityLabel="Nolkan plafon ke 0"
              >
                <Ionicons name="refresh-outline" size={13} color={colors.blue500} />
                <Text style={styles.zeroPillText}>Nolkan Plafon (Rp 0)</Text>
              </Pressable>
            ) : null}

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={handleDeleteWallet}
                style={styles.modalDeleteBtn}
                disabled={editSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Hapus dompet"
              >
                <Ionicons name="trash-outline" size={16} color={colors.expense} />
                <Text style={styles.modalDeleteText}>Hapus</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveEditWallet}
                disabled={editSubmitting}
                style={[styles.modalConfirmBtn, editSubmitting && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Simpan perubahan"
              >
                {editSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Simpan</Text>
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
  list: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  helperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.md,
  },
  helperTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  helperText: {
    fontSize: 11,
    color: colors.primary,
    lineHeight: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkTertiary,
    marginBottom: 2,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  summarySub: {
    fontSize: 9,
    color: colors.inkSecondary,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    height: '100%',
  },
  createWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    ...shadow.card,
  },
  createWalletBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  transferHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.blue500,
    height: 44,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.control,
  },
  transferHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue500,
  },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWalletName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  connectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.blue500,
  },
  cardEditBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBalanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  cardBalanceLabel: {
    fontSize: 11,
    color: colors.inkTertiary,
    fontWeight: '500',
  },
  cardBalanceValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  cardStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  cardStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardProgressWrap: {
    marginVertical: spacing.xs + 2,
  },
  cardProgressBg: {
    height: 6,
    backgroundColor: colors.canvas,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cardProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardProgressText: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  setBudgetPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    marginVertical: 4,
  },
  setBudgetPromptText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.blue500,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cardActionBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.control,
  },
  cardSpendBtn: {
    backgroundColor: colors.expenseTint,
  },
  cardSpendText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.expense,
  },
  cardTopupBtn: {
    backgroundColor: colors.incomeTint,
  },
  cardTopupText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.income,
  },
  cardTransferBtn: {
    backgroundColor: colors.sky100,
  },
  cardTransferText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue500,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 28, 74, 0.48)',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    width: '90%',
    maxWidth: 420,
    maxHeight: '90%',
    padding: spacing.xl,
    ...shadow.hero,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 1,
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
    marginBottom: spacing.xs,
  },
  modalTextInput: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
    height: 48,
    marginBottom: spacing.md,
  },
  iconSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconSelectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
  },
  iconSelectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  iconScrollView: {
    marginBottom: spacing.md,
  },
  iconScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.card,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.lg,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.inkSecondary,
    marginRight: spacing.sm,
  },
  modalAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    height: '100%',
  },
  budgetHintText: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 16,
    marginTop: -8,
    marginBottom: spacing.sm,
  },
  zeroPillBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.chip,
    marginBottom: spacing.md,
  },
  zeroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue500,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.expenseTint,
  },
  modalDeleteText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.expense,
  },
});
