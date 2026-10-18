// Pure module: evaluated by app.config.ts in Node, so it must not import React Native or Expo.

export type AppVariantName = 'development' | 'production';

export interface AppVariant {
  name: AppVariantName;
  appName: string;
  appId: string;
  scheme: string;
  isDev: boolean;
}

const VARIANTS: Record<AppVariantName, AppVariant> = {
  development: {
    name: 'development',
    appName: 'Arqos Atendimento (dev)',
    appId: 'br.com.arqos.atendimento.dev',
    scheme: 'arqosatendimento-dev',
    isDev: true,
  },
  production: {
    name: 'production',
    appName: 'Arqos Atendimento',
    appId: 'br.com.arqos.atendimento',
    scheme: 'arqosatendimento',
    isDev: false,
  },
};

// Any value other than 'development' resolves to production.
export function getAppVariant(value: string | undefined): AppVariant {
  const name: AppVariantName = value === 'development' ? 'development' : 'production';
  return { ...VARIANTS[name] };
}
