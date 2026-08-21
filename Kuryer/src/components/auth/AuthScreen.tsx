import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Button, Input } from '@/src/components/ui/Base';
import { AuthColumn, viewportFill } from '@/src/components/layout/AppFrame';
import { PhoneInputGroup } from '@/src/components/ui/PhoneInputGroup';
import { formatAuthError, useAuth } from '@/src/context/AuthContext';
import { toFullUzE164, UZ_NATIONAL_LEN } from '@/src/lib/phoneUz';
import { tw } from '@/src/lib/utils';

export function AuthScreen({ role }: { role: 'admin' | 'courier' }) {
  const { signInWithPassword } = useAuth();
  const { t } = useI18n();
  const [phoneNational, setPhoneNational] = useState(role === 'admin' ? '901111111' : '902222222');
  const [password, setPassword] = useState(role === 'admin' ? 'Admin123!' : 'Courier123!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    if (phoneNational.length < UZ_NATIONAL_LEN) {
      setError(t('auth_phoneBad'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(toFullUzE164(phoneNational), password, role);
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: '#0B3D2E' }, viewportFill]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <AuthColumn>
        <View style={tw`px-5 sm:px-7 pt-12 sm:pt-16 pb-8`}>
          <View style={tw`flex-row justify-between items-start`}>
            <AppIcon size={72} rounded={20} />
            <LangSwitch tone="dark" />
          </View>
          <Text style={tw`text-[11px] font-bold tracking-[3px] text-[#C4A35A] mt-6 uppercase`}>{t('brand')}</Text>
          <Text style={tw`text-2xl sm:text-3xl font-extrabold text-white mt-2 leading-9`}>
            {t('auth_courierHero')}
          </Text>
          <Text style={tw`text-[#D5E6DC] mt-3`}>{t('auth_courierHeroSub')}</Text>
        </View>
        <View style={[tw`flex-1 bg-[#F6F1E8] px-5 sm:px-6 pt-8 pb-12`, { borderTopLeftRadius: 32, borderTopRightRadius: 32 }]}>
          <Text style={tw`text-xl font-bold text-[#14221B] mb-6`}>{t('auth_courierLogin')}</Text>
          {error ? <Text style={tw`text-red-600 mb-4`}>{error}</Text> : null}
          <View style={tw`gap-4`}>
            <PhoneInputGroup label={t('common_phone')} valueNational={phoneNational} onChangeNational={setPhoneNational} />
            <Input label={t('common_password')} value={password} onChangeText={setPassword} secureTextEntry passwordToggle />
            <Button onPress={() => void login()} disabled={busy} size="lg">
              {busy ? t('common_loggingIn') : t('common_login')}
            </Button>
          </View>
        </View>
        </AuthColumn>
      </ScrollView>
    </View>
  );
}
