import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TrendStats } from '../services/statistics.service';
import { colors, radius, spacing } from '../theme';
import { formatThousands } from '../utils/format';

const DAYS_PER_WEEK = 7;

type Props = {
  /** Daily trend for one month, index 0 = day 1 */
  trend: TrendStats[];
  /** Any date inside the month the trend belongs to */
  month: Date;
};

function getInitialWeek(month: Date, weekCount: number): number {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();
  if (!isCurrentMonth) return 0;
  return Math.min(Math.floor((today.getDate() - 1) / DAYS_PER_WEEK), weekCount - 1);
}

export function WeeklyTrend({ trend, month }: Props) {
  const weekCount = Math.max(1, Math.ceil(trend.length / DAYS_PER_WEEK));
  const [week, setWeek] = useState(() => getInitialWeek(month, weekCount));

  const start = week * DAYS_PER_WEEK;
  const days = trend.slice(start, start + DAYS_PER_WEEK);
  const firstDay = start + 1;
  const lastDay = start + days.length;

  const weekIncome = days.reduce((sum, d) => sum + d.income, 0);
  const weekExpense = days.reduce((sum, d) => sum + d.expense, 0);
  // Bars are scaled to the biggest single value in the visible week
  const weekMax = Math.max(0, ...days.map(d => Math.max(d.income, d.expense)));

  return (
    <View>
      <View style={styles.weekTabs} accessibilityRole="tablist">
        {Array.from({ length: weekCount }, (_, i) => {
          const from = i * DAYS_PER_WEEK + 1;
          const to = Math.min((i + 1) * DAYS_PER_WEEK, trend.length);
          const active = i === week;
          return (
            <Pressable
              key={i}
              onPress={() => setWeek(i)}
              style={[styles.weekTab, active && styles.weekTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Tanggal ${from} sampai ${to}`}
            >
              <Text style={[styles.weekTabText, active && styles.weekTabTextActive]}>
                {from}–{to}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Masuk minggu ini</Text>
          <Text style={[styles.summaryValue, { color: colors.income }]}>
            {weekIncome > 0 ? `+${formatThousands(String(weekIncome))}` : 'Rp 0'}
          </Text>
        </View>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Keluar minggu ini</Text>
          <Text style={[styles.summaryValue, { color: colors.expense }]}>
            {weekExpense > 0 ? `−${formatThousands(String(weekExpense))}` : 'Rp 0'}
          </Text>
        </View>
      </View>

      {weekMax === 0 ? (
        <Text style={styles.weekEmpty}>
          Belum ada transaksi di tanggal {firstDay}–{lastDay}.
        </Text>
      ) : (
        days.map((d, i) => {
          const dayNumber = firstDay + i;
          const weekday = new Date(month.getFullYear(), month.getMonth(), dayNumber)
            .toLocaleDateString('id-ID', { weekday: 'short' });
          const hasAny = d.income > 0 || d.expense > 0;
          return (
            <View key={dayNumber} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.dayCol}>
                <Text style={styles.dayName}>{weekday}</Text>
                <Text style={styles.dayNumber}>{dayNumber}</Text>
              </View>
              <View style={styles.barsCol}>
                {!hasAny ? (
                  <Text style={styles.noTx}>Tidak ada transaksi</Text>
                ) : (
                  <>
                    {d.income > 0 && (
                      <AmountBar value={d.income} max={weekMax} color={colors.income} sign="+" kind="Pemasukan" />
                    )}
                    {d.expense > 0 && (
                      <AmountBar value={d.expense} max={weekMax} color={colors.expense} sign="−" kind="Pengeluaran" />
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function AmountBar({ value, max, color, sign, kind }: {
  value: number; max: number; color: string; sign: string; kind: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  const formatted = formatThousands(String(value));
  return (
    <View style={styles.barLine} accessible accessibilityLabel={`${kind} ${formatted} rupiah`}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.amount, { color }]} numberOfLines={1}>
        {sign}{formatted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weekTabs: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  weekTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.chip,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTabActive: { backgroundColor: colors.navy700 },
  weekTabText: { fontSize: 13, fontWeight: '600', color: colors.navy700, fontVariant: ['tabular-nums'] },
  weekTabTextActive: { color: colors.white },
  summary: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 13, fontWeight: '500', color: colors.inkSecondary },
  // 20px bold counts as large text, so the income green passes the 3:1 minimum
  summaryValue: { fontSize: 20, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  weekEmpty: { fontSize: 14, color: colors.inkSecondary, paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  dayCol: { width: 44 },
  dayName: { fontSize: 11, fontWeight: '600', color: colors.inkSecondary },
  dayNumber: { fontSize: 15, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  barsCol: { flex: 1, gap: spacing.xs },
  noTx: { fontSize: 13, color: colors.inkTertiary },
  barLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barTrack: { flex: 1, height: 8 },
  barFill: { height: 8, borderRadius: radius.full },
  amount: { width: 96, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
});
