/** IDs preservados: projeto EAS e OAuth já existem. Staging substitui o mesmo app instalado. */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const environment = process.env.EXPO_PUBLIC_APP_ENV || 'development';
  const api = process.env.EXPO_PUBLIC_API_URL || '';
  if (profile && profile !== 'development') {
    const profileEnvironment = profile === 'production' ? 'production' : ['staging', 'testflight-staging'].includes(profile) ? 'staging' : null;
    if (environment !== profileEnvironment) throw new Error('Profile e ambiente divergentes.');
    const expected = environment === 'production'
      ? 'https://api.popularia.com.br/api/v1'
      : environment === 'staging' ? 'https://api-stg.popularia.com.br/api/v1' : null;
    if (!expected || api !== expected) throw new Error('Ambiente/API inválidos para build distribuível.');
    if (process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT !== environment) throw new Error('Ambiente Sentry divergente.');
  }
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClient ? `com.googleusercontent.apps.${iosClient.replace(/\.apps\.googleusercontent\.com$/, '')}` : null;
  return {
    ...config,
    name: environment === 'staging' ? 'Popularia Beta' : 'Popularia',
    ios: { ...config.ios, usesAppleSignIn: true, infoPlist: { ...config.ios?.infoPlist, NSAppTransportSecurity: { NSAllowsArbitraryLoads: false } } },
    android: {
      ...config.android,
      blockedPermissions: [
        'android.permission.RECORD_AUDIO', 'android.permission.CAMERA',
        'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS', 'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE',
        'com.google.android.gms.permission.AD_ID', 'android.permission.POST_NOTIFICATIONS',
      ],
    },
    plugins: config.plugins.map((plugin) => plugin === 'expo-secure-store' ? ['expo-secure-store', { faceIDPermission: false }] : Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin' && iosUrlScheme ? [plugin[0], { ...plugin[1], iosUrlScheme }] : plugin),
    extra: { ...config.extra, appEnvironment: environment },
  };
};
