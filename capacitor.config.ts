import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xrupsarius.viewreader',
  appName: 'Читалка',
  webDir: 'dist-native',
  backgroundColor: '#f3f1ec',
  ios: { contentInset: 'never' },
};

export default config;
