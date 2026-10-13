import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Down & Up',
  slug: 'down-and-up',
  scheme: 'down-up',
  version: '1.0.0',
  icon: './assets/icon.png',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.downandup.tracker',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'app.downandup.tracker',
    allowBackup: false,
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    ['expo-build-properties', { ios: { enableSceneSupport: true } }],
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    'expo-notifications',
    // Recording is deferred (docs/voice-recording.md), so no microphone access.
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f4f3ec',
        image: './assets/splash.png',
        imageWidth: 192,
        resizeMode: 'contain',
        dark: { backgroundColor: '#171e19' },
      },
    ],
  ],
  experiments: { typedRoutes: false },
};
export default config;
