import Constants from 'expo-constants';

import { AppVariant, getAppVariant } from '../../appVariant';

// Reads the variant exposed by app.config.ts (extra.appVariant). When it is missing
// (Jest, Storybook, broken config) the app behaves as production.
export function getAppIdentity(): AppVariant {
  const appVariant = Constants?.expoConfig?.extra?.appVariant as Partial<AppVariant> | undefined;
  return getAppVariant(appVariant?.name);
}
