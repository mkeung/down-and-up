import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Action } from '../src/components';
import { PixelPanel, PixelText } from '../src/retro';
import { ValueKeypad } from '../src/value-keypad';
import { reportError, useApp } from '../src/app-context';
import { useTheme } from '../src/theme';
import { DateBar } from '../src/date-bar';
import { DataStatusButton } from '../src/data-status-icon';
import { useEntry, useSelectedDate } from '../src/selected-date';
import { PrivacyNotice } from '../src/privacy-notice';

export default function Rate() {
  const app = useApp();
  const theme = useTheme();
  const { date } = useSelectedDate();
  const selectedEntry = useEntry(date);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const choose = (value: number) => {
    void app.repo
      .setField(date, 'value', value)
      .then((changed) => (changed ? Haptics.selectionAsync() : undefined))
      .catch(reportError);
  };
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 22, alignItems: 'center' }}
      >
        <View style={{ width: '100%', maxWidth: 420, gap: 24 }}>
          <DataStatusButton />
          <DateBar />
          <ValueKeypad value={selectedEntry?.value ?? null} onChoose={choose} />
          {app.needsIdentity && (
            <>
              <Text style={{ color: theme.text }}>
                Enter your ID to keep syncing
              </Text>
              <Action
                label="Enter ID"
                onPress={() => router.navigate('/settings')}
              />
            </>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={app.needsConsent && !privacyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: '#0008' }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <PixelPanel
            style={{
              padding: 28,
              gap: 20,
            }}
          >
            <PixelText style={{ color: theme.text, fontSize: 24 }}>
              Down & Up
            </PixelText>
            <Text style={{ color: theme.text, fontSize: 18 }}>
              Your entries are saved on this phone and synced to our server so
              you can view them on the web.
            </Text>
            <Action
              label="Privacy policy"
              onPress={() => setPrivacyVisible(true)}
            />
            <Action
              label="Continue"
              onPress={() => {
                void app.consent(true).catch(reportError);
              }}
            />
            <Action
              label="Keep on this phone only"
              onPress={() => {
                void app.consent(false).catch(reportError);
              }}
            />
          </PixelPanel>
        </ScrollView>
      </Modal>
      <Modal
        visible={privacyVisible}
        animationType="slide"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <PrivacyNotice close={() => setPrivacyVisible(false)} />
      </Modal>
    </SafeAreaView>
  );
}
