import { Ionicons } from '@expo/vector-icons';

export const colors = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',
  income: '#16A34A',
  incomeSoft: '#DCFCE7',
  expense: '#DC2626',
  expenseSoft: '#FEE2E2',
  background: '#F4F5FB',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const shadow = {
  shadowColor: '#1F2937',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

type IconName = keyof typeof Ionicons.glyphMap;

// Icon per default category (PRD §15). Fallback: pricetag
const CATEGORY_ICONS: Record<string, IconName> = {
  salary: 'briefcase',
  freelance: 'laptop',
  business: 'storefront',
  investment: 'trending-up',
  bonus: 'gift',
  gift: 'heart',
  food: 'fast-food',
  transportation: 'car',
  housing: 'home',
  bills: 'receipt',
  shopping: 'bag-handle',
  entertainment: 'game-controller',
  health: 'medkit',
  education: 'school',
  subscription: 'repeat',
  other: 'ellipsis-horizontal-circle',
};

export function getCategoryIcon(name?: string): IconName {
  if (!name) return 'pricetag';
  return CATEGORY_ICONS[name.toLowerCase()] ?? 'pricetag';
}
