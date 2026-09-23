import colors from './src/theme/colors.json';

import type { ExpoConfig } from 'expo/config';


const config: ExpoConfig = {
  name: 'Academia',
  slug: 'academia-familia',
  version: '0.1.0',
  scheme: 'academia-familia',
  orientation: 'portrait',
  platforms: ['android', 'ios'],
  userInterfaceStyle: 'dark',
  backgroundColor: colors.background,
  ios: { supportsTablet: false },
  android: { predictiveBackGestureEnabled: true },
  androidStatusBar: { barStyle: 'light-content', backgroundColor: colors.background },
  plugins: ['expo-router', 'expo-sqlite', 'expo-font'],
  experiments: { typedRoutes: true },
};

export default config;
