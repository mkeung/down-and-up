import type { ColorValue } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
type IconProps = { color: ColorValue; size: number };
export function RateIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[5, 12, 19].flatMap((cy) =>
        [5, 12, 19].map((cx) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill={color} />
        )),
      )}
    </Svg>
  );
}
export function PawsitiveIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={5} cy={10} rx={2} ry={2.6} fill={color} />
      <Ellipse cx={9.2} cy={5.4} rx={2} ry={2.6} fill={color} />
      <Ellipse cx={14.8} cy={5.4} rx={2} ry={2.6} fill={color} />
      <Ellipse cx={19} cy={10} rx={2} ry={2.6} fill={color} />
      <Path
        d="M12 11c-2.6 0-6 3.6-6 6.6 0 1.9 1.4 2.9 3.1 2.9 1.2 0 1.9-.6 2.9-.6s1.7.6 2.9.6c1.7 0 3.1-1 3.1-2.9 0-3-3.4-6.6-6-6.6z"
        fill={color}
      />
    </Svg>
  );
}
