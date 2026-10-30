import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { Category, CategoryService } from '../../services/category.service';
import { Budget, BudgetService } from '../../services/budget.service';
import { useUserName } from '../../services/profile.service';
import { usePacingConfig } from '../../services/pacing.service';
import { TransactionItem } from '../../components/transaction-item';
import { Chip, EmptyState, ErrorState, Fab, Loading } from '../../components/ui/common';
import { colors, getCategoryIcon, radius, shadow, spacing } from '../../theme';
import { formatRupiah, formatThousands, getErrorMessage, getPeriodRange, Period, toYMD } from '../../utils/format';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'all', label: 'Semua' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [userName] = useUserName();
  const [isBalanceHidden, setIsBalanceHidden] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [pacingConfig, setPacingConfig] = usePacingConfig();
  const [showPacingModal, setShowPacingModal] = useState(false);
  const [tempPacingMode, setTempPacingMode] = useState<'AUTO' | 'CUSTOM'>(pacingConfig.mode);
  const [tempPacingAmount, setTempPacingAmount] = useState(String(pacingConfig.customDailyLimit));

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const now = new Date();
      const [txData, catData, budgetData] = await Promise.all([
        TransactionService.getAll(getPeriodRange(period)),
        CategoryService.getAll().catch(() => [] as Category[]),
        BudgetService.getAll(now.getMonth() + 1, now.getFullYear()).catch(() => [] as Budget[]),
      ]);
      setTransactions(txData);
      setCategories(catData);
      setBudgets(budgetData);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  // Reload every time the screen gains focus (e.g. after adding a transaction)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const netFlow = income - expense;
  const isSurplus = netFlow >= 0;
  const savingsRate = income > 0 ? Math.max(0, Math.min(100, Math.round((netFlow / income) * 100))) : 0;

  // Dompet Kecil calculations per category
  const wallets = useMemo(() => {
    return categories.map((cat) => {
      const catTxs = transactions.filter((t) => t.categoryId === cat.id);
      const catIncome = catTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const catExpense = catTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      const catBudget = budgets.find((b) => b.categoryId === cat.id);
      const budgetAmount = catBudget?.amount ?? 0;
      const hasBudget = Boolean(catBudget && catBudget.amount > 0);

      // Saldo riil dompet: murni pemasukan dikurangi belanja agar sinkron dengan Dompet Utama
      const sisa = catIncome - catExpense;
      const pctUsed = hasBudget && budgetAmount > 0
        ? Math.min(100, Math.round((catExpense / budgetAmount) * 100))
        : 0;
      const isExceeded = hasBudget ? catExpense > budgetAmount : sisa < 0;
      const isWarning = hasBudget ? pctUsed >= 80 && !isExceeded : false;

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        hasBudget,
        budgetAmount,
        income: catIncome,
        expense: catExpense,
        sisa,
        txCount: catTxs.length,
        pctUsed,
        isExceeded,
        isWarning,
      };
    }).sort((a, b) => {
      if (a.hasBudget && !b.hasBudget) return -1;
      if (!a.hasBudget && b.hasBudget) return 1;
      return (b.expense + b.income) - (a.expense + a.income);
    });
  }, [categories, transactions, budgets]);

  const totalAllocated = useMemo(() => {
    return budgets.reduce((sum, b) => sum + b.amount, 0);
  }, [budgets]);

  const freeBalance = balance - totalAllocated;
  const budgetedWalletsCount = useMemo(() => {
    return wallets.filter((w) => w.hasBudget).length;
  }, [wallets]);

  // Daily Spending Pacing Data (Opsi 2 dengan konfigurasi)
  const pacingData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

    const todayYMD = toYMD(now);
    const thisMonthExpense = transactions
      .filter((t) => {
        if (t.type !== 'EXPENSE') return false;
        const d = new Date(t.transactionDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s, t) => s + t.amount, 0);

    const todayExpense = transactions
      .filter((t) => t.type === 'EXPENSE' && toYMD(new Date(t.transactionDate)) === todayYMD)
      .reduce((s, t) => s + t.amount, 0);

    const hasBudget = totalAllocated > 0;
    const remainingBudget = Math.max(0, totalAllocated - thisMonthExpense);
    const autoDailyQuota = hasBudget
      ? Math.round(remainingBudget / daysRemaining)
      : (currentDay > 0 ? Math.round(thisMonthExpense / currentDay) : 0);

    const isCustom = pacingConfig.mode === 'CUSTOM';
    const dailyQuota = isCustom && pacingConfig.customDailyLimit > 0
      ? pacingConfig.customDailyLimit
      : autoDailyQuota;

    const isOverBudget = hasBudget && thisMonthExpense >= totalAllocated;
    const isOverDailyLimit = dailyQuota > 0 && todayExpense > dailyQuota;

    let statusText = 'Aman';
    let statusColor = colors.income;
    let statusBg = colors.incomeTint;

    if (isOverBudget && !isCustom) {
      statusText = 'Plafon Lewat';
      statusColor = colors.expense;
      statusBg = colors.expenseTint;
    } else if (isOverDailyLimit) {
      statusText = 'Perlu Rem';
      statusColor = colors.warning;
      statusBg = colors.expenseSoft;
    } else if (isCustom) {
      statusText = 'Target Kustom';
      statusColor = colors.blue500;
      statusBg = colors.sky100;
    } else if (hasBudget) {
      statusText = 'Terkendali';
      statusColor = colors.income;
      statusBg = colors.incomeTint;
    } else {
      statusText = 'Plafon Bebas';
      statusColor = colors.blue500;
      statusBg = colors.sky100;
    }

    const progressPct = dailyQuota > 0 ? Math.min(100, Math.round((todayExpense / dailyQuota) * 100)) : 0;

    return {
      hasBudget,
      isCustom,
      daysRemaining,
      daysInMonth,
      autoDailyQuota,
      dailyQuota,
      todayExpense,
      isOverBudget,
      isOverDailyLimit,
      statusText,
      statusColor,
      statusBg,
      progressPct,
    };
  }, [transactions, totalAllocated, pacingConfig]);

  const getPeriodDescription = () => {
    const now = new Date();
    if (period === 'all') return 'Semua waktu';
    if (period === 'today') {
      return now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (period === 'week') {
      const start = new Date(now);
      const day = (now.getDay() + 6) % 7; // Monday = 0
      start.setDate(now.getDate() - day);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const startMonth = start.getMonth();
      const endMonth = end.getMonth();
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();

      if (startYear !== endYear) {
        return `${start.getDate()} ${start.toLocaleDateString('id-ID', {month:'short'})} ${startYear} - ${end.getDate()} ${end.toLocaleDateString('id-ID', {month:'short'})} ${endYear}`;
      }
      if (startMonth !== endMonth) {
        return `${start.getDate()} ${start.toLocaleDateString('id-ID', {month:'short'})} - ${end.getDate()} ${end.toLocaleDateString('id-ID', {month:'long'})} ${startYear}`;
      }
      return `${start.getDate()}-${end.getDate()} ${end.toLocaleDateString('id-ID', {month:'long', year:'numeric'})}`;
    }
    if (period === 'month') {
      return now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Hero header */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.greeting}>Halo {userName}👋</Text>
          <Text style={styles.appName}>P Ingfo !!</Text>

          <View style={styles.balanceCard}>
            <View style={styles.walletBadgeRow}>
              <View style={styles.walletBadge}>
                <Ionicons name="wallet" size={13} color={colors.primary} />
                <Text style={styles.walletBadgeText}>Dompet Utama (Total Saldo)</Text>
              </View>
            </View>
            <Text style={styles.balanceLabel}>
              Saldo {PERIODS.find((p) => p.key === period)?.label.toLowerCase()}
            </Text>
            <Text style={styles.dateDescription}>
              {getPeriodDescription()}
            </Text>
            <View style={styles.balanceValueRow}>
              <Text style={styles.balanceValue}>
                {isBalanceHidden ? 'Rp ****' : formatRupiah(balance)}
              </Text>
              <Pressable
                onPress={() => setIsBalanceHidden((prev) => !prev)}
                style={styles.eyeBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isBalanceHidden ? 'Tampilkan nominal saldo' : 'Sembunyikan nominal saldo'}
              >
                <Ionicons
                  name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.inkSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.summaryRow}>
              <SummaryItem icon="arrow-down" label="Pemasukan" value={income} color={colors.income} soft={colors.incomeSoft} isHidden={isBalanceHidden} />
              <View style={styles.divider} />
              <SummaryItem icon="arrow-up" label="Pengeluaran" value={expense} color={colors.expense} soft={colors.expenseSoft} isHidden={isBalanceHidden} />
            </View>

            {/* Arus Kas Bersih (Surplus / Tabungan) */}
            <View style={styles.netCashDivider} />
            <View style={styles.netCashRow}>
              <View style={styles.netCashLeft}>
                <View style={styles.netCashTitleRow}>
                  <Ionicons
                    name={isSurplus ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={isSurplus ? colors.income : colors.expense}
                  />
                  <Text style={styles.netCashTitle}>Arus Keuangan</Text>
                  <View style={[styles.netCashBadge, { backgroundColor: isSurplus ? colors.incomeTint : colors.expenseTint }]}>
                    <Text style={[styles.netCashBadgeText, { color: isSurplus ? colors.income : colors.expense }]}>
                      {isSurplus ? 'Positif' : 'Negatif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.netCashSub}>
                  {income > 0 ? `${savingsRate}% dari pemasukan` : 'Belum ada catatan pemasukan'}
                </Text>
              </View>

              <View style={styles.netCashRight}>
                <Text
                  style={[styles.netCashVal, { color: isSurplus ? colors.income : colors.expense }]}
                  numberOfLines={1}
                >
                  {isBalanceHidden ? 'Rp ****' : (isSurplus ? `+${formatRupiah(netFlow)}` : `-Rp ${Math.abs(Math.round(netFlow)).toLocaleString('id-ID')}`)}
                </Text>
              </View>
            </View>

            {income > 0 && (
              <View style={styles.netProgressBarBg}>
                <View
                  style={[
                    styles.netProgressBarFill,
                    {
                      width: `${Math.min(100, Math.max(4, savingsRate))}%`,
                      backgroundColor: isSurplus ? colors.income : colors.expense,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        </View>

        {/* Widget Pacing Belanja Harian (Option 2 dengan tombol Atur) */}
        <View style={styles.pacingCard}>
          <View style={styles.pacingHeader}>
            <View style={styles.pacingHeaderLeft}>
              <View style={[styles.pacingIconWrap, { backgroundColor: pacingData.statusBg }]}>
                <Ionicons
                  name={pacingData.isOverBudget ? 'alert-circle' : pacingData.isOverDailyLimit ? 'speedometer' : 'flash'}
                  size={14}
                  color={pacingData.statusColor}
                />
              </View>
              <Text style={styles.pacingTitle}>Pacing Belanja Harian</Text>
              <View style={[styles.pacingBadge, { backgroundColor: pacingData.statusBg }]}>
                <Text style={[styles.pacingBadgeText, { color: pacingData.statusColor }]}>
                  {pacingData.statusText}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setTempPacingMode(pacingConfig.mode);
                setTempPacingAmount(String(pacingConfig.customDailyLimit));
                setShowPacingModal(true);
              }}
              style={styles.pacingSettingBtn}
              accessibilityRole="button"
              accessibilityLabel="Buka pengaturan pacing belanja harian"
            >
              <Ionicons name="options-outline" size={13} color={colors.primary} />
              <Text style={styles.pacingSettingBtnText}>Atur</Text>
            </Pressable>
          </View>

          <View style={styles.pacingBody}>
            <View style={styles.pacingColLeft}>
              <Text style={styles.pacingTargetVal}>
                {formatRupiah(pacingData.dailyQuota)}
                <Text style={styles.pacingTargetUnit}>/hari</Text>
              </Text>
              <Text style={styles.pacingSubText}>
                {pacingData.isCustom
                  ? `Batas Kustom • Sisa ${pacingData.daysRemaining} hari di bulan ini`
                  : pacingData.hasBudget
                  ? `Otomatis Plafon • Sisa ${pacingData.daysRemaining} hari di bulan ini`
                  : 'Rata-rata pengeluaran harian bulan ini'}
              </Text>
            </View>

            <View style={styles.pacingColRight}>
              <Text style={styles.pacingTodayLabel}>Hari Ini:</Text>
              <Text style={[styles.pacingTodayVal, { color: pacingData.isOverDailyLimit ? colors.expense : colors.ink }]}>
                {formatRupiah(pacingData.todayExpense)}
              </Text>
            </View>
          </View>

          {/* Progress bar pacing hari ini */}
          {pacingData.dailyQuota > 0 && (
            <View style={styles.pacingProgressBg}>
              <View
                style={[
                  styles.pacingProgressFill,
                  {
                    width: `${Math.min(100, Math.max(4, pacingData.progressPct))}%`,
                    backgroundColor: pacingData.statusColor,
                  },
                ]}
              />
            </View>
          )}
        </View>

        {/* Period filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => { setLoading(true); setPeriod(p.key); }} />
          ))}
        </ScrollView>

        {/* Visual Allocation Flow Card */}
        <View style={styles.flowCard}>
          <View style={styles.flowHeader}>
            <View style={styles.flowHeaderTitleRow}>
              <Ionicons name="git-branch" size={16} color={colors.primary} />
              <Text style={styles.flowTitle}>Arus Alokasi Saldo Kas</Text>
            </View>
            <Pressable
              onPress={() => setShowGuideModal(true)}
              style={styles.guideBadgeBtn}
              accessibilityRole="button"
              accessibilityLabel="Pelajari cara kerja dompet"
            >
              <Ionicons name="help-circle" size={14} color={colors.blue500} />
              <Text style={styles.guideBadgeText}>Cara Kerja</Text>
            </Pressable>
          </View>

          <View style={styles.flowRow}>
            <View style={styles.flowColumn}>
              <Text style={styles.flowLabel}>Dompet Utama</Text>
              <Text style={styles.flowValue} numberOfLines={1}>
                {isBalanceHidden ? 'Rp ****' : formatRupiah(balance)}
              </Text>
              <Text style={styles.flowSub}>Total uangmu</Text>
            </View>

            <Ionicons name="arrow-forward" size={14} color={colors.inkTertiary} style={{ marginTop: 14 }} />

            <View style={styles.flowColumn}>
              <Text style={styles.flowLabel}>Teralokasi</Text>
              <Text style={[styles.flowValue, { color: colors.blue500 }]} numberOfLines={1}>
                {isBalanceHidden ? 'Rp ****' : formatRupiah(totalAllocated)}
              </Text>
              <Text style={styles.flowSub}>{budgetedWalletsCount} dompet plafon</Text>
            </View>

            <Ionicons name="arrow-forward" size={14} color={colors.inkTertiary} style={{ marginTop: 14 }} />

            <View style={styles.flowColumn}>
              <Text style={styles.flowLabel}>Kas Bebas</Text>
              <Text
                style={[
                  styles.flowValue,
                  { color: freeBalance >= 0 ? colors.income : colors.expense },
                ]}
                numberOfLines={1}
              >
                {isBalanceHidden ? 'Rp ****' : formatRupiah(freeBalance)}
              </Text>
              <Text style={styles.flowSub}>{freeBalance >= 0 ? 'Belum dibagi' : 'Saldo Minus'}</Text>
            </View>
          </View>
        </View>

        {/* Dompet Kecil Kategori Section */}
        <View style={styles.walletsSection}>
          <View style={styles.walletsHeader}>
            <View style={styles.walletsTitleWrap}>
              <Text style={styles.sectionTitle}>Dompet Kecil Kategori</Text>
              <Text style={styles.sectionSubtitle}>
                Tiap transaksi otomatis memotong Dompet Utama
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/budget')}
              style={styles.manageWalletsBtn}
              accessibilityRole="button"
              accessibilityLabel="Kelola semua dompet kategori"
            >
              <Text style={styles.link}>Kelola</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          {wallets.length === 0 ? (
            <View style={styles.emptyWalletsBox}>
              <Text style={styles.emptyWalletsText}>Belum ada dompet kategori.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.walletsScroll}
            >
              {wallets.map((wallet) => (
                <Pressable
                  key={wallet.id}
                  style={({ pressed }) => [styles.walletCard, pressed && { opacity: 0.94 }]}
                  onPress={() =>
                    router.push({
                      pathname: '/category-detail',
                      params: {
                        categoryId: wallet.id,
                        categoryName: wallet.name,
                        month: String(new Date().getMonth() + 1),
                        year: String(new Date().getFullYear()),
                      },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Buka dompet ${wallet.name}`}
                >
                  <View style={styles.walletCardHeader}>
                    <View style={styles.walletIconWrap}>
                      <Ionicons name={getCategoryIcon(wallet.name, wallet.icon)} size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walletName} numberOfLines={1}>
                        Dompet {wallet.name}
                      </Text>
                      <View style={styles.connectedPill}>
                        <Ionicons name="link" size={10} color={colors.blue500} />
                        <Text style={styles.connectedText}>Terhubung</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.inkTertiary} />
                  </View>

                  <View style={styles.walletBalanceWrap}>
                    <Text style={styles.walletBalanceLabel}>
                      {wallet.hasBudget ? 'Sisa Plafon Anggaran' : 'Saldo Dompet'}
                    </Text>
                    {wallet.isExceeded || (!wallet.hasBudget && wallet.sisa < 0) ? (
                      <View>
                        <Text
                          style={[
                            styles.walletBalanceValue,
                            { color: colors.expense, fontSize: 13, lineHeight: 18 },
                          ]}
                          numberOfLines={2}
                        >
                          Melebihi budget target awal
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.expense, fontWeight: '600', marginTop: 2 }}>
                          Lebih {formatRupiah(wallet.hasBudget ? Math.max(0, wallet.expense - wallet.budgetAmount) : Math.abs(wallet.sisa))}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.walletBalanceValue,
                          { color: colors.ink },
                        ]}
                        numberOfLines={1}
                      >
                        {formatRupiah(wallet.hasBudget ? Math.max(0, wallet.budgetAmount - wallet.expense) : wallet.sisa)}
                      </Text>
                    )}
                  </View>

                  {wallet.hasBudget ? (
                    <View style={styles.walletProgressSection}>
                      <View style={styles.walletProgressBg}>
                        <View
                          style={[
                            styles.walletProgressFill,
                            {
                              width: `${wallet.pctUsed}%`,
                              backgroundColor: wallet.isExceeded
                                ? colors.expense
                                : wallet.isWarning
                                ? colors.warning
                                : colors.income,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.walletProgressLabels}>
                        <Text style={styles.walletProgressText}>
                          Terpakai {formatRupiah(wallet.expense)} dari {formatRupiah(wallet.budgetAmount)}
                        </Text>
                        <Text style={[styles.walletProgressText, { fontWeight: '700' }]}>{wallet.pctUsed}%</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.walletStatsRow}>
                      <Text style={styles.walletStatItem} numberOfLines={1}>
                        Total Belanja: {formatRupiah(wallet.expense)}
                      </Text>
                      <Text style={styles.walletNoBudgetPrompt} numberOfLines={1}>
                        💡 Plafon: Rp 0 (Bebas)
                      </Text>
                    </View>
                  )}

                  {/* Quick Action Buttons inside Card */}
                  <View style={styles.walletButtonsRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.walletMiniBtn,
                        styles.walletSpendBtn,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({
                          pathname: '/transaction-form',
                          params: { categoryId: wallet.id, type: 'EXPENSE' },
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Catat belanja dompet ${wallet.name}`}
                    >
                      <Ionicons name="cart" size={14} color={colors.expense} />
                      <Text style={styles.walletSpendText}>Belanja</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.walletMiniBtn,
                        styles.walletTopupBtn,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({
                          pathname: '/transaction-form',
                          params: { categoryId: wallet.id, type: 'INCOME' },
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Isi saldo dompet ${wallet.name}`}
                    >
                      <Ionicons name="wallet" size={14} color={colors.income} />
                      <Text style={styles.walletTopupText}>Isi Saldo</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}

              {/* Add Custom Wallet Card */}
              <Pressable
                style={({ pressed }) => [styles.addWalletCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/budget')}
                accessibilityRole="button"
                accessibilityLabel="Buat dompet kecil baru"
              >
                <View style={styles.addWalletIconWrap}>
                  <Ionicons name="add" size={24} color={colors.primary} />
                </View>
                <Text style={styles.addWalletTitle}>Buat Dompet Baru</Text>
                <Text style={styles.addWalletSubtitle}>Kustomisasi nama sesukamu</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>

        {/* Recent transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
            <Pressable onPress={() => router.push('/transactions')}>
              <Text style={styles.link}>Lihat semua</Text>
            </Pressable>
          </View>

          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} />
          ) : transactions.length === 0 ? (
            <EmptyState title="Belum ada transaksi" message="Tekan tombol + untuk mencatat transaksi pertamamu." />
          ) : (
            transactions.slice(0, 5).map((t) => (
              <TransactionItem key={t.id} item={t} onPress={() => router.push({ pathname: '/transaction-form', params: { id: t.id } })} />
            ))
          )}
        </View>
      </ScrollView>

      <Fab onPress={() => router.push('/transaction-form')} />

      {/* Panduan Interaktif Dompet Modal */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.guideModalBackdrop}>
          <View style={styles.guideModalCard}>
            <View style={styles.guideModalHeader}>
              <View style={styles.guideModalIconWrap}>
                <Ionicons name="wallet-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideModalTitle}>Cara Kerja Dompet</Text>
                <Text style={styles.guideModalSubtitle}>Panduan Alur Keuangan Catet & Duit</Text>
              </View>
              <Pressable onPress={() => setShowGuideModal(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tutup panduan">
                <Ionicons name="close" size={22} color={colors.inkSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.guideModalScroll} contentContainerStyle={{ paddingBottom: spacing.md }}>
              <View style={styles.guideStepItem}>
                <View style={styles.guideStepNumberWrap}>
                  <Text style={styles.guideStepNumber}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Dompet Utama (Total Saldo)</Text>
                  <Text style={styles.guideStepDesc}>
                    Pusat kas yang menghitung seluruh saldo bersihmu (Total Pemasukan dikurangi Total Pengeluaran).
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepItem}>
                <View style={styles.guideStepNumberWrap}>
                  <Text style={styles.guideStepNumber}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Dompet Kecil (Pos Pembagian)</Text>
                  <Text style={styles.guideStepDesc}>
                    Bagi uangmu ke pos seperti Dompet Shopping, Dompet Makanan, atau Dompet Transportasi dengan menentukan Plafon Bulanan agar belanja terkontrol.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepItem}>
                <View style={styles.guideStepNumberWrap}>
                  <Text style={styles.guideStepNumber}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Belanja Terpotong Otomatis</Text>
                  <Text style={styles.guideStepDesc}>
                    Saat kamu mencatat belanja di Dompet Shopping, saldo Shopping berkurang dan saldo Dompet Utama otomatis ikut terpotong secara bersamaan. Tidak perlu hitung manual!
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepItem}>
                <View style={styles.guideStepNumberWrap}>
                  <Text style={styles.guideStepNumber}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepTitle}>Isi Saldo Tambahan Kapan Saja</Text>
                  <Text style={styles.guideStepDesc}>
                    Jika dapat uang jatah belanja atau pengembalian dana (refund), tekan tombol &quot;Isi Saldo&quot; pada dompet terkait untuk menambah dana pos tersebut.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setShowGuideModal(false)}
              style={styles.guideCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Tutup panduan dan mulai"
            >
              <Text style={styles.guideCloseBtnText}>Saya Mengerti! 👍</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Pengaturan Pacing Belanja Harian */}
      <Modal
        visible={showPacingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPacingModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogIconWrap}>
                <Ionicons name="speedometer-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>Atur Pacing Belanja</Text>
                <Text style={styles.dialogSubtitle}>Tentukan batas rekomendasi belanja harianmu</Text>
              </View>
              <Pressable onPress={() => setShowPacingModal(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            {/* Opsi 1: Otomatis */}
            <Pressable
              onPress={() => setTempPacingMode('AUTO')}
              style={[
                styles.pacingModeOption,
                tempPacingMode === 'AUTO' && styles.pacingModeOptionActive,
              ]}
            >
              <View style={[styles.pacingRadioCircle, tempPacingMode === 'AUTO' && styles.pacingRadioCircleActive]}>
                {tempPacingMode === 'AUTO' && <View style={styles.pacingRadioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.pacingModeTitle}>Otomatis (Berdasarkan Plafon)</Text>
                  <View style={styles.pacingRecBadge}>
                    <Text style={styles.pacingRecBadgeText}>Rekomendasi</Text>
                  </View>
                </View>
                <Text style={styles.pacingModeDesc}>
                  Dihitung dinamis: Sisa plafon dibagi sisa hari di bulan ini ({formatRupiah(pacingData.autoDailyQuota)}/hari).
                </Text>
              </View>
            </Pressable>

            {/* Opsi 2: Kustom Manual */}
            <Pressable
              onPress={() => setTempPacingMode('CUSTOM')}
              style={[
                styles.pacingModeOption,
                tempPacingMode === 'CUSTOM' && styles.pacingModeOptionActive,
              ]}
            >
              <View style={[styles.pacingRadioCircle, tempPacingMode === 'CUSTOM' && styles.pacingRadioCircleActive]}>
                {tempPacingMode === 'CUSTOM' && <View style={styles.pacingRadioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pacingModeTitle}>Kustom (Nominal Tetap Manual)</Text>
                <Text style={styles.pacingModeDesc}>
                  Tetapkan target batas belanja harian tetap sesuai kehendak Anda.
                </Text>
              </View>
            </Pressable>

            {/* Input Nominal bila Mode Kustom dipilih */}
            {tempPacingMode === 'CUSTOM' && (
              <View style={styles.pacingInputBoxWrap}>
                <Text style={styles.pacingInputLabel}>Nominal Batas Belanja Harian</Text>
                <View style={styles.pacingAmountRow}>
                  <Text style={styles.pacingAmountPrefix}>Rp</Text>
                  <TextInput
                    value={formatThousands(tempPacingAmount)}
                    onChangeText={(t) => setTempPacingAmount(t.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder="Contoh: 50.000"
                    placeholderTextColor={colors.inkTertiary}
                    style={styles.pacingAmountInput}
                  />
                  <Text style={styles.pacingAmountUnit}>/hari</Text>
                </View>

                {/* Quick suggestions chips */}
                <View style={styles.pacingChipsRow}>
                  {[25000, 50000, 75000, 100000].map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => setTempPacingAmount(String(amt))}
                      style={styles.pacingChipBtn}
                    >
                      <Text style={styles.pacingChipText}>{formatRupiah(amt)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.dialogBtnRow}>
              <Pressable onPress={() => setShowPacingModal(false)} style={styles.dialogCancelBtn}>
                <Text style={styles.dialogCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const cleanAmt = Number(tempPacingAmount.replace(/\D/g, ''));
                  setPacingConfig({
                    mode: tempPacingMode,
                    customDailyLimit: cleanAmt > 0 ? cleanAmt : 50000,
                  });
                  setShowPacingModal(false);
                }}
                style={styles.dialogSaveBtn}
              >
                <Text style={styles.dialogSaveBtnText}>Simpan Pacing</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SummaryItem({ icon, label, value, color, soft, isHidden }: {
  icon: 'arrow-down' | 'arrow-up'; label: string; value: number; color: string; soft: string; isHidden?: boolean;
}) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {isHidden ? 'Rp ****' : formatRupiah(value)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  appName: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 2 },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: -28,
    ...shadow,
  },
  walletBadgeRow: {
    marginBottom: spacing.xs,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  walletBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  balanceLabel: { color: colors.inkSecondary, fontSize: 13, fontWeight: '500' },
  dateDescription: { color: colors.inkTertiary, fontSize: 11, marginTop: 2 },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  balanceValue: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  eyeBtn: {
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 12, color: colors.muted },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  divider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: spacing.md },
  netCashDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  netCashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  netCashLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  netCashTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  netCashTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  netCashBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  netCashBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  netCashSub: {
    fontSize: 10,
    color: colors.inkTertiary,
    marginTop: 2,
  },
  netCashRight: {
    alignItems: 'flex-end',
  },
  netCashVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  netProgressBarBg: {
    height: 4,
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  netProgressBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  pacingCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: 10,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  pacingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pacingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pacingSettingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.sky100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pacingSettingBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  pacingIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pacingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  pacingBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pacingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pacingBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  pacingColLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pacingTargetVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  pacingTargetUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkTertiary,
  },
  pacingSubText: {
    fontSize: 10,
    color: colors.inkTertiary,
    marginTop: 2,
  },
  pacingColRight: {
    alignItems: 'flex-end',
  },
  pacingTodayLabel: {
    fontSize: 10,
    color: colors.inkTertiary,
    fontWeight: '600',
  },
  pacingTodayVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  pacingProgressBg: {
    height: 5,
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    marginTop: 4,
    overflow: 'hidden',
  },
  pacingProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  chips: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: spacing.sm },

  // Pacing Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dialogIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  dialogSubtitle: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 1,
  },
  pacingModeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pacingModeOptionActive: {
    backgroundColor: colors.sky100,
    borderColor: colors.primary,
  },
  pacingRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.inkTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pacingRadioCircleActive: {
    borderColor: colors.primary,
  },
  pacingRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pacingModeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  pacingRecBadge: {
    backgroundColor: colors.incomeTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  pacingRecBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.income,
  },
  pacingModeDesc: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  pacingInputBoxWrap: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pacingInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    marginBottom: 6,
  },
  pacingAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  pacingAmountPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 4,
  },
  pacingAmountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    height: '100%',
  },
  pacingAmountUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkTertiary,
    marginLeft: 4,
  },
  pacingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pacingChipBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.chip,
  },
  pacingChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dialogCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.control,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  dialogSaveBtn: {
    flex: 2,
    height: 42,
    borderRadius: radius.control,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },

  flowCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  flowHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  guideBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  guideBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue500,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    padding: spacing.sm + 2,
    borderRadius: radius.control,
  },
  flowColumn: {
    flex: 1,
  },
  flowLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkTertiary,
    marginBottom: 2,
  },
  flowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  flowSub: {
    fontSize: 9,
    color: colors.inkSecondary,
    marginTop: 1,
  },

  walletsSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  walletsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  walletsTitleWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  manageWalletsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  walletsScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  emptyWalletsBox: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  emptyWalletsText: {
    fontSize: 13,
    color: colors.muted,
  },
  walletCard: {
    width: 250,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md + 2,
    ...shadow.card,
  },
  addWalletCard: {
    width: 170,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  addWalletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  addWalletTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 2,
  },
  addWalletSubtitle: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
  },
  walletCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  walletIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  connectedText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.blue500,
  },
  walletBalanceWrap: {
    marginVertical: 4,
  },
  walletBalanceLabel: {
    fontSize: 11,
    color: colors.inkTertiary,
    fontWeight: '500',
  },
  walletBalanceValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  walletProgressSection: {
    marginVertical: 6,
  },
  walletProgressBg: {
    height: 6,
    backgroundColor: colors.canvas,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  walletProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  walletProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletProgressText: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  walletStatsRow: {
    marginVertical: 6,
    gap: 2,
  },
  walletStatItem: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  walletNoBudgetPrompt: {
    fontSize: 10,
    color: colors.blue500,
    fontWeight: '600',
  },
  walletButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  walletMiniBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.control,
  },
  walletSpendBtn: {
    backgroundColor: colors.expenseTint,
  },
  walletSpendText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.expense,
  },
  walletTopupBtn: {
    backgroundColor: colors.incomeTint,
  },
  walletTopupText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.income,
  },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  guideModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 28, 74, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  guideModalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: spacing.xl,
    ...shadow.hero,
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  guideModalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  guideModalSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 1,
  },
  guideModalScroll: {
    marginVertical: spacing.xs,
  },
  guideStepItem: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  guideStepNumberWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  guideStepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  guideStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  guideStepDesc: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 17,
  },
  guideCloseBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: radius.control,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  guideCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
