export const KEYPAD_GAP = 12;
export const KEY_LINE_HEIGHT = 44;

export function keypadLayout(fontScale: number) {
  const keyHeight = Math.max(64, Math.ceil(KEY_LINE_HEIGHT * fontScale + 20));
  return {
    keyHeight,
    rowsHeight: keyHeight * 3 + KEYPAD_GAP * 2,
    height: keyHeight * 4 + KEYPAD_GAP * 3,
  };
}
