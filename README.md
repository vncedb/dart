diff --git a/README.md b/README.md
index 48dd63ff3ef9d87e1378e6babeac488e7ecc37b3..6deadd905e4360b44b304b1496397e3934a69795 100644
--- a/README.md
+++ b/README.md
@@ -1,50 +1,103 @@
-# Welcome to your Expo app 👋
+# DART (Daily Attendance & Reporting Tracker)
+
+DART is an Expo + React Native mobile app for tracking work attendance, managing job details, and generating professional reports. It provides an end-to-end flow from authentication and onboarding to report generation, preview, export, and account/profile management.
+
+## Core Capabilities
+
+- **Authentication & account recovery** (login, forgot/update password flows).
+- **Job and plan management** for daily work context.
+- **Attendance tracking** with timeline-style and form-based entry experiences.
+- **Report generation pipeline** with add/edit/details/preview/saved report screens.
+- **Export and sharing utilities** for generated outputs.
+- **Profile & settings** management (appearance, notifications, security, and policy screens).
+- **Offline-friendly local persistence** using SQLite and local storage, with sync helpers.
+
+## Tech Stack
+
+- **Framework:** Expo SDK 54, React Native 0.81, React 19
+- **Routing:** Expo Router
+- **Language:** TypeScript
+- **Backend/Auth:** Supabase (`@supabase/supabase-js`)
+- **Persistence:** Expo SQLite + AsyncStorage
+- **UI/Animation:** NativeWind, Reanimated, Gesture Handler, Hugeicons, Lottie
+- **Reports:** Print/Share/File-system tooling + XLSX helpers
+
+## Project Structure
+
+```text
+app/                  # Route-based screens (auth, tabs, reports, settings, job)
+components/           # Reusable UI components and modals
+context/              # Global auth/sync providers
+lib/                  # Supabase, database, sync, and service clients
+services/             # Higher-level business services
+utils/                # Utility modules (exporters, generators, notifications)
+assets/               # Static assets (images, audio, animations)
+```
+
+## Prerequisites
+
+- Node.js 18+
+- npm 9+
+- Expo CLI tooling (via `npx expo ...` commands)
+- Android Studio and/or Xcode if you want simulator/device builds
 
-This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).
+## Environment Variables
 
-## Get started
+Create a local `.env` file (or configure EAS secrets) with:
+
+```bash
+EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
+EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
+```
 
-1. Install dependencies
+> The app reads these variables in `lib/supabase.ts` at runtime.
+
+## Getting Started
+
+1. Install dependencies:
 
    ```bash
    npm install
    ```
 
-2. Start the app
+2. Start the development server:
 
    ```bash
-   npx expo start
+   npm run start
    ```
 
-In the output, you'll find options to open the app in a
-
-- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
-- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
-- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
-- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo
+3. Run on specific platforms (optional):
 
-You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).
+   ```bash
+   npm run android
+   npm run ios
+   npm run web
+   ```
 
-## Get a fresh project
+## Code Quality
 
-When you're ready, run:
+Run lint checks:
 
 ```bash
-npm run reset-project
+npm run lint
 ```
 
-This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.
+## Build & Release Notes
 
-## Learn more
+- App metadata and native plugin configuration are defined in `app.json`.
+- EAS configuration is available in `eas.json`.
+- This repository currently tracks a **development flavor** (`1.0.2-dev`).
 
-To learn more about developing your project with Expo, look at the following resources:
+## Troubleshooting
 
-- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
-- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.
+- If auth fails, verify Supabase environment variables are set correctly.
+- If media save/share behavior varies by platform, check platform permission prompts and device settings.
+- If Metro cache issues occur, restart the bundler and clear caches:
 
-## Join the community
+  ```bash
+  npx expo start --clear
+  ```
 
-Join our community of developers creating universal apps.
+## License
 
-- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
-- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
+This project is currently private/internal. Add a formal license here if/when distribution policy changes.
