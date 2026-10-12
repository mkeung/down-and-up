import { useState } from 'react';
import {
  ActivityIndicator,
  Switch,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Action } from './components';
import { PixelPanel, PixelText } from './retro';
import { useSoundPreference } from './sound-preference';
import { useTheme } from './theme';

export function SoundSettings() {
  const theme = useTheme();
  const sound = useSoundPreference();
  const [width, setWidth] = useState(0);
  const percent = Math.round(sound.volume * 100);
  const adjust = (event: GestureResponderEvent) => {
    if (width <= 24) return;
    sound.setVolume((event.nativeEvent.locationX - 12) / (width - 24));
  };
  return (
    <PixelPanel style={{ gap: 12 }}>
      <PixelText style={{ color: theme.text, fontSize: 20 }}>Sound</PixelText>
      {sound.ready ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16, flexShrink: 1 }}>
              Mute
            </Text>
            <Switch
              accessibilityLabel="Mute app sounds"
              value={sound.muted}
              onValueChange={sound.setMuted}
              trackColor={{ false: theme.line, true: theme.text }}
            />
          </View>
          <Text style={{ color: theme.text, fontSize: 16 }}>
            Volume · {percent}%
          </Text>
          <View
            testID="sound-volume-slider"
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Sound volume"
            accessibilityHint="Swipe up or down to adjust"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: percent,
              text: `${percent}%`,
            }}
            accessibilityActions={[
              { name: 'increment', label: 'Increase volume' },
              { name: 'decrement', label: 'Decrease volume' },
            ]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;
              if (action !== 'increment' && action !== 'decrement') return;
              sound.setVolume(
                sound.volume + (action === 'increment' ? 0.05 : -0.05),
              );
              sound.save();
            }}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => width > 24}
            onResponderGrant={adjust}
            onResponderMove={adjust}
            onResponderRelease={(event) => {
              adjust(event);
              sound.save();
            }}
            onResponderTerminate={sound.save}
            onResponderTerminationRequest={() => false}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <View
              pointerEvents="none"
              style={{
                height: 8,
                marginHorizontal: 12,
                backgroundColor: theme.line,
              }}
            >
              <View
                style={{
                  width: `${percent}%`,
                  height: 8,
                  backgroundColor: theme.text,
                }}
              />
            </View>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: Math.max(0, width - 24) * sound.volume,
                width: 24,
                height: 24,
                backgroundColor: theme.surface,
                borderWidth: 3,
                borderColor: theme.text,
              }}
            />
          </View>
          <Text style={{ color: theme.muted, fontSize: 16 }}>
            Button and animal sounds. Follows your phone’s silent mode.
          </Text>
          {sound.error && (
            <>
              <Text accessibilityRole="alert" style={{ color: theme.text }}>
                Could not save sound settings. Try again.
              </Text>
              <Action label="Retry sound settings" onPress={sound.save} />
            </>
          )}
        </>
      ) : (
        <ActivityIndicator
          accessibilityLabel="Loading sound settings"
          color={theme.text}
        />
      )}
    </PixelPanel>
  );
}
