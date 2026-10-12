import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Action } from '../src/components';
import { reportError, useApp } from '../src/app-context';
import { useTheme } from '../src/theme';
import { DateBar } from '../src/date-bar';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 22, alignItems: 'center' }}
      >
        <View style={{ width: '100%', maxWidth: 420, gap: 24 }}>
          <DateBar />
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((row) => (
              <View
                key={row}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                {(row === 3
                  ? [10]
                  : [row * 3 + 1, row * 3 + 2, row * 3 + 3]
                ).map((value) => (
                  <Action
                    key={value}
                    label={String(value)}
                    selected={selectedEntry?.value === value}
                    onPress={() => choose(value)}
                    style={{
                      width: '29%',
                      minWidth: 64,
                      minHeight: 76,
                      aspectRatio: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 30,
                        color: theme.text,
                        fontWeight:
                          selectedEntry?.value === value ? '800' : '400',
                      }}
                    >
                      {value}
                    </Text>
                  </Action>
                ))}
              </View>
            ))}
          </View>
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
          <Action
            label={app.syncEnabled ? app.status : 'Saved on this phone'}
            onPress={() => {
              void app.engine.sync();
            }}
            disabled={!app.syncEnabled}
            style={{ borderWidth: 0, backgroundColor: theme.background }}
          />
        </View>
      </ScrollView>
      <Modal
        visible={app.needsConsent && !privacyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#0008',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 24,
              padding: 28,
              gap: 20,
            }}
          >
            <Text
              style={{ color: theme.text, fontSize: 24, fontWeight: '600' }}
            >
              Down & Up
            </Text>
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
          </View>
        </View>
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
