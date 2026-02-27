const { withDangerousMod, withProjectBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// 1. Copies the custom Notification Icons
const withIcons = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const androidResDir = path.join(platformRoot, 'app/src/main/res/drawable');

      console.log(`\n🔔 [Notification Setup] Syncing resources & Gradle...`);

      if (!fs.existsSync(androidResDir)) {
        fs.mkdirSync(androidResDir, { recursive: true });
      }

      const iconSourceDir = path.join(projectRoot, 'assets/icons/notification');
      const iconsToCopy = [
        'ic_timer_large.png',
        'ic_timer_small.png',
        'ic_pause.png',
        'ic_resume.png',
        'ic_timeout.png'
      ];

      iconsToCopy.forEach((fileName) => {
        const sourceFile = path.join(iconSourceDir, fileName);
        const destFile = path.join(androidResDir, fileName);

        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, destFile);
          console.log(`   ✅ Copied Icon: ${fileName}`);
        } else {
          console.log(`   ⚠️ Skipped (Source missing): ${fileName}`);
        }
      });

      return config;
    },
  ]);
};

// 2. Injects the Notifee local Maven repository into Android's build.gradle
const withNotifeeMaven = (config) => {
  return withProjectBuildGradle(config, async (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradle = config.modResults.contents;
      const notifeeMaven = `maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`;

      // Check if it's already injected to prevent duplicates
      if (!buildGradle.includes('@notifee/react-native/android/libs')) {
        // Inject it right under 'allprojects { repositories {'
        buildGradle = buildGradle.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {\n    repositories {\n        ${notifeeMaven}`
        );
        config.modResults.contents = buildGradle;
        console.log(`   ✅ Injected Notifee Maven URL into build.gradle`);
      }
    }
    return config;
  });
};

// Export the combined plugin
module.exports = (config) => {
  config = withIcons(config);
  config = withNotifeeMaven(config);
  return config;
};