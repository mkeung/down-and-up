import { View } from 'react-native';
import { Action } from './components';
import { PixelText } from './retro';
import { useTheme } from './theme';

export function ValueKeypad({
  value: selected,
  onChoose,
}: {
  value: number | null;
  onChoose: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {[[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]].map((row, index) => (
        <View
          key={index}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}
        >
          {row.map((value) => (
            <Action
              key={value}
              label={String(value)}
              selected={selected === value}
              showSelectionMark
              onPress={() => {
                if (selected !== value) onChoose(value);
              }}
              style={{
                width: '29%',
                minWidth: 64,
                minHeight: 80,
                paddingHorizontal: 10,
                paddingVertical: 16,
              }}
            >
              <PixelText
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{ fontSize: 36, color: theme.text }}
              >
                {value}
              </PixelText>
            </Action>
          ))}
        </View>
      ))}
    </View>
  );
}
