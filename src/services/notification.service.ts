import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatRupiah, toYMD } from '../utils/format';
import { PacingService } from './pacing.service';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Cache for tracking which alerts have fired to prevent duplicate spamming
// Key formats:
// Budget ceiling: `${categoryId}_${year}_${month}_${tier}`
// Low balance: `${categoryId}_low_balance_${year}_${month}` or `${categoryId}_deficit_${year}_${month}`
// Daily limit: `${categoryId}_daily_limit_${year}_${month}_${day}`
const firedAlerts = new Set<string>();

export interface BudgetAlertCheckParams {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  monthExpense: number;
  month?: number; // 1-12
  year?: number;
}

export interface LowBalanceAlertCheckParams {
  categoryId: string;
  categoryName: string;
  realBalance: number;
  cumulativeIncome?: number;
  date?: Date;
}

export interface DailyLimitAlertCheckParams {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  todayExpense: number;
  date?: Date;
}

export interface EvaluateExpenseAlertsParams {
  categoryId: string;
  categoryName: string;
  budgetAmount?: number;
  monthExpense?: number;
  todayExpense?: number;
  realBalance?: number;
  cumulativeIncome?: number;
  date?: Date;
}

export const NotificationService = {
  /**
   * Request notification permissions from the OS and initialize Android channel
   */
  requestPermissions: async (): Promise<boolean> => {
    // 1. Android notification channel configuration (required for heads-up alert, sound & vibration on Android 8.0+)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Peringatan Anggaran & Dompet',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#13317F',
          showBadge: false,
        });
      } catch (e) {
        console.warn('Failed to configure Android notification channel:', e);
      }
    }

    // 2. Web browser permission handling
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') return true;
        const res = await window.Notification.requestPermission();
        return res === 'granted';
      }
      return false;
    }

    // 3. iOS and Android permission request
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Send a local notification immediately
   */
  sendLocalNotification: async (title: string, body: string, data: Record<string, unknown> = {}) => {
    // On Web, try desktop notification first; fallback to in-app Alert if not supported or denied
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        try {
          new window.Notification(title, { body });
          return;
        } catch {
          // ignore web error and fall through
        }
      }
      // In-app alert fallback for web browser
      Alert.alert(title, body);
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
        },
        trigger: null, // immediate trigger
      });
    } catch (e) {
      console.warn('Failed to send notification:', e);
    }
  },

  /**
   * Reset low-balance alert status when a wallet receives new top-up or income
   */
  resetLowBalanceAlert: (categoryId: string) => {
    for (const key of Array.from(firedAlerts)) {
      if (key.startsWith(`${categoryId}_low_balance_`) || key.startsWith(`${categoryId}_deficit_`)) {
        firedAlerts.delete(key);
      }
    }
  },

  /**
   * Clear all fired alerts cache (useful for re-testing)
   */
  clearAlertHistory: () => {
    firedAlerts.clear();
  },

  /**
   * 1. Evaluate a wallet's monthly budget usage (80% warning and 100% exceeded threshold)
   */
  checkBudgetAlert: async (params: BudgetAlertCheckParams): Promise<'exceeded' | 'warning' | null> => {
    const { categoryId, categoryName, budgetAmount, monthExpense } = params;
    if (!budgetAmount || budgetAmount <= 0) return null;

    const now = new Date();
    const currentMonth = params.month ?? now.getMonth() + 1;
    const currentYear = params.year ?? now.getFullYear();

    const key100 = `${categoryId}_${currentYear}_${currentMonth}_100`;
    const key80 = `${categoryId}_${currentYear}_${currentMonth}_80`;

    // 1. Tier: 100% or more (Exceeded budget)
    if (monthExpense >= budgetAmount) {
      if (!firedAlerts.has(key100)) {
        firedAlerts.add(key100);
        firedAlerts.add(key80); // Also mark 80% as handled
        const overNominal = monthExpense - budgetAmount;
        const overText = overNominal > 0 ? ` Lebih ${formatRupiah(overNominal)}.` : '';

        await NotificationService.sendLocalNotification(
          `🚨 Plafon Terlampaui: Dompet ${categoryName}`,
          `Pengeluaran telah mencapai ${formatRupiah(monthExpense)} (100% dari target plafon ${formatRupiah(budgetAmount)}).${overText} Melebihi target awal!`,
          { categoryId, type: 'BUDGET_EXCEEDED' },
        );
        return 'exceeded';
      }
      return null;
    }

    // 2. Tier: 80% to 99% (Warning threshold)
    const warningThreshold = budgetAmount * 0.8;
    if (monthExpense >= warningThreshold) {
      if (!firedAlerts.has(key80)) {
        firedAlerts.add(key80);
        const percent = Math.min(99, Math.round((monthExpense / budgetAmount) * 100));

        await NotificationService.sendLocalNotification(
          `⚠️ Peringatan Kuota: Dompet ${categoryName}`,
          `Pengeluaran sudah mencapai ${percent}% (${formatRupiah(monthExpense)} dari plafon ${formatRupiah(budgetAmount)}). Hati-hati jangan sampai over-budget!`,
          { categoryId, type: 'BUDGET_WARNING' },
        );
        return 'warning';
      }
      return null;
    }

    return null;
  },

  /**
   * 2. Evaluate if wallet real cash balance is critically low or in deficit
   * Triggers when:
   * - Balance is negative (minus)
   * - Balance is <= Rp 50.000 or <= 15% of cumulative income
   */
  checkLowBalanceAlert: async (params: LowBalanceAlertCheckParams): Promise<'deficit' | 'low' | null> => {
    const { categoryId, categoryName, realBalance, cumulativeIncome } = params;
    const date = params.date ?? new Date();
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth() + 1;

    const keyDeficit = `${categoryId}_deficit_${currentYear}_${currentMonth}`;
    const keyLow = `${categoryId}_low_balance_${currentYear}_${currentMonth}`;

    // A. Deficit Alert (saldo kas minus)
    if (realBalance < 0) {
      if (!firedAlerts.has(keyDeficit)) {
        firedAlerts.add(keyDeficit);
        firedAlerts.add(keyLow);

        await NotificationService.sendLocalNotification(
          `🚨 Saldo Minus: Dompet ${categoryName}`,
          `Saldo kas sudah minus (${formatRupiah(realBalance)}). Segera isi ulang atau transfer saldo ke dompet ini.`,
          { categoryId, type: 'WALLET_DEFICIT' },
        );
        return 'deficit';
      }
      return null;
    }

    // B. Low Balance Alert (saldo kas tipis <= Rp 50.000 atau <= 15% dari total pemasukan)
    const isUnderFixedLimit = realBalance <= 50_000;
    const isUnderPercentLimit = Boolean(cumulativeIncome && cumulativeIncome > 0 && realBalance <= cumulativeIncome * 0.15);

    if (isUnderFixedLimit || isUnderPercentLimit) {
      if (!firedAlerts.has(keyLow)) {
        firedAlerts.add(keyLow);

        await NotificationService.sendLocalNotification(
          `⚠️ Saldo Menipis: Dompet ${categoryName}`,
          `Sisa saldo kas tinggal ${formatRupiah(realBalance)}. Segera isi ulang saldo atau kendalikan pengeluaran dompet ini.`,
          { categoryId, type: 'WALLET_LOW_BALANCE' },
        );
        return 'low';
      }
      return null;
    }

    // If balance is healthy, reset the keys so future drops trigger alerts again
    if (realBalance > 50_000) {
      firedAlerts.delete(keyLow);
      firedAlerts.delete(keyDeficit);
    }

    return null;
  },

  /**
   * 3. Evaluate if today's spending in this wallet exceeds the daily pacing limit
   * Daily limit = Math.round(monthlyBudget / daysInMonth)
   */
  checkDailyLimitAlert: async (params: DailyLimitAlertCheckParams): Promise<boolean> => {
    const { categoryId, categoryName, budgetAmount, todayExpense } = params;
    if (!budgetAmount || budgetAmount <= 0) return false;

    const date = params.date ?? new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();

    // Days in current month (e.g. 28, 29, 30, 31)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const pacingCfg = PacingService.getConfig();
    const dailyQuota =
      pacingCfg.mode === 'CUSTOM' && pacingCfg.customDailyLimit > 0
        ? pacingCfg.customDailyLimit
        : Math.round(budgetAmount / daysInMonth);

    if (dailyQuota <= 0) return false;

    const keyDaily = `${categoryId}_daily_limit_${year}_${month + 1}_${day}`;

    if (todayExpense > dailyQuota) {
      if (!firedAlerts.has(keyDaily)) {
        firedAlerts.add(keyDaily);

        const overNominal = todayExpense - dailyQuota;
        await NotificationService.sendLocalNotification(
          `⚡ Belanja Harian Tinggi: Dompet ${categoryName}`,
          `Pengeluaran hari ini sudah ${formatRupiah(todayExpense)} (melebihi rekomendasi harian ${formatRupiah(dailyQuota)}/hari sebesar +${formatRupiah(overNominal)}).`,
          { categoryId, type: 'DAILY_LIMIT_EXCEEDED' },
        );
        return true;
      }
    }

    return false;
  },

  /**
   * Unified evaluator for expense transactions:
   * Checks budget threshold (80%/100%), daily spending limit, and real cash balance.
   */
  evaluateExpenseAlerts: async (params: EvaluateExpenseAlertsParams) => {
    try {
      const {
        categoryId,
        categoryName,
        budgetAmount,
        monthExpense,
        todayExpense,
        realBalance,
        cumulativeIncome,
        date,
      } = params;

      // 1. Check monthly budget ceiling (80% / 100%)
      if (budgetAmount !== undefined && monthExpense !== undefined && budgetAmount > 0) {
        const txDate = date ?? new Date();
        await NotificationService.checkBudgetAlert({
          categoryId,
          categoryName,
          budgetAmount,
          monthExpense,
          month: txDate.getMonth() + 1,
          year: txDate.getFullYear(),
        });
      }

      // 2. Check daily spending limit
      if (budgetAmount !== undefined && todayExpense !== undefined && budgetAmount > 0) {
        await NotificationService.checkDailyLimitAlert({
          categoryId,
          categoryName,
          budgetAmount,
          todayExpense,
          date,
        });
      }

      // 3. Check low balance or deficit
      if (realBalance !== undefined) {
        await NotificationService.checkLowBalanceAlert({
          categoryId,
          categoryName,
          realBalance,
          cumulativeIncome,
          date,
        });
      }
    } catch (e) {
      console.warn('Error evaluating expense alerts:', e);
    }
  },

  /**
   * Test sending sample notifications to verify device behavior
   */
  sendTestAlert: async (type: 'all' | 'budget_warning' | 'budget_exceeded' | 'low_balance' | 'daily_limit' = 'all') => {
    await NotificationService.requestPermissions();

    if (type === 'all' || type === 'budget_warning') {
      await NotificationService.sendLocalNotification(
        '⚠️ Peringatan Kuota: Dompet Jajan',
        'Pengeluaran sudah mencapai 85% (Rp 425.000 dari plafon Rp 500.000). Hati-hati jangan sampai over-budget!',
        { type: 'TEST_BUDGET_WARNING' },
      );
    }

    if (type === 'budget_exceeded') {
      await NotificationService.sendLocalNotification(
        '🚨 Plafon Terlampaui: Dompet Jajan',
        'Pengeluaran telah mencapai Rp 520.000 (100% dari target plafon Rp 500.000). Lebih Rp 20.000. Melebihi target awal!',
        { type: 'TEST_BUDGET_EXCEEDED' },
      );
    }

    if (type === 'low_balance') {
      await NotificationService.sendLocalNotification(
        '⚠️ Saldo Menipis: Dompet Bensin & Parkir',
        'Sisa saldo kas tinggal Rp 35.000. Segera isi ulang saldo atau kendalikan pengeluaran dompet ini.',
        { type: 'TEST_LOW_BALANCE' },
      );
    }

    if (type === 'daily_limit') {
      await NotificationService.sendLocalNotification(
        '⚡ Belanja Harian Tinggi: Dompet Makanan',
        'Pengeluaran hari ini sudah Rp 85.000 (melebihi rekomendasi harian Rp 50.000/hari sebesar +Rp 35.000).',
        { type: 'TEST_DAILY_LIMIT' },
      );
    }
  },
};
