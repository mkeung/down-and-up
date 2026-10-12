import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Action } from './components';
import { PixelText } from './retro';
import { useTheme } from './theme';
import { KEYPAD_GAP, KEY_LINE_HEIGHT, keypadLayout } from './entry-layout';

type KeypadProps = {
  value: number | null;
  onChoose: (value: number) => void;
};

function ValueKey({
  number,
  value: selected,
  onChoose,
  keyHeight,
}: KeypadProps & { number: number; keyHeight: number }) {
  const theme = useTheme();
  return (
    <Action
      label={String(number)}
      selected={selected === number}
      showSelectionMark
      onPress={() => {
        if (selected !== number) onChoose(number);
      }}
      style={{
        width: '29%',
        minWidth: 64,
        minHeight: 64,
        height: keyHeight,
        paddingHorizontal: 10,
        paddingVertical: 10,
      }}
    >
      <PixelText
        font="Silkscreen"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{ fontSize: 36, lineHeight: KEY_LINE_HEIGHT, color: theme.text }}
      >
        {number}
      </PixelText>
    </Action>
  );
}

function ValueTenButton(props: KeypadProps & { keyHeight: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: KEYPAD_GAP,
        flexShrink: 0,
      }}
    >
      <ValueKey {...props} number={10} />
    </View>
  );
}

export function ValueKeypad({
  value,
  onChoose,
  scrollRows = false,
}: KeypadProps & {
  scrollRows?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const layout = keypadLayout(fontScale);
  const rows = (
    <View style={{ gap: KEYPAD_GAP }}>
      {[
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ].map((row, index) => (
        <View
          key={index}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}
        >
          {row.map((number) => (
            <ValueKey
              key={number}
              number={number}
              value={value}
              onChoose={onChoose}
              keyHeight={layout.keyHeight}
            />
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View
      testID="value-keypad"
      style={{ height: layout.height, gap: KEYPAD_GAP, flexShrink: 1 }}
    >
      {scrollRows ? (
        <ScrollView
          testID="value-keypad-upper-rows"
          style={{
            height: layout.rowsHeight,
            flexShrink: 1,
            minHeight: 64,
            overflow: 'hidden',
          }}
          bounces={false}
        >
          {rows}
        </ScrollView>
      ) : (
        rows
      )}
      <ValueTenButton
        value={value}
        onChoose={onChoose}
        keyHeight={layout.keyHeight}
      />
    </View>
  );
}
