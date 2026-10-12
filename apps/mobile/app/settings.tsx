import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  formatIdForDisplay,
  RECORDING_ENABLED,
  type Settings as ReminderSettings,
} from '@down-up/shared';
import { useApp, reportError } from '../src/app-context';
import { useTheme } from '../src/theme';
import { PrivacyNotice } from '../src/privacy-notice';
import { Action, Row } from '../src/components';
import { apiUrl } from '../src/transport';
import { shareLocalRecordings } from '../src/export-recordings';

export default function Settings() {
  const app = useApp();
  const theme = useTheme();
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void app.repo.reminder().then(setReminder).catch(reportError);
    void app.repo.state('last_synced_at').then(setLastSync).catch(reportError);
  }, [app.repo, app.revision]);
  const run = (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    void action()
      .catch(reportError)
      .finally(() => setBusy(false));
  };
  const chooseId = () => {
    Alert.alert(
      'Use this ID?',
      'The previous ID’s server data stays untouched. Delete it from the server first if you want it gone.',
      [
        { text: 'Cancel' },
        {
          text: 'Merge into this ID',
          onPress: () =>
            run(async () => {
              await app.adoptId(input, false);
              setEditing(false);
              setInput('');
            }),
        },
        {
          text: 'Discard local data',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await app.adoptId(input, true);
              setEditing(false);
              setInput('');
            }),
        },
      ],
    );
  };
  const remove = () =>
    Alert.alert(
      'Delete my data from the server?',
      'Server entries are removed immediately.',
      [
        { text: 'Cancel' },
        {
          text: 'Keep on this device',
          onPress: () => run(() => app.deleteData(false)),
        },
        {
          text: 'Also delete from this device',
          style: 'destructive',
          onPress: () => run(() => app.deleteData(true)),
        },
      ],
    );
  const exportFile = async () => {
    const path = `${FileSystem.cacheDirectory}down-and-up.csv`;
    await FileSystem.writeAsStringAsync(path, await app.repo.csv());
    if (await Sharing.isAvailableAsync())
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    else await Share.share({ message: await app.repo.csv() });
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 26 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: theme.text, fontSize: 30, fontWeight: '600' }}>
          Settings
        </Text>
        {app.needsIdentity && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: theme.text, fontSize: 18 }}>
              Enter your ID to keep syncing
            </Text>
            <Row>
              <Action label="Enter ID" onPress={() => setEditing(true)} />
              <Action
                label="Start new"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    'Start with a new ID?',
                    'Your local entries will sync to a new ID.',
                    [
                      { text: 'Cancel' },
                      { text: 'Start new', onPress: () => run(app.startNew) },
                    ],
                  )
                }
              />
            </Row>
          </View>
        )}
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.muted }}>Your ID</Text>
          <Text
            selectable
            style={{
              color: theme.text,
              fontSize: 26,
              letterSpacing: 2,
              fontWeight: '600',
            }}
          >
            {app.identity ? formatIdForDisplay(app.identity.id) : 'Sync is off'}
          </Text>
          {app.identity && !app.identity.registered && (
            <Text style={{ color: theme.muted }}>
              Not active on the web yet
            </Text>
          )}
          <Text style={{ color: theme.muted, fontSize: 16 }}>
            Write this down. It’s the only way to see your data on the web or
            move it to a new phone. A lost ID cannot be recovered.
          </Text>
          <Row>
            <Action
              label="Copy"
              disabled={!app.identity}
              onPress={() => {
                if (app.identity)
                  void Clipboard.setStringAsync(
                    formatIdForDisplay(app.identity.id),
                  );
              }}
            />
            <Action
              label="Share"
              disabled={!app.identity}
              onPress={() => {
                if (app.identity)
                  void Share.share({
                    message: formatIdForDisplay(app.identity.id),
                  });
              }}
            />
          </Row>
          <Action
            label="Use an existing ID"
            disabled={busy || !apiUrl()}
            onPress={() => setEditing(true)}
          />
          <Action
            label="Open web view"
            disabled={!apiUrl()}
            onPress={() => {
              if (apiUrl()) void Linking.openURL(apiUrl()!);
            }}
          />
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20 }}>Reminder</Text>
          <Text style={{ color: theme.muted }}>
            {!app.syncEnabled
              ? 'Turn on sync to set a reminder'
              : reminder?.reminderEnabled
                ? `Daily at ${reminder.reminderTime}`
                : 'Off'}
          </Text>
          <Text style={{ color: theme.muted }}>
            Set on the web, delivered in this phone’s local time.
          </Text>
          {app.blockedNotifications && (
            <>
              <Text style={{ color: theme.muted }}>
                Notifications are blocked
              </Text>
              <Action
                label="Open phone settings"
                onPress={() => {
                  void Linking.openSettings();
                }}
              />
            </>
          )}
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20 }}>Sync</Text>
          <Text style={{ color: theme.muted }}>
            {app.syncEnabled
              ? lastSync
                ? `Last synced ${new Date(Number(lastSync)).toLocaleString()}`
                : 'Not synced yet'
              : 'Sync is off'}
          </Text>
          {!apiUrl() && (
            <Text style={{ color: theme.muted }}>
              The server is not configured. Entries stay saved on this phone.
            </Text>
          )}
          <Action
            label={app.syncEnabled ? 'Sync now' : 'Start syncing'}
            disabled={busy || app.needsIdentity || !apiUrl()}
            onPress={() =>
              run(async () => {
                if (!app.syncEnabled) await app.setSync(true);
                await app.engine.sync();
              })
            }
          />
          {app.syncEnabled && (
            <Action
              label="Keep on this phone only"
              disabled={busy}
              onPress={() => run(() => app.setSync(false))}
            />
          )}
        </View>
        <Action
          label="Export CSV"
          disabled={busy}
          onPress={() => run(exportFile)}
        />
        {RECORDING_ENABLED && (
          <Action
            label="Share saved recordings"
            disabled={busy}
            onPress={() => run(() => shareLocalRecordings(app.repo))}
          />
        )}
        <Action
          label="Replace ID"
          disabled={busy || !app.syncEnabled || !app.identity?.registered}
          onPress={() =>
            Alert.alert(
              'Replace ID?',
              'Other phones and web sessions using your current ID will lose access. Your server data moves to a new ID.',
              [
                { text: 'Cancel' },
                { text: 'Replace', onPress: () => run(app.replaceId) },
              ],
            )
          }
        />
        <Action
          label="Delete my data from the server"
          disabled={busy || !app.syncEnabled || !app.identity?.registered}
          onPress={remove}
        />
        <Action
          label="Privacy policy"
          onPress={() => setPrivacyVisible(true)}
        />
      </ScrollView>
      <Modal
        visible={privacyVisible}
        animationType="slide"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <PrivacyNotice close={() => setPrivacyVisible(false)} />
      </Modal>
      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: '#0008',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              padding: 24,
              borderRadius: 20,
              gap: 20,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 22 }}>
              Enter your ID
            </Text>
            <TextInput
              accessibilityLabel="Existing ID"
              autoCapitalize="characters"
              autoCorrect={false}
              textContentType="none"
              value={input}
              onChangeText={setInput}
              maxLength={32}
              style={{
                color: theme.text,
                borderWidth: 1,
                borderColor: theme.line,
                padding: 16,
                borderRadius: 12,
                fontSize: 22,
              }}
            />
            <Action label="Continue" disabled={busy} onPress={chooseId} />
            <Action
              label="Cancel"
              disabled={busy}
              onPress={() => {
                setEditing(false);
                setInput('');
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
