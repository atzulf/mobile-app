import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../services/transaction.service';
import { colors, getCategoryIcon, radius, spacing } from '../theme';
import { formatDate, formatRupiah } from '../utils/format';

interface Props {
  item: Transaction;
  onPress?: () => void;
}

export function TransactionItem({ item, onPress }: Props) {
  const isIncome = item.type === 'INCOME';
  const tint = isIncome ? colors.income : colors.expense;
  const soft = isIncome ? colors.incomeSoft : colors.expenseSoft;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={[styles.iconWrap, { backgroundColor: soft }]}>
        <Ionicons name={getCategoryIcon(item.category?.name)} size={20} color={tint} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {item.category?.name ?? 'Lainnya'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.description || formatDate(item.transactionDate)}
        </Text>
      </View>
      <Text style={[styles.amount, { color: tint }]}>
        {isIncome ? '+' : '-'}
        {formatRupiah(item.amount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  middle: { flex: 1, marginRight: spacing.sm },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
});
