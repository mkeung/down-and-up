import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
type IconProps = { color: ColorValue; size: number };
export function RateIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {[2, 10, 18].flatMap((y) =>
        [2, 10, 18].map((x) => (
          <Path key={`${x}-${y}`} d={`M${x} ${y}h4v4h-4z`} fill={color} />
        )),
      )}
    </Svg>
  );
}
export function PawsitiveIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M2 7h4v6H2z M7 2h4v6H7z M13 2h4v6h-4z M18 7h4v6h-4z M9 11h6v2h2v2h2v6h-4v-2H9v2H5v-6h2v-2h2z"
        fill={color}
      />
    </Svg>
  );
}
