import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { Category, CategoryService, CategoryType } from '../../services/category.service';
import { TransactionItem } from '../../components/transaction-item';
import { Chip, EmptyState, ErrorState, Fab, Loading } from '../../components/ui/common';
import { colors, radius, shadow, spacing } from '../../theme';
import { formatDateLong, formatMonth, formatRupiah, getErrorMessage, getMonthRange, toYMD } from '../../utils/format';

type TypeFilter = 'ALL' | CategoryType;

export default function TransactionsScreen() {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
    const filtered = selectedDate ? transactions.filter(t => toYMD(new Date(t.transactionDate)) === selectedDate) : transactions;
    for (const t of filtered) {
      const key = toYMD(new Date(t.transactionDate));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return Array.from(map.entries()).map(([key, data]) => ({
      title: formatDateLong(data[0].transactionDate),
      total: data.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0),
      key,
      data,
    }));
  }, [transactions, selectedDate]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const t of transactions) {
      const dateStr = toYMD(new Date(t.transactionDate));
      
      const isIncome = t.type === 'INCOME';
      
      if (!marks[dateStr]) {
        marks[dateStr] = {
          hasIncome: isIncome,
          hasExpense: !isIncome,
          customStyles: {
            container: {
              backgroundColor: isIncome ? colors.incomeSoft : colors.expenseSoft,
              borderWidth: 1,
              borderColor: isIncome ? colors.income : colors.expense,
              borderRadius: 16,
            },
            text: {
              color: isIncome ? colors.income : colors.expense,
              fontWeight: 'bold'
            }
          }
        };
      } else {
        // If there are both income and expense, make it primary color
        if ((marks[dateStr].hasIncome && !isIncome) || (marks[dateStr].hasExpense && isIncome)) {
          marks[dateStr].hasIncome = true;
          marks[dateStr].hasExpense = true;
          marks[dateStr].customStyles = {
            container: {
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 16,
            },
            text: {
              color: colors.primary,
              fontWeight: 'bold'
            }
          };
        }
      }
    }
    
    if (selectedDate) {
      if (marks[selectedDate]) {
        marks[selectedDate].customStyles = {
          container: { ...marks[selectedDate].customStyles.container, backgroundColor: colors.primary, borderColor: colors.primary },
          text: { color: '#ffffff', fontWeight: 'bold' }
        };
      } else {
        marks[selectedDate] = {
          customStyles: {
            container: { backgroundColor: colors.primary, borderRadius: 16 },
            text: { color: '#ffffff', fontWeight: 'bold' }
          }
        };
      }
    }

    return marks;
  }, [transactions, selectedDate]);

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
      {/* Month navigator & Calendar */}
      {!allTime ? (
        <View style={styles.calendarWrap}>
          <Calendar
            current={toYMD(month)}
            onMonthChange={(date: DateData) => {
              setLoading(true);
              setMonth(new Date(date.year, date.month - 1, 1));
              setSelectedDate(null);
            }}
            onDayPress={(day: DateData) => {
              if (selectedDate === day.dateString) {
                setSelectedDate(null); // Unselect if already selected
              } else {
                setSelectedDate(day.dateString); // Filter by selected date
              }
            }}
            markingType={'custom'}
            markedDates={markedDates}
            theme={{
              calendarBackground: colors.card,
              textSectionTitleColor: colors.text,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.muted,
              monthTextColor: colors.text,
              arrowColor: colors.primary,
            }}
            style={styles.calendar}
          />
          <Pressable onPress={() => { setLoading(true); setAllTime(true); setSelectedDate(null); }} style={styles.timeToggleBtn}>
            <Text style={styles.timeToggleText}>Lihat Semua Waktu</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.monthRow}>
          <Pressable onPress={() => { setLoading(true); setAllTime(false); setSelectedDate(null); }} style={styles.monthLabelWrap}>
            <Text style={styles.monthLabel}>Semua Waktu</Text>
            <Text style={styles.monthHint}>Tap untuk melihat kalender per bulan</Text>
          </Pressable>
        </View>
      )}

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
            <Text style={[styles.sectionTitle, { fontWeight: '600', color: section.total >= 0 ? colors.income : colors.ink }]}>
              {section.total >= 0 ? '+' : '−'}{formatRupiah(Math.abs(section.total))}
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
  container: { flex: 1, backgroundColor: colors.canvas },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  calendarWrap: { backgroundColor: colors.white, borderRadius: radius.card, marginTop: spacing.sm, overflow: 'hidden' },
  calendar: { borderRadius: radius.card },
  timeToggleBtn: { padding: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  timeToggleText: { fontSize: 14, color: colors.blue500, fontWeight: '600' },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: radius.card, padding: spacing.sm, marginTop: spacing.sm,
  },
  monthBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  disabled: { opacity: 0.3 },
  monthLabelWrap: { alignItems: 'center', flex: 1 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  monthHint: { fontSize: 11, color: colors.inkTertiary, marginTop: 2 },
  totals: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  totalBox: { flex: 1, backgroundColor: colors.white, borderRadius: radius.card, padding: spacing.lg, ...shadow.card },
  totalLabel: { fontSize: 13, fontWeight: '500', color: colors.inkSecondary },
  totalValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  chipRow: { paddingTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: colors.inkSecondary },
  sectionTotal: { fontSize: 13, fontWeight: '600' },
});
