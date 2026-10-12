import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AppProvider } from '../src/app-context';
import { useTheme } from '../src/theme';
import { todayLocal } from '@down-up/shared';
import { SelectedDateProvider, useSelectedDate } from '../src/selected-date';
import { PawsitiveIcon, RateIcon } from '../src/tab-icons';
function Navigation() {
  const theme = useTheme();
  const { selectDate } = useSelectedDate();
  useEffect(() => {
    const open = () => {
      selectDate(todayLocal());
      router.navigate('/');
    };
    const listener =
      Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        open();
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => listener.remove();
  }, [selectDate]);
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
        options={{
          title: 'Rate',
          tabBarAccessibilityLabel: 'Rate',
          tabBarIcon: RateIcon,
        }}
      />
      <Tabs.Screen
        name="pawsitive"
        options={{
          title: 'Pawsitive',
          tabBarAccessibilityLabel: 'Pawsitive',
          tabBarIcon: PawsitiveIcon,
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
export default function Layout() {
  return (
    <AppProvider>
      <SelectedDateProvider>
        <Navigation />
      </SelectedDateProvider>
    </AppProvider>
  );
}
