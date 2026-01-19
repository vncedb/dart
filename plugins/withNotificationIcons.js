const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNotificationIcons = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      // 1. Source: Your Expo assets folder
      const sourceDir = path.join(projectRoot, 'assets/icons/notification');
      
      // 2. Destination: Android native resources
      const androidResDir = path.join(platformRoot, 'app/src/main/res/drawable');

      // Ensure destination exists
      if (!fs.existsSync(androidResDir)) {
        fs.mkdirSync(androidResDir, { recursive: true });
      }

      const icons = ['timer.png', 'play_circle.png', 'pause_circle.png', 'timeout.png'];

      console.log(`\n📢 [Notification Icons] Copying icons to: ${androidResDir}`);

      icons.forEach((icon) => {
        const sourceFile = path.join(sourceDir, icon);
        const destFile = path.join(androidResDir, icon);

        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, destFile);
          console.log(`   ✅ Copied ${icon}`);
        } else {
          console.error(`   ❌ MISSING: ${icon} (Expected at: ${sourceFile})`);
        }
      });
      console.log('\n');

      return config;
    },
  ]);
};

module.exports = withNotificationIcons;