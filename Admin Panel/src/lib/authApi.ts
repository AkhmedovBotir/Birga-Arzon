import type { UserProfile } from '@/src/types';

export type AuthUser = UserProfile & {
  phoneMasked?: string;
  cityName?: string | null;
  mfyName?: string | null;
  profileCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
};
