// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import {
  OpaqueColorValue,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type MaterialIconName =
  ComponentProps<typeof MaterialIcons>['name'];

const MAPPING = {
  // Tabs
  'safari.fill': 'explore',
  'magnifyingglass': 'search',
  'house.fill': 'home',
  'message.fill': 'chat-bubble',
  'bell.fill': 'notifications',
  'person.fill': 'person',

  // Other existing icons
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} satisfies Partial<
  Record<SymbolViewProps['name'], MaterialIconName>
>;

type IconSymbolName = keyof typeof MAPPING;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}