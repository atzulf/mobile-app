import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { Category, CategoryService, CategoryType } from '../../services/category.service';
import { TransactionItem } from '../../components/transaction-item';
import { Chip, EmptyState, ErrorState, Fab, Loading } from '../../components/ui/common';
import { colors, radius, spacing } from '../../theme';
import { formatDateLong, formatMonth, formatRupiah, getErrorMessage, getMonthRange, toYMD } from '../../utils/format';

type TypeFilter = 'ALL' | CategoryType;

export default function TransactionsScreen() {
  const [month, setMonth] = useState(() => new Date());
  const [allTime, setAllTime] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    CategoryService.getAll().then(setCategories).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await TransactionService.getAll({
        ...(allTime ? {} : getMonthRange(month)),
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        categoryId,
      });
      setTransactions(data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, allTime, typeFilter, categoryId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const visibleCategories = categories.filter((c) => typeFilter === 'ALL' || c.type === typeFilter);

  // Group by day for SectionList
  const sections = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const key = toYMD(new Date(t.transactionDate));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return Array.from(map.entries()).map(([key, data]) => ({
      title: formatDateLong(data[0].transactionDate),
      total: data.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0),
      key,
      data,
    }));
  }, [transactions]);

  const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

  const shiftMonth = (delta: number) => {
    setLoading(true);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const changeType = (t: TypeFilter) => {
    setLoading(true);
    setTypeFilter(t);
    setCategoryId(undefined);
  };

  const header = (
    <View>
      {/* Month navigator */}
      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} disabled={allTime} style={[styles.monthBtn, allTime && styles.disabled]}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => { setLoading(true); setAllTime((v) => !v); }} style={styles.monthLabelWrap}>
          <Text style={styles.monthLabel}>{allTime ? 'Semua Waktu' : formatMonth(month)}</Text>
          <Text style={styles.monthHint}>{allTime ? 'Tap untuk per bulan' : 'Tap untuk semua waktu'}</Text>
        </Pressable>
        <Pressable onPress={() => shiftMonth(1)} disabled={allTime} style={[styles.monthBtn, allTime && styles.disabled]}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Pemasukan</Text>
          <Text style={[styles.totalValue, { color: colors.income }]} numberOfLines={1} adjustsFontSizeToFit>{formatRupiah(income)}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Pengeluaran</Text>
          <Text style={[styles.totalValue, { color: colors.expense }]} numberOfLines={1} adjustsFontSizeToFit>{formatRupiah(expense)}</Text>
        </View>
      </View>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Semua" active={typeFilter === 'ALL'} onPress={() => changeType('ALL')} />
        <Chip label="Pemasukan" active={typeFilter === 'INCOME'} color={colors.income} onPress={() => changeType('INCOME')} />
        <Chip label="Pengeluaran" active={typeFilter === 'EXPENSE'} color={colors.expense} onPress={() => changeType('EXPENSE')} />
      </ScrollView>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Semua Kategori" active={!categoryId} onPress={() => { setLoading(true); setCategoryId(undefined); }} />
        {visibleCategories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => { setLoading(true); setCategoryId(c.id); }} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={loading || error ? [] : sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={[styles.sectionTotal, { color: section.total >= 0 ? colors.income : colors.expense }]}>
              {section.total >= 0 ? '+' : '-'}{formatRupiah(Math.abs(section.total))}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TransactionItem item={item} onPress={() => router.push({ pathname: '/transaction-form', params: { id: item.id } })} />
        )}
        ListEmptyComponent={
          loading ? <Loading /> :
          error ? <ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} /> :
          <EmptyState icon="search-outline" title="Tidak ada transaksi" message="Coba ubah filter atau tambahkan transaksi baru." />
        }
      />
      <Fab onPress={() => router.push('/transaction-form')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm,
  },
  monthBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  disabled: { opacity: 0.3 },
  monthLabelWrap: { alignItems: 'center', flex: 1 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  monthHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  totals: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  totalBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  totalLabel: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  chipRow: { paddingTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  sectionTotal: { fontSize: 13, fontWeight: '600' },
});
