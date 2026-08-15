import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    name: config.name ?? 'ProCopper Recycling',
    slug: config.slug ?? 'mobile',
    android: {
      ...(config.android ?? {}),
      googleServicesFile: './google-services.json',
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow ProCopper to use your location while viewing the Driver pickup map.',
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          motionUsagePermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
          isAndroidMotionActivityEnabled: false,
        },
      ],
      [
        'react-native-maps',
        androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {},
      ],
      [
        'expo-notifications',
        {
          defaultChannel: 'driver-jobs',
        },
      ],
    ],
  };
};
