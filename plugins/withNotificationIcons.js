const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNotificationIcons = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const androidResDir = path.join(platformRoot, 'app/src/main/res/drawable');

      console.log(`\n🔔 [Notification Icons] Syncing resources...`);

      if (!fs.existsSync(androidResDir)) {
        fs.mkdirSync(androidResDir, { recursive: true });
      }

      // 1. Copy ONLY Timer Icon (Others are deleted)
      const iconSourceDir = path.join(projectRoot, 'assets/icons/notification');
      const actionIcons = [
        { src: 'timer.png', dest: 'timer.png' }
      ];

      // 2. Copy Main Notification Icon
      const mainIconSourceDir = path.join(projectRoot, 'assets/images/icon');
      const mainIcons = [
        { src: 'notification-icon.png', dest: 'notification_icon.png' }
      ];

      // Helper function to copy
      const copyIcons = (list, sourcePath) => {
        list.forEach(({ src, dest }) => {
          const sourceFile = path.join(sourcePath, src);
          const destFile = path.join(androidResDir, dest);

          if (fs.existsSync(sourceFile)) {
            fs.copyFileSync(sourceFile, destFile);
            console.log(`   ✅ Copied: ${dest}`);
          } else {
            // Log but don't crash if optional
            console.log(`   ⚠️ Skipped (Source missing): ${src}`);
          }
        });
      };

      copyIcons(actionIcons, iconSourceDir);
      copyIcons(mainIcons, mainIconSourceDir);

      return config;
    },
  ]);
};

module.exports = withNotificationIcons;