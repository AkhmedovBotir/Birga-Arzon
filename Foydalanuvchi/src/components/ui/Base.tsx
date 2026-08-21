import * as React from 'react';
import { View, Text, TouchableOpacity, TextInput, ViewStyle, Platform, Pressable, ScrollView, Modal } from 'react-native';
import { Check, ChevronDown, Eye, EyeOff, Search } from 'lucide-react-native';
import { tStatic } from '@/src/i18n';
import { tw, cn, cardShadowStyle } from '@/src/lib/utils';

export type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  key?: React.Key;
};

export function Card({ children, className, title, subtitle, style }: CardProps) {
  return (
    <View style={[tw`bg-white rounded-3xl p-7 border border-[#E8DFD0]`, cardShadowStyle(), tw`${className || ''}`, style]}>
      {(title || subtitle) && (
        <View style={tw`mb-4`}>
          {title && <Text style={tw`text-lg font-semibold text-gray-900 tracking-tight`}>{title}</Text>}
          {subtitle && <Text style={tw`text-sm text-gray-500`}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}

export type ButtonProps = {
  onPress?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  key?: React.Key;
};

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  children,
  onPress,
  disabled,
  style
}: ButtonProps) {
  const variants = {
    primary: 'bg-[#0B3D2E] border border-[#07261c]',
    secondary: 'bg-[#F4EAD4] border border-[#C4A35A]/35',
    outline: 'border border-gray-200 bg-white',
    ghost: 'bg-transparent',
  };

  const textVariants = {
    primary: 'text-white',
    secondary: 'text-[#0B3D2E]',
    outline: 'text-gray-700',
    ghost: 'text-gray-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5',
    md: 'px-6 py-3',
    lg: 'px-8 py-4',
    icon: 'p-3 rounded-full',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'font-medium',
    lg: 'text-lg font-semibold',
    icon: '',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        tw`flex flex-row items-center justify-center rounded-2xl ${variants[variant]} ${sizes[size]} ${className || ''}`,
        disabled ? tw`opacity-50` : {},
        style
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={tw`${textVariants[variant]} ${textSizes[size]}`}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

export type InputProps = {
  label?: string;
  className?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  /** secureTextEntry bilan: ko‘zcha tugmasi */
  passwordToggle?: boolean;
  autoFocus?: boolean;
  type?: string;
  editable?: boolean;
};

export function Input({ label, className, type, passwordToggle, secureTextEntry, ...props }: InputProps) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const showToggle = Boolean(passwordToggle && secureTextEntry);
  const hidden = secureTextEntry && !passwordVisible;

  if (type === 'date' && Platform.OS === 'web') {
    const { value, onChangeText, placeholder, editable, autoFocus } = props;
    return (
    <View style={tw`w-full flex flex-col gap-1.5`}>
      {label ? <Text style={tw`text-sm font-medium text-gray-700 ml-1`}>{label}</Text> : null}
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChangeText?.(e.currentTarget.value)}
          placeholder={placeholder}
          disabled={editable === false}
          autoFocus={autoFocus}
          className={cn(
            'w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-base box-border min-h-[52px]',
            'text-gray-900 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-kletka-blue-100 focus:border-kletka-blue-600',
            className,
          )}
        />
      </View>
    );
  }

  const textInputType = type === 'date' ? undefined : type;

  return (
    <View style={tw`w-full flex flex-col gap-1.5`}>
      {label && <Text style={tw`text-sm font-medium text-gray-700 ml-1`}>{label}</Text>}
      {showToggle ? (
        <View
          style={tw`flex-row items-center w-full bg-gray-50 border border-gray-100 rounded-2xl min-h-[52px] pr-1`}
        >
          <TextInput
            style={[
              tw`flex-1 px-4 py-3 text-base text-gray-900 min-w-0`,
              tw`${className || ''}`,
            ]}
            placeholderTextColor="#9AA59D"
            secureTextEntry={hidden}
            {...(textInputType ? { type: textInputType } : {})}
            {...props}
          />
          <TouchableOpacity
            onPress={() => setPasswordVisible((v) => !v)}
            style={tw`p-3 rounded-xl`}
            accessibilityLabel={passwordVisible ? tStatic('common_hidePassword') : tStatic('common_showPassword')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {passwordVisible ? (
              <EyeOff size={22} color="#6b7280" />
            ) : (
              <Eye size={22} color="#6b7280" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={[
            tw`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl`,
            tw`${className || ''}`,
          ]}
          placeholderTextColor="#9AA59D"
          secureTextEntry={secureTextEntry}
          {...(textInputType ? { type: textInputType } : {})}
          {...props}
        />
      )}
    </View>
  );
}

export type SelectProps = {
  label?: string;
  options: { label: string; value: string }[];
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function Select({ label, options, className, value, onValueChange }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <View style={tw`w-full flex flex-col gap-1.5`}>
      {label ? <Text style={tw`text-sm font-medium text-gray-700 ml-1`}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          tw`flex-row items-center justify-between w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl min-h-[52px]`,
          tw`${className || ''}`,
        ]}
      >
        <Text style={tw`flex-1 text-base ${selected?.value ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
          {selected?.label || tStatic('common_select')}
        </Text>
        <ChevronDown size={18} color="#5C6B63" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => {
            setOpen(false);
            setQuery('');
          }}
          style={{ flex: 1, backgroundColor: 'rgba(7,38,28,0.4)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: 'center', padding: 12 }}
        >
          <Pressable
            onPress={() => undefined}
            style={[tw`bg-white rounded-3xl overflow-hidden w-full`, { maxHeight: '72%', maxWidth: 480 }]}
          >
            <View style={tw`px-5 pt-4 pb-2 flex-row items-center justify-between`}>
              <Text style={tw`text-lg font-extrabold text-[#14221B]`}>{label || tStatic('common_select')}</Text>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  setQuery('');
                }}
                style={tw`w-9 h-9 rounded-xl bg-[#F6F1E8] items-center justify-center`}
              >
                <Text style={tw`text-[#5C6B63] font-bold`}>×</Text>
              </Pressable>
            </View>
            {options.length > 7 ? (
              <View style={tw`mx-4 mb-2 flex-row items-center px-3 bg-[#F8F4EC] rounded-xl min-h-[44px]`}>
                <Search size={16} color="#8A968E" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={tStatic('common_search')}
                  placeholderTextColor="#9AA59D"
                  style={tw`flex-1 px-2 py-2 text-base text-[#14221B]`}
                  autoFocus
                />
              </View>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
              {filtered.map((opt) => {
                const on = opt.value === value;
                return (
                  <Pressable
                    key={opt.value || opt.label}
                    onPress={() => {
                      onValueChange?.(opt.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={[
                      tw`flex-row items-center justify-between px-5 py-3.5 border-t border-[#F0E8D8]`,
                      { backgroundColor: on ? '#E3F4EA' : '#fff' },
                    ]}
                  >
                    <Text style={tw`${on ? 'font-bold text-[#0B3D2E]' : 'text-[#14221B]'}`}>{opt.label}</Text>
                    {on ? <Check size={18} color="#0B3D2E" /> : null}
                  </Pressable>
                );
              })}
              {filtered.length === 0 ? (
                <Text style={tw`px-5 py-4 text-[#8A968E]`}>{tStatic('common_select')}</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
