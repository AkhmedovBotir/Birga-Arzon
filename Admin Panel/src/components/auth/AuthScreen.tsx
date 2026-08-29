import { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Button, Input } from '@/src/components/ui/Base';
import { formatAuthError, useAuth } from '@/src/context/AuthContext';
import { tw } from '@/src/lib/utils';

export function AuthScreen({ role }: { role: 'admin' | 'courier' }) {
  const { t } = useI18n();
  const { signInWithPassword } = useAuth();
  const [username, setUsername] = useState(role === 'admin' ? 'admin' : '');
  const [password, setPassword] = useState(role === 'admin' ? 'Admin123!' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const login = async () => {
    const loginName = username.trim();
    if (!loginName) {
      setError(t('auth_needUsername'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword({ username: loginName, password, role });
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const form = (showLang: boolean) => (
    <View style={tw`w-full max-w-[400px]`}>
      {showLang ? (
        <View style={tw`mb-6`}>
          <LangSwitch />
        </View>
      ) : null}
      <Text style={tw`text-[11px] font-bold tracking-[3px] text-[#C4A35A] uppercase mb-2`}>
        {t('title_adminPanel')}
      </Text>
      <Text style={tw`text-3xl font-extrabold text-[#14221B] mb-2`}>{t('auth_welcome')}</Text>
      <Text style={tw`text-[#5C6B63] mb-8`}>{t('auth_adminHint')}</Text>
      {error ? <Text style={tw`text-red-600 mb-4`}>{error}</Text> : null}
      <View style={tw`gap-4`}>
        <Input
          label={t('common_username')}
          value={username}
          onChangeText={setUsername}
          placeholder={t('auth_usernamePh')}
          autoFocus
        />
        <Input label={t('common_password')} value={password} onChangeText={setPassword} secureTextEntry passwordToggle />
        <Button onPress={() => void login()} disabled={busy} size="lg">
          {busy ? t('common_loggingIn') : t('common_login')}
        </Button>
      </View>
    </View>
  );

  if (Platform.OS === 'web' && wide) {
    return (
      <View style={[tw`flex-1 flex-row`, { minHeight: '100dvh', backgroundColor: '#F6F1E8' }]}>
        <View
          style={[
            tw`px-10 lg:px-14 py-12 lg:py-16 justify-between`,
            { backgroundColor: '#0B3D2E', width: '42%', maxWidth: 480, minWidth: 320 },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <AppIcon size={72} rounded={20} />
            <LangSwitch tone="dark" />
          </View>
          <View>
            <Text style={tw`text-[11px] font-bold tracking-[3px] text-[#C4A35A] uppercase`}>{t('brand')}</Text>
            <Text style={tw`text-3xl lg:text-4xl font-extrabold text-white mt-3 leading-10`}>
              {t('auth_heroTitle')}
            </Text>
            <Text style={tw`text-[#D5E6DC] mt-4 text-base leading-6 max-w-sm`}>
              {t('auth_heroSub')}
            </Text>
          </View>
          <Text style={tw`text-[#8FB5A3] text-sm`}>{t('auth_footer')}</Text>
        </View>
        <View style={[tw`flex-1 px-8 lg:px-16 py-10 justify-center min-w-0`]}>{form(false)}</View>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: '#0B3D2E' }, Platform.OS === 'web' ? { minHeight: '100dvh' } : {}]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 440, flexGrow: 1 }}>
          <View style={tw`px-5 sm:px-7 pt-12 sm:pt-16 pb-8`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <AppIcon size={72} rounded={20} />
              <LangSwitch tone="dark" />
            </View>
            <Text style={tw`text-[11px] font-bold tracking-[3px] text-[#C4A35A] mt-6 uppercase`}>{t('brand')}</Text>
            <Text style={tw`text-2xl sm:text-3xl font-extrabold text-white mt-2`}>{t('auth_mgmt')}</Text>
          </View>
          <View style={[tw`flex-1 bg-[#F6F1E8] px-5 sm:px-6 pt-8 pb-12`, { borderTopLeftRadius: 32, borderTopRightRadius: 32 }]}>
            {form(false)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
