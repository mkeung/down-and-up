import { Text, useColorScheme, View } from 'react-native';
import { FeedbackPressable } from './feedback-pressable';
import { reportError } from './app-context';
import { useTheme } from './theme';
import { useThemePreference } from './theme-preference';
import { THEME_OPTIONS, themeColors } from './themes';
import { PixelBackdrop, PixelText } from './retro';

export function ThemePicker() {
  const preference = useThemePreference();
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <View style={{ gap: 12 }}>
      <PixelText style={{ color: theme.text, fontSize: 18 }}>
        Theme color
      </PixelText>
      <Text style={{ color: theme.muted, fontSize: 16 }}>
        Choose a color. Light and dark follow your phone.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {THEME_OPTIONS.map(({ id, label }) => {
          const preview = themeColors(id, dark);
          const selected = preference.id === id;
          return (
            <FeedbackPressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={`${label} theme`}
              accessibilityState={{
                checked: selected,
                selected,
                disabled: preference.saving,
              }}
              disabled={preference.saving}
              onPress={() => {
                void preference.choose(id).catch(reportError);
              }}
              style={{
                flexGrow: 1,
                flexBasis: '45%',
                minWidth: 128,
                minHeight: 104,
                padding: 12,
                gap: 10,
                paddingBottom: 16,
              }}
            >
              <PixelBackdrop selected={selected} />
              <View
                accessible={false}
                style={{
                  height: 40,
                  padding: 6,
                  gap: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: preview.background,
                  borderWidth: 1,
                  borderColor: theme.line,
                }}
              >
                {[0, 1, 2].map((key) => (
                  <View
                    key={key}
                    style={{
                      width: 20,
                      height: 24,
                      borderWidth: 2,
                      borderColor: preview.line,
                      backgroundColor: preview.surface,
                    }}
                  />
                ))}
              </View>
              <Text
                style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}
              >
                {label}
                {selected ? ' ✓' : ''}
              </Text>
            </FeedbackPressable>
          );
        })}
      </View>
    </View>
  );
}
