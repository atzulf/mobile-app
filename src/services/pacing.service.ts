import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface PacingConfig {
  mode: 'AUTO' | 'CUSTOM';
  customDailyLimit: number; // e.g. 50000
}

const STORAGE_KEY = 'CATETAN_DUIT_PACING_CONFIG';

const defaultConfig: PacingConfig = {
  mode: 'AUTO',
  customDailyLimit: 50000,
};

let currentConfig: PacingConfig = { ...defaultConfig };

// Load initial configuration from storage if on web
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.mode === 'AUTO' || parsed.mode === 'CUSTOM')) {
        currentConfig = {
          mode: parsed.mode,
          customDailyLimit:
            typeof parsed.customDailyLimit === 'number' && parsed.customDailyLimit > 0
              ? parsed.customDailyLimit
              : 50000,
        };
      }
    }
  } catch {
    // Ignore storage parse error
  }
}

const listeners = new Set<(cfg: PacingConfig) => void>();

export const PacingService = {
  getConfig: (): PacingConfig => ({ ...currentConfig }),

  setConfig: (newCfg: Partial<PacingConfig>) => {
    currentConfig = {
      ...currentConfig,
      ...newCfg,
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
      } catch {
        // Ignore storage write error
      }
    }
    listeners.forEach((listener) => listener({ ...currentConfig }));
  },

  /**
   * Determine effective daily limit based on active mode
   */
  getEffectiveDailyLimit: (
    remainingBudget: number,
    daysRemaining: number,
    totalAllocated?: number,
    daysInMonth?: number,
  ): number => {
    if (currentConfig.mode === 'CUSTOM' && currentConfig.customDailyLimit > 0) {
      return currentConfig.customDailyLimit;
    }
    if (remainingBudget > 0 && daysRemaining > 0) {
      return Math.round(remainingBudget / daysRemaining);
    }
    if (totalAllocated && totalAllocated > 0 && daysInMonth && daysInMonth > 0) {
      return Math.round(totalAllocated / daysInMonth);
    }
    return 0;
  },
};

export function usePacingConfig() {
  const [config, setConfigState] = useState<PacingConfig>(currentConfig);

  useEffect(() => {
    const listener = (cfg: PacingConfig) => setConfigState(cfg);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [config, PacingService.setConfig] as const;
}
