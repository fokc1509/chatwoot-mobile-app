import Constants from 'expo-constants';

import { getAppIdentity } from '../appIdentity';
import { getAppVariant } from '../../../appVariant';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null },
}));

const mockedConstants = Constants as unknown as { expoConfig: unknown };

describe('getAppIdentity', () => {
  it('returns the variant exposed in extra.appVariant', () => {
    const dev = getAppVariant('development');
    mockedConstants.expoConfig = { extra: { appVariant: dev } };
    expect(getAppIdentity()).toEqual(dev);
  });

  it('falls back to production when expoConfig is null', () => {
    mockedConstants.expoConfig = null;
    expect(() => getAppIdentity()).not.toThrow();
    expect(getAppIdentity()).toEqual(getAppVariant(undefined));
    expect(getAppIdentity().isDev).toBe(false);
  });

  it('falls back to production when extra.appVariant is missing', () => {
    mockedConstants.expoConfig = { extra: {} };
    expect(getAppIdentity()).toEqual(getAppVariant(undefined));
  });
});
