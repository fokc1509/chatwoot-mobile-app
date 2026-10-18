import { getAppVariant } from '../../../appVariant';

const production = {
  name: 'production',
  appName: 'Arqos Atendimento',
  appId: 'br.com.arqos.atendimento',
  scheme: 'arqosatendimento',
  isDev: false,
};

describe('getAppVariant', () => {
  it('returns the development variant for "development"', () => {
    expect(getAppVariant('development')).toEqual({
      name: 'development',
      appName: 'Arqos Atendimento (dev)',
      appId: 'br.com.arqos.atendimento.dev',
      scheme: 'arqosatendimento-dev',
      isDev: true,
    });
  });

  it('returns the production variant for "production"', () => {
    expect(getAppVariant('production')).toEqual(production);
  });

  it('returns the production variant when the value is undefined', () => {
    expect(getAppVariant(undefined)).toEqual(production);
  });

  it('returns the production variant for any other value', () => {
    expect(getAppVariant('foo')).toEqual(production);
  });
});
