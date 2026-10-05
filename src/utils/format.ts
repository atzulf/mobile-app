import { Alert, Platform } from 'react-native';

export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

/** "1500000" -> "1.500.000" (for amount input display) */
export function formatThousands(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

/** Local date -> "YYYY-MM-DD" (avoids UTC shift of toISOString) */
export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> ISO string at local noon, so the day never shifts across timezones */
export function ymdToISO(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toISOString();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export type Period = 'today' | 'week' | 'month' | 'all';

export function getPeriodRange(period: Period): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (period === 'all') return {};
  if (period === 'today') return { startDate: toYMD(now), endDate: toYMD(now) };
  if (period === 'week') {
    const start = new Date(now);
    const day = (now.getDay() + 6) % 7; // Monday = 0
    start.setDate(now.getDate() - day);
    return { startDate: toYMD(start), endDate: toYMD(now) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toYMD(start), endDate: toYMD(end) };
}

export function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { startDate: toYMD(start), endDate: toYMD(end) };
}

/** Cross-platform confirm dialog (Alert buttons don't work on web) */
export function confirmAction(title: string, message: string, confirmText = 'Hapus'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function getErrorMessage(error: unknown): string {
  const anyErr = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = anyErr?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (msg) return msg;
  if (anyErr?.message === 'Network Error') return 'Tidak dapat terhubung ke server. Pastikan backend berjalan.';
  return anyErr?.message ?? 'Terjadi kesalahan';
}
