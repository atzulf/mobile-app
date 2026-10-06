import { Ionicons } from '@expo/vector-icons';

export const colors = {
  white: '#FFFFFF',
  canvas: '#F5F8FD',
  navy900: '#0A1C4A',
  navy700: '#13317F',
  blue500: '#2F6FE4',
  sky300: '#7DB7FF',
  sky100: '#E8F1FE',
  ink: '#0A1C4A',
  inkSecondary: '#55627F',
  inkTertiary: '#8A95AD',
  inkOnHero: '#FFFFFF',
  inkOnHeroMuted: 'rgba(255,255,255,0.72)',
  line: '#E3E9F4',
  income: '#0E9F6E',
  incomeTint: '#E3F6EE',
  expense: '#D6455D',
  expenseTint: '#FCE9ED',
  warning: '#E59A12',
  danger: '#C62B45',
  // keep legacy mappings for non-updated files temporarily
  primary: '#13317F',
  primarySoft: '#E8F1FE',
  incomeSoft: '#E3F6EE',
  expenseSoft: '#FCE9ED',
  background: '#F5F8FD',
  card: '#FFFFFF',
  text: '#0A1C4A',
  muted: '#55627F',
  border: '#E3E9F4',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28 };
export const radius = { 
  hero: 28, 
  card: 18, 
  control: 14, 
  chip: 10, 
  full: 999,
  // legacy
  sm: 10, md: 14, lg: 18, xl: 28, pill: 999 
};

export const shadow = {
  hero: {
    shadowColor: '#13317F',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  card: {
    shadowColor: '#0A1C4A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#13317F',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
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
