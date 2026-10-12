import { ScrollView, Text, View } from 'react-native';
import { Action } from './components';
import { useTheme } from './theme';
import { PixelText } from './retro';
export function PrivacyNotice({ close }: { close: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 30,
      }}
    >
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
        <PixelText style={{ color: theme.text, fontSize: 28 }}>
          Privacy
        </PixelText>
        <Text style={{ color: theme.text, fontSize: 17 }}>
          Values and notes are saved on this phone. When sync is on, they are
          copied to our server with your ID so you can view them on the web and
          restore them on another phone.
        </Text>
        <Text style={{ color: theme.text, fontSize: 17 }}>
          Choose “Keep on this phone only” to stop sync. Your entries remain
          available without a connection. There are no advertising or tracking
          SDKs, and no name, email, or password is needed.
        </Text>
        <Text style={{ color: theme.text, fontSize: 17 }}>
          Anyone with your ID can access your entries. Keep it private. You can
          replace it in Settings. A lost ID cannot be recovered.
        </Text>
        <Text style={{ color: theme.text, fontSize: 17 }}>
          In Settings, you can export your entries or delete server data. After
          deleting server data, you can keep entries on this phone with sync off
          or delete them here too.
        </Text>
        <Text style={{ color: theme.muted, fontSize: 16 }}>
          The full service policy, including storage providers, retention, and
          contact details, is available on the website when web access is
          configured.
        </Text>
      </ScrollView>
      <Action label="Close" onPress={close} />
    </View>
  );
}
