import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform } from 'react-native';
import { colors } from '../theme';

if (Platform.OS === 'web') {
  LogBox.ignoreLogs(['Unknown event handler property `onPressIn`']);
}

export default function RootLayout() {
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
      </Stack>
    </>
  );
}
