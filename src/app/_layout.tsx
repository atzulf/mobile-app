import '../utils/zod-compat';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform } from 'react-native';
import { colors } from '../theme';
import { NotificationService } from '../services/notification.service';

if (Platform.OS === 'web') {
  LogBox.ignoreLogs(['Unknown event handler property `onPressIn`']);
}

export default function RootLayout() {
  useEffect(() => {
    // Request permission on app start for local budget threshold notifications
    NotificationService.requestPermissions().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction-form"
          options={{
            presentation: 'modal',
            title: 'Transaksi',
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="category-detail"
          options={{
            title: 'Dompet Kecil',
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="transfer"
          options={{
            presentation: 'modal',
            title: 'Transfer Antar Dompet',
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
      </Stack>
    </>
  );
}
