# 🎯 DART – Daily Accomplishment Report Tool

<p align="center">
  <strong>A Professional Productivity & Work Reporting Mobile Application</strong><br/>
  Built with precision, scalability, and production readiness in mind.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.2--dev-blue" alt="Version" />
  <img src="https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-Private-red" alt="License" />
</p>

---

## 📑 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Available Scripts](#-available-scripts)
- [Future Roadmap](#-future-roadmap)
- [Author](#-author)

---

## 📱 Overview

**DART (Daily Accomplishment Report Tool)** is a powerful mobile productivity application designed specifically for professionals. It streamlines the process of tracking daily tasks, managing work logs, generating structured reports, and exporting data effortlessly. 

Whether you need secure cloud synchronization, rapid report exports, or a beautifully crafted interface, DART provides an all-in-one workspace to maximize your productivity.

---

## ✨ Key Features

* **📋 Comprehensive Work Tracking:** Log accomplishments, categorize tasks, and visualize your day with timeline-based activity views.
* **📊 Advanced Report Generation:** Automatically format logs into structured professional summaries. Export to **CSV, Excel (.xlsx), and PDF**.
* **🔐 Enterprise-Grade Security:** Supabase Auth integration with native biometric lock (Face ID/Touch ID) utilizing `expo-local-authentication`.
* **☁️ Seamless Cloud Sync & Offline Mode:** Real-time database syncing with SQLite and AsyncStorage fallbacks for a robust offline-safe architecture.
* **🤖 Smart Features:** Integrated with Google Generative AI for advanced analytics and automated report summarization.
* **🔔 Push Notifications:** Background alerts and local notifications powered by Expo Notifications and Notifee.
* **🎨 Dynamic UI/UX:** Fully responsive Light & Dark modes built with NativeWind (TailwindCSS) and Reanimated.
* **💳 DART Pro & Monetization:** Subscription gating system integrated with RevenueCat for premium feature unlocks.

---

## 🏗 Tech Stack

### Frontend
* **Framework:** React Native (v0.81) / Expo (v54)
* **Language:** TypeScript
* **Routing:** Expo Router
* **Styling:** NativeWind (Tailwind CSS v3)
* **Animations:** React Native Reanimated, Lottie React Native
* **Icons:** Hugeicons, Lucide React Native, Expo Vector Icons

### Backend & Services
* **Database & Auth:** Supabase (PostgreSQL, Supabase Auth)
* **AI Integration:** `@google/generative-ai` (Gemini API)
* **Local Storage:** `@react-native-async-storage/async-storage`, `expo-sqlite`
* **Document Processing:** `xlsx`, `expo-print`, `expo-sharing`

---

## 📂 Project Structure

```text
dart/
├── app/                  # Expo Router file-based routing and screens
├── components/           # Reusable UI components (Buttons, Modals, Cards)
├── constants/            # Theme colors, config constants, and layouts
├── context/              # Global state providers (AuthContext, SyncContext)
├── hooks/                # Custom React hooks (useThemeColor, useProStatus)
├── lib/                  # Initialization (Supabase client, Notifications)
├── services/             # Core business logic (ExportService, ReportService)
├── utils/                # Helper functions (csvExporter, reportGenerator)
├── assets/               # Local media, fonts, and Lottie animations
├── supabase/functions/   # Supabase Edge Functions
├── package.json          # Dependencies and scripts
├── app.json              # Expo configuration
└── tailwind.config.js    # NativeWind/Tailwind configuration
```

---

## 🚀 Getting Started

Follow these instructions to set up the project locally for development and testing.

### Prerequisites

Make sure you have the following installed on your machine:
* [Node.js](https://nodejs.org/en/) (v18 or newer recommended)
* [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
* [Expo CLI](https://docs.expo.dev/get-started/installation/)
* [Git](https://git-scm.com/)
* iOS Simulator (Mac only) or Android Studio Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/your-username/dart.git](https://github.com/your-username/dart.git)
   cd dart
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install Expo Dev Client (if running native modules)**
   ```bash
   npx expo install expo-dev-client
   ```

### Environment Variables

Create a `.env` file in the root directory of your project and configure your Supabase and API keys. You will need to set up a project on Supabase and Google AI Studio.

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=[https://your-project-ref.supabase.co](https://your-project-ref.supabase.co)
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Generative AI Configuration
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key

# RevenueCat (For Premium Features - Optional)
EXPO_PUBLIC_RC_APPLE_API_KEY=your_apple_api_key
EXPO_PUBLIC_RC_GOOGLE_API_KEY=your_google_api_key
```

### Running the App
Start the Expo development server:
```bash
npm start
```
* Press `a` to run on an Android Emulator.
* Press `i` to run on an iOS Simulator.
* Press `w` to run on the Web browser.
* Scan the QR code with the Expo Go app on your physical device to test live.

*(Note: Because this project uses native modules like Notifee and Local Authentication, you may need to build a custom dev client using `npx expo run:android` or `npx expo run:ios` instead of standard Expo Go).*

---

## 🛠 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm start` | Starts the Expo bundler |
| `npm run android` | Compiles and runs the app on an Android device/emulator |
| `npm run ios` | Compiles and runs the app on an iOS simulator |
| `npm run web` | Runs the app in a web browser |
| `npm run lint` | Runs ESLint to find and fix code style issues |
| `npm run reset-project`| Custom script to reset the Expo project cache/builds |

---

## 📈 Future Roadmap

- [ ] **PDF Export Engine:** Finalize native PDF generation for reports.
- [ ] **Team Collaboration:** Multi-user workspaces and admin management panels.
- [ ] **Web Companion:** Expand the Expo Web build into a fully-fledged desktop dashboard.
- [ ] **Advanced AI Summarization:** Use Gemini to automatically draft weekly performance reviews based on daily logs.
- [ ] **Automated Testing:** Implement Jest and Detox for unit and end-to-end testing.

---

## 👨‍💻 Author
**Vince Balbin** – *Bachelor of Science in Information Systems*

---

## 📜 License
**Private Project – All Rights Reserved.**

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.