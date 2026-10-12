import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AppProvider } from '../src/app-context';
import { useTheme } from '../src/theme';
import { todayLocal } from '@down-up/shared';
function Navigation() {
  const theme = useTheme();
  useEffect(() => {
    const open = () =>
      router.navigate({
        pathname: '/',
        params: { date: todayLocal(), notification: Date.now().toString() },
      });
    const listener =
      Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        open();
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => listener.remove();
  }, []);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarStyle: { backgroundColor: theme.surface },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarAccessibilityLabel: 'Today' }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarAccessibilityLabel: 'History' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarAccessibilityLabel: 'Settings' }}
      />
    </Tabs>
  );
}
export default function Layout() {
  return (
    <AppProvider>
      <Navigation />
    </AppProvider>
  );
}
