import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Chip({ label, active, onPress, color = colors.primary }: {
  label: string; active: boolean; onPress: () => void; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ icon = 'receipt-outline', title, message }: {
  icon?: IconName; title: string; message?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.expenseSoft }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.expense} />
      </View>
      <Text style={styles.emptyTitle}>Gagal memuat data</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      <Pressable style={styles.retry} onPress={onRetry}>
        <Text style={styles.retryText}>Coba Lagi</Text>
      </Pressable>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
      accessibilityLabel="Tambah transaksi"
    >
      <Ionicons name="add" size={28} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyMessage: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },
  retry: {
    marginTop: spacing.lg, backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  retryText: { color: colors.white, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  fab: {
    position: 'absolute', right: spacing.xl, bottom: spacing.xl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadow, shadowOpacity: 0.25, elevation: 6,
  },
});
