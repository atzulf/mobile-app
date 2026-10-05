import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (focused: IconName, outline: IconName) =>
  ({ color, focused: isFocused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={isFocused ? focused : outline} size={22} color={color as string} />
  );

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 20, color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', headerShown: false, tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transaksi', tabBarIcon: tabIcon('list', 'list-outline') }} />
      <Tabs.Screen name="statistics" options={{ title: 'Statistik', tabBarIcon: tabIcon('pie-chart', 'pie-chart-outline') }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: tabIcon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
