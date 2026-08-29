import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LangSwitch, useI18n } from '@/src/i18n';
import { Button, Card, Input, Select } from '@/src/components/ui/Base';
import { LocationPicker } from '@/src/components/map/LocationPicker';
import { formatAuthError, useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { tw } from '@/src/lib/utils';
import type { City, Mfy, Region } from '@/src/types';
import { ScrollView, Text, View } from 'react-native';

export function OnboardingScreen() {
  const { t } = useI18n();
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [mfys, setMfys] = useState<Mfy[]>([]);
  const [regionId, setRegionId] = useState(user?.regionId || '');
  const [cityId, setCityId] = useState(user?.cityId || '');
  const [mfyId, setMfyId] = useState(user?.mfyId || '');
  const [lat, setLat] = useState(user?.deliveryLat?.toString() || '');
  const [lng, setLng] = useState(user?.deliveryLng?.toString() || '');
  const [address, setAddress] = useState(user?.deliveryAddress || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ items: Region[] }>('/api/regions').then((d) => setRegions(d.items || []));
  }, []);

  useEffect(() => {
    if (!regionId) {
      setCities([]);
      setCityId('');
      return;
    }
    void apiRequest<{ items: City[] }>(`/api/regions/${regionId}/cities`).then((d) => setCities(d.items || []));
  }, [regionId]);

  useEffect(() => {
    if (!cityId) {
      setMfys([]);
      setMfyId('');
      return;
    }
    void apiRequest<{ items: Mfy[] }>(`/api/cities/${cityId}/mfys`).then((d) => setMfys(d.items || []));
  }, [cityId]);

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !regionId || !cityId || !mfyId) {
      setError(t('onb_need'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        regionId,
        cityId,
        mfyId,
        deliveryLat: lat ? Number(lat) : null,
        deliveryLng: lng ? Number(lng) : null,
        deliveryAddress: address || null,
      });
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={tw`flex-1 bg-[#E8DFD0]`} contentContainerStyle={tw`px-4 sm:px-5 py-10 sm:py-12 items-center`}>
      <View style={{ width: '100%', maxWidth: 480 }}>
      <View style={tw`flex-row justify-end mb-4`}>
        <LangSwitch />
      </View>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Text style={tw`text-[11px] font-bold tracking-[3px] text-[#C4A35A] uppercase`}>{t('brand')}</Text>
        <Text style={tw`text-2xl font-extrabold text-[#14221B] mt-1 mb-1`}>{t('onb_title')}</Text>
        <Text style={tw`text-[#5C6B63] mb-6`}>{t('onb_hint')}</Text>
      </motion.div>
      {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}
      <Card>
        <View style={tw`gap-4`}>
          <Input label={t('common_firstName')} value={firstName} onChangeText={setFirstName} />
          <Input label={t('common_lastName')} value={lastName} onChangeText={setLastName} />
          <Select
            label={t('common_region')}
            value={regionId}
            onValueChange={(v) => setRegionId(v)}
            options={[{ label: t('common_select'), value: '' }, ...regions.map((c) => ({ label: c.name, value: c.id }))]}
          />
          <Select
            label={t('common_city')}
            value={cityId}
            onValueChange={(v) => setCityId(v)}
            options={[{ label: regionId ? t('common_select') : t('common_selectRegionFirst'), value: '' }, ...cities.map((c) => ({ label: c.name, value: c.id }))]}
          />
          <Select
            label={t('common_mfy')}
            value={mfyId}
            onValueChange={setMfyId}
            options={[{ label: cityId ? t('common_select') : t('common_selectCityFirst'), value: '' }, ...mfys.map((m) => ({ label: m.name, value: m.id }))]}
          />
          <LocationPicker
            lat={lat}
            lng={lng}
            address={address}
            onChange={(v) => {
              setLat(v.lat);
              setLng(v.lng);
              if (v.address) setAddress(v.address);
            }}
            onError={setError}
          />
          <Input label={t('onb_addr')} value={address} onChangeText={setAddress} placeholder={t('onb_street')} />
          <Button onPress={() => void save()} disabled={busy} size="lg">
            {busy ? t('common_saving') : t('common_continue')}
          </Button>
        </View>
      </Card>
      </View>
    </ScrollView>
  );
}
