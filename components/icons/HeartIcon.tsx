import Svg, { Path } from 'react-native-svg';

type HeartIconProps = {
  liked?: boolean;
  size?: number;
};

export function HeartIcon({
  liked = false,
  size = 20,
}: HeartIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 92"
    >
      <Path
        d="M50 88 C46 83 9 59 9 30 C9 14 20 5 33 5 C41 5 47 9 50 16 C53 9 59 5 67 5 C80 5 91 14 91 30 C91 59 54 83 50 88Z"
        fill={
          liked
            ? '#7D0D0D'
            : '#FFF2E4'
        }
      />
    </Svg>
  );
}