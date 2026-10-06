import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../services/transaction.service';
import { colors, getCategoryIcon, radius, spacing } from '../theme';
import { formatRupiah } from '../utils/format';

interface Props {
  item: Transaction;
  onPress?: () => void;
}

export function TransactionItem({ item, onPress }: Props) {
  const isIncome = item.type === 'INCOME';
  
  // Use category tints if available, fallback to basic income/expense soft colors
  const tint = isIncome ? colors.income : colors.inkSecondary;
  const soft = isIncome ? colors.incomeTint : colors.canvas; // fallback bg

  const name = item.description || item.category?.name || 'Transaksi';
  const categoryName = item.category?.name || 'Lainnya';

  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: soft }]}>
        <Ionicons name={getCategoryIcon(item.category?.name)} size={20} color={tint} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{categoryName}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isIncome ? colors.income : colors.ink }]}>
          {isIncome ? '+' : '−'}{formatRupiah(item.amount)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  middle: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.inkSecondary },
  right: { alignItems: 'flex-end', marginLeft: spacing.sm },
  amount: { fontSize: 15, fontWeight: '700' },
});
