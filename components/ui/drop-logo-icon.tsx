import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { DropColors } from '@/constants/theme';

type DropLogoIconProps = {
  size?: number;
  active?: boolean;
};

export function DropLogoIcon({
  size = 24,
  active = false,
}: DropLogoIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 800 800"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="Drop"
      opacity={active ? 1 : 0.55}
    >
      <Path
        d="M222 184C222 166.327 236.327 152 254 152H414C568.64 152 666 247.667 666 400C666 552.333 568.64 648 414 648H254C236.327 648 222 633.673 222 616V184ZM302 232V568H414C520.4 568 586 504.533 586 400C586 295.467 520.4 232 414 232H302Z"
        fill={DropColors.warmWhite}
      />
      <Path
        d="M400 284C331.225 284 286 328.866 286 388.806C286 452.284 336.291 500.164 400 568C463.709 500.164 514 452.284 514 388.806C514 328.866 468.775 284 400 284Z"
        fill={DropColors.wine}
      />
    </Svg>
  );
}
