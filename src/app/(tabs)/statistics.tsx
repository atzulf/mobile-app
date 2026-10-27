import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { DashboardStats, CategoryStats, TrendStats } from '../../services/statistics.service';
import { TransactionService } from '../../services/transaction.service';
import { colors, radius, spacing, shadow } from '../../theme';
import { getErrorMessage, formatThousands, formatMonth, getMonthRange } from '../../utils/format';
import { ErrorState, Loading } from '../../components/ui/common';
import { WeeklyTrend } from '../../components/weekly-trend';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

const PIE_COLORS = [
  '#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA',
  '#F472B6', '#38BDF8', '#4ADE80', '#FB923C', '#C084FC',
];

type CategoryKind = 'EXPENSE' | 'INCOME';

export default function StatisticsScreen() {
  const [date, setDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [focusedPie, setFocusedPie] = useState<{name: string, value: number, percentage: number} | null>(null);
  const [categoryKind, setCategoryKind] = useState<CategoryKind>('EXPENSE');

  const [dashboard, setDashboard] = useState<DashboardStats>({ income: 0, expense: 0, balance: 0 });
  const [expenseCategories, setExpenseCategories] = useState<CategoryStats[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryStats[]>([]);
  const [trend, setTrend] = useState<TrendStats[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();

      // Fetch all transactions for the selected month to ensure 100% accurate data
      // independent of backend category filters
      const transactions = await TransactionService.getAll(getMonthRange(date));

      // 1. Dashboard summary
      const incTotal = transactions
        .filter((t) => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);
      const expTotal = transactions
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);
      setDashboard({ income: incTotal, expense: expTotal, balance: incTotal - expTotal });

      // 2. Expense categories
      const expMap = new Map<string, { id: string; name: string; total: number }>();
      transactions
        .filter((t) => t.type === 'EXPENSE')
        .forEach((t) => {
          const catId = t.categoryId || 'uncategorized';
          const catName = t.category?.name || 'Lainnya';
          const curr = expMap.get(catId) || { id: catId, name: catName, total: 0 };
          curr.total += t.amount;
          expMap.set(catId, curr);
        });
      setExpenseCategories(Array.from(expMap.values()).sort((a, b) => b.total - a.total));

      // 3. Income categories (strictly filtered by INCOME only)
      const incMap = new Map<string, { id: string; name: string; total: number }>();
      transactions
        .filter((t) => t.type === 'INCOME')
        .forEach((t) => {
          const catId = t.categoryId || 'uncategorized';
          const catName = t.category?.name || 'Lainnya';
          const curr = incMap.get(catId) || { id: catId, name: catName, total: 0 };
          curr.total += t.amount;
          incMap.set(catId, curr);
        });
      setIncomeCategories(Array.from(incMap.values()).sort((a, b) => b.total - a.total));

      // 4. Daily trend
      const daysInMonth = new Date(y, m, 0).getDate();
      const dailyTrend: TrendStats[] = Array.from({ length: daysInMonth }, (_, i) => ({
        label: `${i + 1}`,
        income: 0,
        expense: 0,
      }));
      transactions.forEach((t) => {
        const d = new Date(t.transactionDate).getDate();
        if (d >= 1 && d <= daysInMonth) {
          if (t.type === 'INCOME') dailyTrend[d - 1].income += t.amount;
          else dailyTrend[d - 1].expense += t.amount;
        }
      });
      setTrend(dailyTrend);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const shiftMonth = (delta: number) => {
    setLoading(true);
    setDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  if (loading && !refreshing) return <Loading />;
  if (error) return <View style={styles.center}><ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} /></View>;

  const hasData = dashboard.income > 0 || dashboard.expense > 0;

  // 16.1 Bar Chart Data
  const barData = [
    { value: dashboard.income, label: 'Pemasukan', frontColor: colors.income, topLabelComponent: () => <Text style={{fontSize: 10, color: colors.income, marginBottom: 4}}>{formatThousands(String(dashboard.income))}</Text> },
    { value: dashboard.expense, label: 'Pengeluaran', frontColor: colors.expense, topLabelComponent: () => <Text style={{fontSize: 10, color: colors.expense, marginBottom: 4}}>{formatThousands(String(dashboard.expense))}</Text> },
  ];
  const maxBarValue = Math.max(dashboard.income, dashboard.expense);

  // 16.2 Pie Chart Data (expense or income, picked by the toggle)
  const categories = categoryKind === 'EXPENSE' ? expenseCategories : incomeCategories;
  const kindLabel = categoryKind === 'EXPENSE' ? 'pengeluaran' : 'pemasukan';
  const totalCategory = categories.reduce((sum, c) => sum + c.total, 0);
  const pieData = categories.map((c, i) => {
    const percentage = totalCategory > 0 ? Math.round((c.total / totalCategory) * 100) : 0;
    return {
      id: c.id,
      value: c.total,
      color: PIE_COLORS[i % PIE_COLORS.length],
      text: percentage > 5 ? `${percentage}%` : '',
      textColor: colors.white,
      name: c.name,
      onPress: () => setFocusedPie({ name: c.name, value: c.total, percentage })
    };
  });

  const switchCategoryKind = (kind: CategoryKind) => {
    setCategoryKind(kind);
    setFocusedPie(null);
  };

  const chartWidth = Math.min(screenWidth - (spacing.lg * 2) - 80, 600); // 80 accounts for y-axis width

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          style={styles.monthBtn}
          accessibilityRole="button"
          accessibilityLabel="Bulan sebelumnya"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonth(date)}</Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          style={styles.monthBtn}
          accessibilityRole="button"
          accessibilityLabel="Bulan berikutnya"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {!hasData ? (
          <View style={styles.empty}>
            <Ionicons name="pie-chart-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>Belum ada data transaksi di {formatMonth(date)}</Text>
          </View>
        ) : (
          <>
            {/* 16.1 Income vs Expense (Bar Chart) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pemasukan vs Pengeluaran</Text>
              <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                <BarChart
                  data={barData}
                  width={chartWidth}
                  height={200}
                  barWidth={60}
                  spacing={40}
                  initialSpacing={40}
                  hideRules
                  yAxisThickness={0}
                  xAxisThickness={1}
                  xAxisColor={colors.border}
                  yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                  yAxisLabelWidth={65}
                  maxValue={maxBarValue > 0 ? maxBarValue * 1.2 : 100}
                  formatYLabel={(label) => formatThousands(label)}
                  pointerConfig={{
                    pointerStripHeight: 160,
                    pointerStripColor: colors.border,
                    pointerStripWidth: 2,
                    pointerColor: colors.primary,
                    radius: 4,
                    pointerLabelWidth: 100,
                    pointerLabelHeight: 40,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: any) => {
                      const item = items[0];
                      if (!item) return null;
                      return (
                        <View style={styles.tooltipBox}>
                          <Text style={styles.tooltipLabel}>{item.label}</Text>
                          <Text style={styles.tooltipValue}>{formatThousands(String(item.value))}</Text>
                        </View>
                      );
                    },
                  }}
                />
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: colors.income}]}/><Text style={styles.legendText}>Pemasukan</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: colors.expense}]}/><Text style={styles.legendText}>Pengeluaran</Text></View>
              </View>
            </View>

            {/* 16.2 Income / Expense by Category (Pie Chart) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Per kategori</Text>
              <View style={styles.kindTabs} accessibilityRole="tablist">
                {([
                  { kind: 'EXPENSE', label: 'Pengeluaran' },
                  { kind: 'INCOME', label: 'Pemasukan' },
                ] as const).map(({ kind, label }) => {
                  const active = categoryKind === kind;
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => switchCategoryKind(kind)}
                      style={[styles.kindTab, active && styles.kindTabActive]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.kindTabText, active && styles.kindTabTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {categories.length === 0 ? (
                <Text style={styles.cardEmpty}>Belum ada {kindLabel} di {formatMonth(date)}.</Text>
              ) : (
                <>
                  <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                    <PieChart
                      key={categoryKind}
                      data={pieData}
                      donut
                      innerRadius={50}
                      radius={100}
                      textSize={12}
                      showText
                      focusOnPress
                      centerLabelComponent={() => {
                        if (focusedPie) {
                          return (
                            <View style={{ alignItems: 'center', padding: 4 }}>
                              <Text style={{ fontSize: 10, color: colors.muted, textAlign: 'center' }} numberOfLines={1}>{focusedPie.name}</Text>
                              <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{focusedPie.percentage}%</Text>
                            </View>
                          );
                        }
                        return (
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, color: colors.muted }}>Total</Text>
                            <Text style={{ fontSize: 13, fontWeight: 'bold' }}>{formatThousands(String(totalCategory))}</Text>
                          </View>
                        );
                      }}
                    />
                  </View>

                  <View style={styles.pieLegendGrid}>
                    {pieData.map((p, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [styles.pieLegendItem, pressed && { opacity: 0.75 }]}
                        onPress={() => {
                          if (p.id && p.id !== 'uncategorized') {
                            router.push({
                              pathname: '/category-detail',
                              params: {
                                categoryId: p.id,
                                categoryName: p.name,
                                month: String(date.getMonth() + 1),
                                year: String(date.getFullYear()),
                              },
                            });
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Buka rincian mikro pos ${p.name}`}
                      >
                        <View style={[styles.legendDot, {backgroundColor: p.color}]}/>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.legendText} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.legendAmount} numberOfLines={1}>{formatThousands(String(p.value))}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* 16.3 Daily trend, one week at a time so every amount fits without scrolling */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tren harian</Text>
              <WeeklyTrend key={`${date.getFullYear()}-${date.getMonth()}`} trend={trend} month={date} />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: colors.income}]}/><Text style={styles.legendText}>Pemasukan (+)</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: colors.expense}]}/><Text style={styles.legendText}>Pengeluaran (−)</Text></View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  monthBtn: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  content: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', marginTop: 40, opacity: 0.5 },
  emptyText: { marginTop: spacing.sm, fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.card, marginBottom: spacing.lg, ...shadow.card },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.muted },
  legendAmount: { fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  pieLegendGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '45%' },
  kindTabs: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  kindTab: { flex: 1, minHeight: 44, borderRadius: radius.chip, backgroundColor: colors.sky100, alignItems: 'center', justifyContent: 'center' },
  kindTabActive: { backgroundColor: colors.navy700 },
  kindTabText: { fontSize: 13, fontWeight: '600', color: colors.navy700 },
  kindTabTextActive: { color: colors.white },
  cardEmpty: { fontSize: 14, color: colors.inkSecondary, paddingVertical: spacing.xl },
  tooltipBox: { backgroundColor: colors.text, padding: spacing.sm, borderRadius: radius.sm },
  tooltipLabel: { color: colors.white, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tooltipValue: { color: colors.white, fontSize: 11, fontWeight: '600' },
});
