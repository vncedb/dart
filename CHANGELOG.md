# Changelog

All notable changes to the DART application will be documented in this file.

# Changelog

## [1.0.4] - 2026-03-04

### ✨ New Features
* **Session Log Modal**: Added a detailed modal in Report Details to view precise daily time-in and time-out session histories.
* **Inline Date Editing**: The report date is now directly editable from the Report Details screen. Changing the date intelligently cascades the update to all related tasks and attendance records.
* **Global Icon Button**: Introduced a new, highly reusable `IconButton` component to standardize circular and rounded button styles across the app.

### 🎨 UI/UX Improvements
* **Report Item Redesign**: Restructured the Report Item cards to display entry counts and logged hours horizontally below the time, and aligned status tags into a compact 2x2 grid on the top right.
* **Tooltip Enhancement**: Tooltips on Report Items now trigger on "Hold" (Long Press) and safely float outside container boundaries with automatic width sizing to prevent text cut-offs.
* **Report Details Layout**: Unified the Attendance and Task container designs, added a dynamic "Work Hour/s" badge, and matched Action Menu icon styles.
* **Edit Mode Polish**: Refined the Edit Report header to lock the title, display a cleanly padded "X" discard button, and hide non-essential actions.
* **Typography Stabilization**: Locked font sizes and weights for time displays to prevent unwanted auto-shrinking or layout shifts.

### 🐛 Bug Fixes
* **Native Crash Resolved**: Fixed a critical JNI/C++ crash caused by background garbage collection conflicting with scroll animations on the Report Details screen.
* **Timezone Offset Fix**: Fixed a UTC shifting bug where editing attendance times would accidentally bump the record to a different day, resulting in a "No Record" error.
* **Time Chronology Enforcement**: Fixed the 24h+ duration bug. Time In and Time Out inputs are now strictly clamped within the current local date boundaries (12:00 AM - 11:59 PM).
* **Edit Lock**: Prevented manual time editing for active/ongoing ("In Progress") sessions to ensure time-tracking integrity.

---

## [1.0.3] - 2026-03-02
### Highlights
- Introduced Monetization & App Polish.
- Overhauled the Settings & Profile UI for a cleaner user experience.

### What's New
- Google AdMob integration implemented across main screens.
- In-app Changelog viewer to keep you up-to-date with releases.

### Improvements
- Implemented Gmail-style swipe interactions for the Notifications screen.
- Redesigned the Sync Status Indicator for a cleaner, non-intrusive view.
- Updated App sharing functionality directly from the settings header.
- Added dual-signature (Primary and Approver) support for generated PDF reports.
- Streamlined the Signature Modal and Generate Report UI for a smoother signing experience.

### Fixes
- Resolved issue where saved PDF reports incorrectly attempted to open as XLSX files.
- Fixed native module dependency errors during the Android build process.
- Optimized background syncing callbacks for accurate progress tracking.
- Resolved a critical bug where the Signature canvas appeared invisible (white ink on white background) due to Dark Mode inversion.
- Fixed an issue where the Signature pad became unresponsive when switching between multiple signees.
- Fixed a navigation bug that incorrectly triggered the 'Unsaved Changes' warning after successfully generating a report.

---

## [1.0.2] - 2026-01-28
### Highlights
- Major upgrade: Seamless Cloud Synchronization and AI Integrations.
- Full offline-first architecture allows you to work without an internet connection.

### What's New
- Automated background data syncing with Supabase.
- Integrated Gemini AI for intelligent summary generation of your work reports.
- Professional PDF and Excel report exporting capabilities.

### Added
- Biometric App Lock for enhanced data privacy and security.
- Digital Signature implementation for reports.
- Push Notifications and Reminders for clocking out.

### Improvements
- Enhanced the dynamic header to clearly display Overtime and Shift progress.

---

## [1.0.1] - 2026-01-11
### Highlights
- The Initial Launch of DART (Daily Accomplishment Report Tools).

### Added
- Core timer functionality for tracking daily shifts.
- Local SQLite database implementation for fast, reliable data storage.
- Job Positions manager to track rates, employment status, and targets.
- Activity timeline to view daily tasks and accomplishments.