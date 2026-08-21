import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { tw } from '@/src/lib/utils';

export const APP_MAX = 1100;
export const AUTH_MAX = 480;

export const viewportFill: ViewStyle =
  Platform.OS === 'web' ? { minHeight: '100dvh' } : { flex: 1 };

const colShadow: ViewStyle =
  Platform.OS === 'web'
    ? { boxShadow: '0 0 0 1px rgba(11,61,46,0.06), 0 24px 80px rgba(7,38,28,0.08)' }
    : {};

export function PageBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={[tw`flex-1`, { backgroundColor: '#E8DFD0' }, viewportFill]}>{children}</View>
  );
}

export function AppColumn({ children }: { children: ReactNode }) {
  return (
    <View
      style={[
        tw`flex-1 self-center w-full`,
        { maxWidth: APP_MAX, backgroundColor: '#F6F1E8' },
        viewportFill,
        colShadow,
      ]}
    >
      {children}
    </View>
  );
}

export function AuthColumn({ children }: { children: ReactNode }) {
  return <View style={[tw`w-full flex-1 self-center`, { maxWidth: AUTH_MAX }]}>{children}</View>;
}

export const headerSafe: ViewStyle =
  Platform.OS === 'web'
    ? { paddingTop: 'max(2.75rem, env(safe-area-inset-top))' }
    : { paddingTop: 48 };

export const tabSafe: ViewStyle =
  Platform.OS === 'web'
    ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }
    : { paddingBottom: 8 };
