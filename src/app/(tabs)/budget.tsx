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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Budget, BudgetService } from '../../services/budget.service';
import { Category, CategoryService } from '../../services/category.service';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { colors, getCategoryIcon, radius, shadow, spacing } from '../../theme';
import {
  confirmAction,
  formatMonth,
  formatRupiah,
  formatThousands,
  getErrorMessage,
  getMonthRange,
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
  const [newWalletBudget, setNewWalletBudget] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit / Rename Wallet Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editingWalletName, setEditingWalletName] = useState('');
  const [editingWalletBudget, setEditingWalletBudget] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();

      const [budgetData, catData, txData] = await Promise.all([
        BudgetService.getAll(m, y).catch(() => [] as Budget[]),
        CategoryService.getAll().catch(() => [] as Category[]),
        TransactionService.getAll(getMonthRange(date)).catch(() => [] as Transaction[]),
      ]);

      setBudgets(budgetData);
      setCategories(catData);
      setTransactions(txData);
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

  // Compute rich wallet details
  const wallets = useMemo(() => {
    return categories
      .map((cat) => {
        const catTxs = transactions.filter((t) => t.categoryId === cat.id);
        const catIncome = catTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const catExpense = catTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        const catBudget = budgets.find((b) => b.categoryId === cat.id);
        const budgetAmount = catBudget?.amount ?? 0;
        const hasBudget = Boolean(catBudget && catBudget.amount > 0);

        const sisa = hasBudget ? budgetAmount + catIncome - catExpense : catIncome - catExpense;
        const ceiling = hasBudget ? budgetAmount + catIncome : catIncome;
        const pctUsed = ceiling > 0 ? Math.min(100, Math.round((catExpense / ceiling) * 100)) : 0;
        const isExceeded = ceiling > 0 ? catExpense > ceiling : catExpense > 0 && catIncome === 0;
        const isWarning = ceiling > 0 && pctUsed >= 80 && !isExceeded;

        return {
          id: cat.id,
          name: cat.name,
          hasBudget,
          budgetAmount,
          budgetId: catBudget?.id ?? null,
          income: catIncome,
          expense: catExpense,
          sisa,
          txCount: catTxs.length,
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
  }, [categories, transactions, budgets]);

  const filteredWallets = useMemo(() => {
    if (!searchQuery.trim()) return wallets;
    const q = searchQuery.toLowerCase().trim();
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [wallets, searchQuery]);

  // Overall totals across all wallets
  const totalAllocated = useMemo(() => budgets.reduce((s, b) => s + b.amount, 0), [budgets]);
  const totalSpentAll = useMemo(
    () => transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    [transactions],
  );
  const totalRemaining = totalAllocated - totalSpentAll;

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
      // Update custom name
      await CategoryService.update(editingWalletId, { name: cleanName });

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
            <Text style={styles.helperTitle}>Pos Dompet Kecil</Text>
            <Text style={styles.helperText}>
              Bagi uangmu ke dompet kecil dengan plafon bulanan. Belanja dari dompet mana pun otomatis memotong Dompet Utama.
            </Text>
          </View>
        </View>

        {/* Global Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Plafon</Text>
            <Text style={[styles.summaryVal, { color: colors.blue500 }]}>
              {formatRupiah(totalAllocated)}
            </Text>
            <Text style={styles.summarySub}>{budgets.length} dompet berplafon</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Belanja</Text>
            <Text style={[styles.summaryVal, { color: colors.expense }]}>
              {formatRupiah(totalSpentAll)}
            </Text>
            <Text style={styles.summarySub}>Bulan {formatMonth(date)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Sisa Dana</Text>
            <Text
              style={[
                styles.summaryVal,
                { color: totalRemaining >= 0 ? colors.income : colors.expense },
              ]}
            >
              {formatRupiah(totalRemaining)}
            </Text>
            <Text style={styles.summarySub}>{totalRemaining >= 0 ? 'Tersedia' : 'Overbudget'}</Text>
          </View>
        </View>

        {/* Action Header: Search & Create Wallet Button */}
        <View style={styles.actionHeaderRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.inkTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari nama dompet..."
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
            <Text style={styles.createWalletBtnText}>Buat Dompet</Text>
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
            const statusColor = wallet.isExceeded
              ? colors.expense
              : wallet.isWarning
              ? colors.warning
              : wallet.hasBudget
              ? colors.income
              : colors.inkTertiary;

            const statusText = wallet.isExceeded
              ? 'Melebihi Plafon'
              : wallet.isWarning
              ? 'Mendekati Batas'
              : wallet.hasBudget
              ? 'Aman'
              : 'Belum Ada Plafon';

            return (
              <View key={wallet.id} style={styles.walletCard}>
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIconWrap, { backgroundColor: statusColor + '18' }]}>
                      <Ionicons
                        name={getCategoryIcon(wallet.name)}
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

                  <Pressable
                    onPress={() => openEditWallet(wallet)}
                    style={styles.cardEditBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Ubah nama dompet ${wallet.name}`}
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.inkSecondary} />
                  </Pressable>
                </View>

                {/* Sisa Boleh Dipakai */}
                <View style={styles.cardBalanceRow}>
                  <View>
                    <Text style={styles.cardBalanceLabel}>Sisa Boleh Dibelanjakan</Text>
                    <Text
                      style={[
                        styles.cardBalanceValue,
                        { color: wallet.sisa >= 0 ? colors.ink : colors.expense },
                      ]}
                    >
                      {formatRupiah(wallet.sisa)}
                    </Text>
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
                        Terpakai: {formatRupiah(wallet.expense)} ({wallet.pctUsed}%)
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => openEditWallet(wallet)}
                    style={styles.setBudgetPromptBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Pasang plafon anggaran"
                  >
                    <Ionicons name="add-circle-outline" size={14} color={colors.blue500} />
                    <Text style={styles.setBudgetPromptText}>
                      Pasang plafon anggaran bulanan dompet ini
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
                    onPress={() =>
                      router.push({
                        pathname: '/transaction-form',
                        params: { categoryId: wallet.id, type: 'EXPENSE' },
                      })
                    }
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
                    onPress={() =>
                      router.push({
                        pathname: '/transaction-form',
                        params: { categoryId: wallet.id, type: 'INCOME' },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Isi saldo dompet ${wallet.name}`}
                  >
                    <Ionicons name="wallet" size={14} color={colors.income} />
                    <Text style={styles.cardTopupText}>Isi Saldo</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.cardActionBtn,
                      styles.cardDetailBtn,
                      pressed && { opacity: 0.8 },
                    ]}
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
                    accessibilityLabel={`Buka rincian buku kas dompet ${wallet.name}`}
                  >
                    <Text style={styles.cardDetailText}>Rincian</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal: Buat Dompet Baru (Custom Name) */}
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
                <Ionicons name="wallet" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Buat Dompet Baru</Text>
                <Text style={styles.modalSubtitle}>Kustomisasi nama pos dompet sesukamu</Text>
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
              onChangeText={setNewWalletName}
              placeholder="Contoh: Skincare, Kucing, Hobi, Gadget, Liburan"
              placeholderTextColor={colors.inkTertiary}
              style={styles.modalTextInput}
              autoFocus
            />

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
                <Ionicons name="pencil" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Kelola Dompet</Text>
                <Text style={styles.modalSubtitle}>Ubah nama atau plafon dompet</Text>
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
  cardDetailBtn: {
    backgroundColor: colors.primarySoft,
  },
  cardDetailText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
