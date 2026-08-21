import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { Button, Input } from '@/src/components/ui/Base';
import { OtpBoxes } from '@/src/components/ui/OtpBoxes';
import { AuthColumn, viewportFill } from '@/src/components/layout/AppFrame';
import { PhoneInputGroup } from '@/src/components/ui/PhoneInputGroup';
import { formatAuthError, useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { toFullUzE164, UZ_NATIONAL_LEN } from '@/src/lib/phoneUz';
import { tw } from '@/src/lib/utils';

type Step = 'phone' | 'code' | 'name';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        requestContact?: (cb: (ok: boolean) => void) => void;
        onEvent?: (ev: string, cb: (data: { responseUnsafe?: { contact?: { phone_number?: string; first_name?: string; last_name?: string } } }) => void) => void;
        initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string } };
      };
    };
  }
}

export function AuthScreen() {
  const { t } = useI18n();
  const { signInWithSMS, signInTelegram } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNational, setPhoneNational] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tg, setTg] = useState(false);

  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
    if (!w) return;
    w.ready();
    setTg(true);
    w.onEvent?.('contactRequested', (data) => {
      const c = data.responseUnsafe?.contact;
      if (!c?.phone_number) return;
      void signInTelegram({
        phone: c.phone_number,
        telegramId: w.initDataUnsafe?.user?.id,
        firstName: c.first_name,
        lastName: c.last_name,
      }).catch((e) => setError(formatAuthError(e)));
    });
  }, [signInTelegram]);

  const requestCode = useCallback(async () => {
    if (phoneNational.length < UZ_NATIONAL_LEN) {
      setError(t('auth_phoneLen'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/auth/sms/request', { method: 'POST', body: { phone: toFullUzE164(phoneNational) } });
      setCode('');
      setStep('code');
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }, [phoneNational, t]);

  const verifyCode = useCallback(async () => {
    if (code.length < 5) {
      setError(t('auth_enterCode'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithSMS(toFullUzE164(phoneNational), code);
      if (result === 'needsProfile') {
        setFirstName('');
        setLastName('');
        setStep('name');
      }
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }, [code, phoneNational, signInWithSMS, t]);

  const submitName = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('auth_needName'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithSMS(toFullUzE164(phoneNational), code, firstName.trim(), lastName.trim());
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }, [code, firstName, lastName, phoneNational, signInWithSMS, t]);

  const title =
    step === 'phone' ? t('common_login') : step === 'code' ? t('auth_verify') : t('auth_nameTitle');
  const hint =
    step === 'phone' ? t('auth_enterPhone') : step === 'code' ? t('auth_demoCode') : t('auth_nameHint');

  return (
    <View style={[tw`flex-1`, { backgroundColor: '#0B3D2E' }, viewportFill]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <AuthColumn>
        <View style={tw`px-5 sm:px-7 pt-12 sm:pt-16 pb-8 sm:pb-10`}>
          <View style={tw`flex-row justify-end mb-4`}>
            <LangSwitch tone="dark" />
          </View>
          <AppIcon size={72} rounded={20} />
          <Text style={tw`text-[11px] font-bold tracking-[3px] text-[#C4A35A] mt-6 uppercase`}>{t('brand')}</Text>
          <Text style={tw`text-3xl font-extrabold text-white mt-2 leading-9`}>
            {t('auth_customerHero')}
          </Text>
          <Text style={tw`text-[#D5E6DC] mt-3 text-[15px] leading-6 max-w-sm`}>
            {t('auth_customerSub')}
          </Text>
        </View>

        <View style={[tw`flex-1 bg-[#F6F1E8] px-5 sm:px-6 pt-8 pb-12`, { borderTopLeftRadius: 32, borderTopRightRadius: 32, minHeight: 420 }]}>
          <Text style={tw`text-[11px] font-bold tracking-[2px] text-[#C4A35A] uppercase mb-2`}>
            {step === 'phone' ? '1 / 3' : step === 'code' ? '2 / 3' : '3 / 3'}
          </Text>
          <Text style={tw`text-xl font-bold text-[#14221B] mb-1`}>{title}</Text>
          <Text style={tw`text-[#5C6B63] mb-6`}>{hint}</Text>
          {error ? <Text style={tw`text-sm text-red-600 mb-4`}>{error}</Text> : null}

          {step === 'phone' ? (
            <View style={tw`gap-5`}>
              <PhoneInputGroup label={t('common_phone')} valueNational={phoneNational} onChangeNational={setPhoneNational} autoFocus />
              <Button onPress={() => void requestCode()} disabled={busy} size="lg" className="w-full rounded-2xl">
                {busy ? t('common_sending') : t('auth_continue')}
              </Button>
              {tg ? (
                <Button variant="secondary" onPress={() => window.Telegram?.WebApp?.requestContact?.(() => undefined)} className="w-full">
                  {t('auth_tgContact')}
                </Button>
              ) : null}
            </View>
          ) : null}

          {step === 'code' ? (
            <View style={tw`gap-4`}>
              <OtpBoxes label={t('auth_codeLabel')} value={code} onChange={setCode} autoFocus />
              <Button onPress={() => void verifyCode()} disabled={busy} size="lg">
                {busy ? t('common_checking') : t('auth_continue')}
              </Button>
              <Button variant="ghost" onPress={() => { setStep('phone'); setError(null); }}>{t('common_back')}</Button>
            </View>
          ) : null}

          {step === 'name' ? (
            <View style={tw`gap-4`}>
              <Input label={t('common_firstName')} value={firstName} onChangeText={setFirstName} placeholder={t('common_firstName')} autoFocus />
              <Input label={t('common_lastName')} value={lastName} onChangeText={setLastName} placeholder={t('common_lastName')} />
              <Button onPress={() => void submitName()} disabled={busy} size="lg">
                {busy ? t('common_checking') : t('auth_signIn')}
              </Button>
              <Button variant="ghost" onPress={() => { setStep('code'); setError(null); }}>{t('common_back')}</Button>
            </View>
          ) : null}
        </View>
        </AuthColumn>
      </ScrollView>
    </View>
  );
}
