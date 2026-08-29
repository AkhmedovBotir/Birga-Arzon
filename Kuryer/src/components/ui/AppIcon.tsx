import { tStatic } from '@/src/i18n';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { tw } from '@/src/lib/utils';

type AppIconProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  rounded?: number;
};

export function AppIcon({ size = 72, style, containerStyle, rounded = 20 }: AppIconProps) {
  return (
    <View
      style={[
        tw`items-center justify-center overflow-hidden`,
        {
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: '#0B3D2E',
          boxShadow: '0 12px 28px rgba(11, 61, 46, 0.28)',
        } as ViewStyle,
        containerStyle,
      ]}
    >
      <Image
        source={{ uri: '/icon.png' }}
        style={[{ width: size, height: size }, style]}
        resizeMode="cover"
        accessibilityLabel={tStatic('brand')}
      />
    </View>
  );
}
