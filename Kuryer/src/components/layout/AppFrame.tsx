import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { tw } from '@/src/lib/utils';

export const APP_MAX = 768;
export const AUTH_MAX = 480;

export const viewportFill: ViewStyle =
  Platform.OS === 'web'
    ? { height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }
    : { flex: 1 };

const colShadow: ViewStyle =
  Platform.OS === 'web'
    ? { boxShadow: '0 0 0 1px rgba(11,61,46,0.06), 0 24px 80px rgba(7,38,28,0.08)' }
    : {};

export function PageBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={[tw`flex-1`, { backgroundColor: '#ede6da' }, viewportFill]}>{children}</View>
  );
}

export function AppColumn({ children }: { children: ReactNode }) {
  return (
    <View
      style={[
        tw`flex-1 self-center w-full flex-col`,
        { maxWidth: APP_MAX, backgroundColor: '#fbf8f2' },
        viewportFill,
        colShadow,
      ]}
    >
      {children}
    </View>
  );
}

export function AuthColumn({ children }: { children: ReactNode }) {
  return (
    <View
      style={[
        tw`w-full flex-1 self-center`,
        { maxWidth: AUTH_MAX },
        Platform.OS === 'web' ? { minHeight: '100dvh', overflowY: 'auto' } : {},
      ]}
    >
      {children}
    </View>
  );
}

export const headerSafe: ViewStyle =
  Platform.OS === 'web'
    ? { paddingTop: 'max(1rem, env(safe-area-inset-top))' }
    : { paddingTop: 40 };

export const tabSafe: ViewStyle =
  Platform.OS === 'web'
    ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }
    : { paddingBottom: 8 };
