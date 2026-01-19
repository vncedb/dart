const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNotificationIcons = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      // 1. Path to your assets in the Expo project
      const sourceDir = path.join(config.modRequest.projectRoot, 'assets/icons/notification');
      
      // 2. Path to the Android native drawable directory
      const androidResDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/drawable'
      );

      // Ensure directory exists (it usually does)
      if (!fs.existsSync(androidResDir)) {
        fs.mkdirSync(androidResDir, { recursive: true });
      }

      // 3. List of icons to copy
      const icons = ['timer.png', 'play_circle.png', 'pause_circle.png', 'timeout.png'];

      icons.forEach((icon) => {
        const sourceFile = path.join(sourceDir, icon);
        const destFile = path.join(androidResDir, icon);

        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, destFile);
          console.log(`✅ Copied ${icon} to Android drawable resources.`);
        } else {
          console.warn(`⚠️ Could not find ${icon} in ${sourceDir}`);
        }
      });

      return config;
    },
  ]);
};

module.exports = withNotificationIcons;