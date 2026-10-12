import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];
import { Pressable, View } from 'react-native';
import { useTheme } from './theme';
import { PixelBackdrop, PixelText } from './retro';
import { PawsitiveIcon, RateIcon } from './tab-icons';
import { CerberusArtwork } from './cerberus-artwork';

export function RetroTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const route = state.routes[state.index]?.name;
  return (
    <View style={{ backgroundColor: theme.background }}>
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <CerberusArtwork visible={route === 'index' || route === 'pawsitive'} />
      </View>
      <View
        testID="retro-navigation-tabs"
        style={{
          backgroundColor: theme.chrome,
          borderTopWidth: 2,
          borderColor: theme.line,
          paddingTop: 12,
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
          paddingBottom: Math.max(insets.bottom, 12),
          flexDirection: 'row',
          gap: 12,
        }}
      >
        {state.routes
          .filter(
            (route) => route.name === 'index' || route.name === 'pawsitive',
          )
          .map((route) => {
            const selected = state.routes[state.index]?.key === route.key;
            const label = route.name === 'index' ? 'Rate' : 'Pawsitive';
            const Icon = route.name === 'index' ? RateIcon : PawsitiveIcon;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!selected && !event.defaultPrevented)
                    navigation.navigate(route.name, route.params);
                }}
                onLongPress={() =>
                  navigation.emit({ type: 'tabLongPress', target: route.key })
                }
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 76,
                  padding: 14,
                  gap: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <PixelBackdrop
                  selected={selected}
                  fill={selected ? theme.surface : theme.chrome}
                />
                <Icon color={selected ? theme.text : theme.muted} size={24} />
                <PixelText
                  style={{
                    color: selected ? theme.text : theme.muted,
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </PixelText>
                {selected ? (
                  <View
                    accessible={false}
                    style={{
                      height: 2,
                      width: 24,
                      backgroundColor: theme.text,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}
