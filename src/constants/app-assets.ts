/**
 * Bundled runtime UI assets only. Native icon and splash paths remain in app.json.
 * Use React Native Image for these critical local branding assets; expo-image remains
 * available for cached remote content such as future Storage-hosted pickup photos.
 */
export const APP_IMAGES = {
  logoLight: require('../../assets/images/procopper logo v1.png'),
  logoDark: require('../../assets/images/procopper logo v1 - dark bg 1.png'),
  symbol: require('../../assets/images/procopper - siteicon.png'),
} as const;
