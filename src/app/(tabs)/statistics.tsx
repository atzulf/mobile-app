import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import { StatisticsService, DashboardStats, CategoryStats, TrendStats } from '../../services/statistics.service';
import { colors, radius, spacing, shadow } from '../../theme';
import { formatRupiah, getErrorMessage, formatThousands, formatMonth } from '../../utils/format';
import { ErrorState, Loading } from '../../components/ui/common';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

const PIE_COLORS = [
  '#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA',
  '#F472B6', '#38BDF8', '#4ADE80', '#FB923C', '#C084FC',
];

export default function StatisticsScreen() {
  const [date, setDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [focusedPie, setFocusedPie] = useState<{name: string, value: number, percentage: number} | null>(null);

  const [dashboard, setDashboard] = useState<DashboardStats>({ income: 0, expense: 0, balance: 0 });
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [trend, setTrend] = useState<TrendStats[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      
      const [d, c, t] = await Promise.all([
        StatisticsService.getDashboard(m, y),
        StatisticsService.getCategories(m, y),
        StatisticsService.getTrend(y, m)
      ]);
      setDashboard(d);
      setCategories(c);
      setTrend(t);
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

  // 16.2 Pie Chart Data
  const totalExpense = categories.reduce((sum, c) => sum + c.total, 0);
  const pieData = categories.map((c, i) => {
    const percentage = totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0;
    return {
      value: c.total,
      color: PIE_COLORS[i % PIE_COLORS.length],
      text: percentage > 5 ? `${percentage}%` : '',
      textColor: colors.white,
      name: c.name,
      onPress: () => setFocusedPie({ name: c.name, value: c.total, percentage })
    };
  });

  // 16.3 Line Chart Data (Daily for the selected month)
  const incomeLine = trend.map(t => ({ value: t.income, label: t.label }));
  const expenseLine = trend.map(t => ({ value: t.expense, label: t.label }));
  const maxLineValue = Math.max(...trend.map(t => Math.max(t.income, t.expense)));
  // Leave a 20% buffer on top, but minimal 10.000 for aesthetics if 0
  const lineYAxisMax = maxLineValue > 0 ? maxLineValue * 1.2 : 10000;

  const chartWidth = Math.min(screenWidth - (spacing.lg * 2) - 80, 600); // 80 accounts for y-axis width

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonth(date)}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthBtn}>
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

            {/* 16.2 Expense by Category (Pie Chart) */}
            {categories.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pengeluaran per Kategori</Text>
                <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                  <PieChart
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
                          <Text style={{ fontSize: 13, fontWeight: 'bold' }}>{formatThousands(String(totalExpense))}</Text>
                        </View>
                      );
                    }}
                  />
                </View>
                
                <View style={styles.pieLegendGrid}>
                  {pieData.map((p, i) => (
                    <View key={i} style={styles.pieLegendItem}>
                      <View style={[styles.legendDot, {backgroundColor: p.color}]}/>
                      <Text style={styles.legendText} numberOfLines={1}>{p.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 16.3 Financial Trend (Line Chart) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tren Harian ({formatMonth(date)})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
                <LineChart
                  data={incomeLine}
                  data2={expenseLine}
                  width={Math.max(chartWidth, 700)} // 700 to fit 31 days comfortably
                  height={200}
                  color1={colors.income}
                  color2={colors.expense}
                  dataPointsColor1={colors.income}
                  dataPointsColor2={colors.expense}
                  startFillColor1={colors.incomeSoft}
                  startFillColor2={colors.expenseSoft}
                  endFillColor1={colors.white}
                  endFillColor2={colors.white}
                  startOpacity={0.4}
                  endOpacity={0.1}
                  areaChart
                  curved
                  initialSpacing={20}
                  spacing={Math.max(chartWidth / 31, 24)}
                  yAxisThickness={0}
                  xAxisThickness={1}
                  xAxisColor={colors.border}
                  hideRules
                  yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                  yAxisLabelWidth={65}
                  maxValue={lineYAxisMax}
                  formatYLabel={(label) => formatThousands(label)}
                  pointerConfig={{
                    pointerStripHeight: 160,
                    pointerStripColor: colors.border,
                    pointerStripWidth: 2,
                    pointerColor: colors.primary,
                    radius: 4,
                    pointerLabelWidth: 120,
                    pointerLabelHeight: 60,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: any) => {
                      const income = items[0]?.value || 0;
                      const expense = items[1]?.value || 0;
                      return (
                        <View style={styles.tooltipBox}>
                          <Text style={styles.tooltipLabel}>Tgl {items[0]?.label || ''}</Text>
                          <View style={styles.tooltipRow}>
                            <View style={[styles.legendDot, {backgroundColor: colors.income}]}/>
                            <Text style={styles.tooltipValue}>{formatThousands(String(income))}</Text>
                          </View>
                          <View style={styles.tooltipRow}>
                            <View style={[styles.legendDot, {backgroundColor: colors.expense}]}/>
                            <Text style={styles.tooltipValue}>{formatThousands(String(expense))}</Text>
                          </View>
                        </View>
                      );
                    },
                  }}
                />
              </ScrollView>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: colors.income}]}/><Text style={styles.legendText}>Pemasukan</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: colors.expense}]}/><Text style={styles.legendText}>Pengeluaran</Text></View>
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
  monthBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  content: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', marginTop: 40, opacity: 0.5 },
  emptyText: { marginTop: spacing.sm, fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.lg, ...shadow },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.muted },
  pieLegendGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '45%' },
  tooltipBox: { backgroundColor: colors.text, padding: spacing.sm, borderRadius: radius.sm },
  tooltipLabel: { color: colors.white, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tooltipValue: { color: colors.white, fontSize: 11, fontWeight: '600' },
});
