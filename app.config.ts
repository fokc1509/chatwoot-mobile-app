// Expo transpiles only this file; this hook lets Node require the TypeScript module below.
// sucrase ships with @expo/config, which is always installed alongside expo.
import 'sucrase/register/ts';
import { ConfigContext, ExpoConfig } from 'expo/config';

import { getAppVariant } from './appVariant';

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = getAppVariant(process.env.APP_VARIANT);

  return {
    name: variant.appName,
    slug: 'arqos-atendimento',
    version: '4.4.0',
    orientation: 'portrait',
    icon: variant.isDev ? './assets/icon-dev.png' : './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: false,
    scheme: variant.scheme,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
      enableFullScreenImage_legacy: true,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: variant.appId,
      infoPlist: {
        NSCameraUsageDescription: 'O app usa a câmera para enviar fotos e vídeos nas conversas.',
        NSPhotoLibraryUsageDescription:
          'O app acessa a galeria de fotos para enviar imagens nas conversas.',
        NSMicrophoneUsageDescription: 'O app usa o microfone para gravar mensagens de áudio.',
        NSAppleMusicUsageDescription:
          'O app não usa o Apple Music, mas uma API do sistema pode exigir esta permissão.',
        UIBackgroundModes: ['fetch', 'remote-notification'],
        ITSAppUsesNonExemptEncryption: false,
      },
      // Please use the relative path to the google-services.json file
      googleServicesFile: process.env.EXPO_PUBLIC_IOS_GOOGLE_SERVICES_FILE,
      entitlements: { 'aps-environment': 'production' },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: variant.isDev
          ? './assets/adaptive-icon-dev.png'
          : './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: variant.appId,
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
      // Please use the relative path to the google-services.json file
      googleServicesFile: process.env.EXPO_PUBLIC_ANDROID_GOOGLE_SERVICES_FILE,
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            {
              scheme: variant.scheme,
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        storybookEnabled: process.env.EXPO_STORYBOOK_ENABLED,
      },
      appVariant: variant,
    },
    owner: process.env.EXPO_OWNER,
    plugins: [
      'expo-font',
      ['react-native-permissions', { iosPermissions: ['Camera', 'PhotoLibrary', 'MediaLibrary'] }],
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: process.env.EXPO_PUBLIC_SENTRY_PROJECT_NAME,
          organization: process.env.EXPO_PUBLIC_SENTRY_ORG_NAME,
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',
      [
        'expo-build-properties',
        {
          // https://github.com/invertase/notifee/issues/808#issuecomment-2175934609
          android: {
            minSdkVersion: 24,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            enableProguardInReleaseBuilds: true,
          },
          ios: { useFrameworks: 'static' },
        },
      ],
      './with-ffmpeg-pod.js',
    ],
    androidNavigationBar: { backgroundColor: '#ffffff' },
  };
};
