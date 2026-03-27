// app.config.ts
import { ConfigContext, ExpoConfig } from 'expo/config';

const currentEnv = {
  name: 'DART',
  slug: 'dart-app',
  package: 'com.projectvdb.dart',
  scheme: 'dartapp',
  version: '1.0.5',
};

// This function receives your existing app.json config
export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config, // Keeps all the static stuff from app.json (plugins, splash, icons, etc.)
    
    // Overwrite with the strict production variables
    name: currentEnv.name,
    slug: currentEnv.slug,
    version: currentEnv.version,
    scheme: currentEnv.scheme,
    
    ios: {
      ...config.ios,
      bundleIdentifier: currentEnv.package,
    },
    
    android: {
      ...config.android,
      package: currentEnv.package,
    },
  } as ExpoConfig;
};