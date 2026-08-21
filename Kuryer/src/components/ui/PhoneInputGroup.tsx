import { View, Text, TextInput } from 'react-native';
import { tw } from '@/src/lib/utils';
import { formatNationalDisplay, UZ_NATIONAL_LEN, digitsOnly } from '@/src/lib/phoneUz';

type PhoneInputGroupProps = {
  label?: string;
  valueNational: string;
  onChangeNational: (nationalDigits: string) => void;
  autoFocus?: boolean;
  inputClassName?: string;
};

export function PhoneInputGroup({
  label,
  valueNational,
  onChangeNational,
  autoFocus,
  inputClassName = '',
}: PhoneInputGroupProps) {
  const display = formatNationalDisplay(valueNational);

  return (
    <View style={tw`w-full gap-1.5`}>
      {label ? (
        <Text style={tw`text-xs font-semibold text-[#5C6B63] ml-1 uppercase tracking-wider`}>{label}</Text>
      ) : null}
      <View
        style={tw`flex-row items-stretch w-full bg-[#F6F1E8] border border-[#E8DFD0] rounded-2xl overflow-hidden min-h-[56px]`}
      >
        <View style={tw`px-3.5 justify-center bg-[#0B3D2E]`}>
          <Text style={tw`text-base font-semibold text-[#F6F1E8] tracking-tight`}>+998</Text>
        </View>
        <TextInput
          style={[
            tw`flex-1 px-3 py-4 text-base text-[#14221B] min-w-0`,
            tw`${inputClassName}`,
          ]}
          value={display}
          onChangeText={(t) => {
            const next = digitsOnly(t).slice(0, UZ_NATIONAL_LEN);
            onChangeNational(next);
          }}
          placeholder="90 123 45 67"
          placeholderTextColor="#9AA59D"
          keyboardType="phone-pad"
          autoFocus={autoFocus}
          autoComplete="tel-national"
        />
      </View>
    </View>
  );
}
