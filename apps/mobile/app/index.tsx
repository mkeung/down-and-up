import { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Action } from '../src/components';
import { PixelPanel, PixelText } from '../src/retro';
import { ValueKeypad } from '../src/value-keypad';
import { reportError, useApp } from '../src/app-context';
import { useTheme } from '../src/theme';
import { EntryHeader } from '../src/entry-header';
import { useSelectedEntry } from '../src/selected-date';
import { PrivacyNotice } from '../src/privacy-notice';
import { useCerberusActions } from '../src/cerberus-context';

export default function Rate() {
  const app = useApp();
  const theme = useTheme();
  // The keypad highlights the tapped value at once; it reverts if saving fails.
  const { value, chooseValue } = useSelectedEntry();
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const { playReaction } = useCerberusActions();
  const latestChoice = useRef(0);
  const choose = useCallback(
    (next: number) => {
      const choice = ++latestChoice.current;
      void chooseValue(next)
        .then((changed) => {
          if (!changed) return;
          if (choice === latestChoice.current) playReaction(next);
          return Haptics.selectionAsync();
        })
        .catch(reportError);
    },
    [chooseValue, playReaction],
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <EntryHeader>
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
      </EntryHeader>
      <View
        testID="rate-keypad-area"
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingVertical: 12,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth: 420, flexShrink: 1 }}>
          <ValueKeypad value={value} onChoose={choose} scrollRows />
        </View>
      </View>
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
