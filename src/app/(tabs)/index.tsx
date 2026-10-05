import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { TransactionItem } from '../../components/transaction-item';
import { Chip, EmptyState, ErrorState, Fab, Loading } from '../../components/ui/common';
import { colors, radius, shadow, spacing } from '../../theme';
import { formatRupiah, getErrorMessage, getPeriodRange, Period } from '../../utils/format';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'all', label: 'Semua' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('month');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await TransactionService.getAll(getPeriodRange(period));
      setTransactions(data);
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Hero header */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.greeting}>Halo Boss👋</Text>
          <Text style={styles.appName}>P Ingfo !!</Text>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Saldo {PERIODS.find((p) => p.key === period)?.label.toLowerCase()}</Text>
            <Text style={styles.balanceValue}>{formatRupiah(balance)}</Text>

            <View style={styles.summaryRow}>
              <SummaryItem icon="arrow-down" label="Pemasukan" value={income} color={colors.income} soft={colors.incomeSoft} />
              <View style={styles.divider} />
              <SummaryItem icon="arrow-up" label="Pengeluaran" value={expense} color={colors.expense} soft={colors.expenseSoft} />
            </View>
          </View>
        </View>

        {/* Period filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => { setLoading(true); setPeriod(p.key); }} />
          ))}
        </ScrollView>

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
    </View>
  );
}

function SummaryItem({ icon, label, value, color, soft }: {
  icon: 'arrow-down' | 'arrow-up'; label: string; value: number; color: string; soft: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatRupiah(value)}
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
    paddingBottom: 56,
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
    marginBottom: -96,
    ...shadow,
  },
  balanceLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  balanceValue: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: spacing.xs },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 12, color: colors.muted },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  divider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: spacing.md },
  chips: { paddingHorizontal: spacing.lg, paddingTop: 96 + spacing.lg, paddingBottom: spacing.sm },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
