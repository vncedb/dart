// app.config.ts
import { ConfigContext, ExpoConfig } from 'expo/config';

// 1. Change this to 'dev', 'beta', or 'stable' to switch your environment globally
const APP_ENV = 'beta'; 

const ENV_CONFIG = {
  dev: {
    name: 'DART (Dev)',
    slug: 'dart-app-dev',
    package: 'com.projectvdb.dart.dev',
    scheme: 'dartappdev',
    version: '1.0.2-dev',
  },
  beta: {
    name: 'DART (Beta)',
    slug: 'dart-app-beta',
    package: 'com.projectvdb.dart.beta',
    scheme: 'dartappbeta',
    version: '1.0.2-beta',
  },
  stable: {
    name: 'DART',
    slug: 'dart-app',
    package: 'com.projectvdb.dart',
    scheme: 'dartapp',
    version: '1.0.2',
  }
};

const currentEnv = ENV_CONFIG[APP_ENV];

// 2. This function receives your existing app.json config
export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config, // Keeps all the static stuff from app.json (plugins, splash, icons, etc.)
    
    // Overwrite only the environment-specific variables
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