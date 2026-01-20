const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNotificationIcons = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      // Source: Expo assets folder
      const sourceDir = path.join(projectRoot, 'assets/icons/notification');
      
      // Destination: Android native resources
      const androidResDir = path.join(platformRoot, 'app/src/main/res/drawable');

      // Ensure destination exists
      if (!fs.existsSync(androidResDir)) {
        fs.mkdirSync(androidResDir, { recursive: true });
      }

      // Icons to copy
      const icons = ['timer.png', 'play_circle.png', 'pause_circle.png', 'timeout.png'];

      console.log(`\n🔔 [Notification Icons] Syncing icons to Native Android...`);

      icons.forEach((icon) => {
        const sourceFile = path.join(sourceDir, icon);
        const destFile = path.join(androidResDir, icon);

        if (fs.existsSync(sourceFile)) {
          // Check if file already exists/changed to avoid redundant copies? 
          // For safety, we just overwrite.
          fs.copyFileSync(sourceFile, destFile);
          console.log(`   ✅ Copied: ${icon}`);
        } else {
          console.error(`   ❌ ERROR: Could not find source icon: ${sourceFile}`);
        }
      });
      console.log('   (Icons are now available in R.drawable.*)\n');

      return config;
    },
  ]);
};

module.exports = withNotificationIcons;