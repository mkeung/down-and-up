import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AppProvider, useApp } from '../src/app-context';
import { useTheme } from '../src/theme';
import { todayLocal } from '@down-up/shared';
import { SelectedDateProvider, useSelectedDate } from '../src/selected-date';
import { PawsitiveIcon, RateIcon } from '../src/tab-icons';
import { ThemeProvider } from '../src/theme-preference';
import { RetroTabBar } from '../src/retro-tab-bar';
import { PixelFontContext } from '../src/retro';
import pixelifySans from '../assets/fonts/PixelifySans-Regular.ttf';
import silkscreen from '../assets/fonts/Silkscreen-Regular.ttf';
import { CerberusProvider } from '../src/cerberus-context';
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
      tabBar={(props) => <RetroTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarStyle: { backgroundColor: theme.chrome },
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
  const [loaded, error] = useFonts({
    PixelifySans: pixelifySans,
    Silkscreen: silkscreen,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: '#f4f3ee',
        }}
      >
        <ActivityIndicator accessibilityLabel="Loading" />
      </View>
    );
  return (
    <PixelFontContext.Provider value={loaded}>
      <AppProvider>
        <Appearance />
      </AppProvider>
    </PixelFontContext.Provider>
  );
}
function Appearance() {
  const { repo } = useApp();
  return (
    <ThemeProvider store={repo}>
      <StatusBar style="auto" />
      <SelectedDateProvider>
        <CerberusProvider>
          <Navigation />
        </CerberusProvider>
      </SelectedDateProvider>
    </ThemeProvider>
  );
}
