// filepath: constants/ChangelogData.ts

export type ChangelogCategory = 'Highlights' | "What's New" | 'Improvements' | 'Fixes' | 'Added' | 'Changed';

export interface ChangelogEntry {
    version: string;
    date: string;
    categories: {
        type: ChangelogCategory;
        items: string[];
    }[];
}

export const AppChangelog: ChangelogEntry[] = [
    {
        version: "1.0.5",
        date: "March 27, 2026",
        categories: [
            {
                type: "Highlights",
                items: [
                    "Refined reporting, saved-report backup, session management, and AI-assisted entry writing into a more production-ready offline-first workflow.",
                    "Polished high-traffic UI flows across reports, loading states, navigation surfaces, dynamic headers, and AI settings for a cleaner and more consistent release."
                ]
            },
            {
                type: "What's New",
                items: [
                    "Added manual online backup for saved reports to Supabase storage with clearer backup progress and device/cloud status states.",
                    "Standardized generated report naming to DART Report - Date - Time and improved scanned-file timestamp handling using metadata, filename parsing, and file properties.",
                    "Expanded Session Log into the single place for attendance time editing, worked-session add/delete, and structured work-break management.",
                    "Upgraded Excel export into a real workbook with dedicated Summary, Daily Log, and Activities sheets.",
                    "Added report analytics for streaks, overtime, and output trends.",
                    "Added AI-assisted entry writing with note-based generation, bulk photo-to-description support, and rewrite modes for Shorter, More Professional, and Highlight Result."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Refined Generate, Preview, Report Settings, Saved Reports, and action-menu flows for stronger production readiness and better day-to-day usability.",
                    "Improved loading behavior so Home keeps skeleton loading while report and profile-style screens use a shared full-screen loading experience.",
                    "Polished the Dynamic Header, Dynamic Bar, calendar picker, searchable selection modal, and report-details/session-log layouts for a cleaner feel.",
                    "Tightened image viewer zoom-and-pan behavior so double-tap zoom stays within image bounds without empty side gaps.",
                    "Improved Session Log work-break presentation with clearer break categories, smarter add/edit/delete behavior, and tighter card hierarchy.",
                    "Redesigned the API Keys and AI Provider screen with a cleaner provider-selection flow, clearer key management, and more polished settings presentation.",
                    "Refined AI entry actions and provider setup so description generation, rewrites, and provider switching feel more intentional and easier to understand."
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Fixed offline-first report save and sync behavior for PDF and Excel files, including proper backup state handling and upload reconciliation.",
                    "Fixed scanned and saved report date display by using saved metadata, structured filename parsing, and file timestamps in a safer fallback order.",
                    "Fixed multiple session-log and report-details interaction issues, including attendance edit routing, worked-session management, and break validation.",
                    "Fixed calendar today-date visibility, dynamic-header rendering glitches, image-viewer overpan, and add-entry inline time-error messaging.",
                    "Fixed online-only AI, auth, job, and profile-edit flows so offline access now shows a clear modern notice instead of failing ambiguously."
                ]
            }
        ]
    },
    {
        version: "1.0.4",
        date: "March 6, 2026",
        categories: [
            {
                type: "Highlights",
                items: [
                    "Refined daily attendance tracking, report editing, settings behavior, and storage handling for a more reliable offline-first workflow.",
                    "Expanded AI, loading, and form UX with smoother interactions, more consistent save behavior, and stronger app-wide polish."
                ]
            },
            {
                type: "What's New",
                items: [
                    "Reports are now automatically saved to Documents/DART/Reports using the Android Storage Access Framework with clean file naming conventions (ACCOMPLISHMENT_REPORT_[ID]).",
                    "Generated reports now save instantly to the device and upload to Supabase cloud storage in the background, maintaining a seamless user experience even offline.",
                    "Saved reports now securely open using native system viewers (PDF/Excel) via Expo Intent Launcher instead of just the share sheet.",
                    "Added intelligent file integrity checks to detect, flag, and safely delete missing or corrupted files.",
                    "Profile pictures now successfully upload to Supabase Storage with dynamic caching, live upload progress tracking, and automatic cleanup of previous images.",
                    "The profile avatar now features a smart dynamic ring that lights up with the primary theme color when clocked in, and stays grey when off-duty.",
                    "Added a detailed modal in Report Details to view precise daily time-in and time-out session histories.",
                    "The report date is now directly editable from the Report Details screen. Changing the date intelligently cascades the update to all related tasks and attendance records.",
                    "Introduced a new, highly reusable IconButton component to standardize circular and rounded button styles across the app.",
                    "Added a dedicated API Keys and AI Provider settings flow for managing OpenAI and Gemini integrations in one place.",
                    "AI Summary now supports OpenAI-based generation alongside Gemini, with a more complete provider setup flow.",
                    "Added richer app settings controls for notifications, sound effects, haptic feedback, and cache management.",
                    "Added screen-matched animated skeleton loaders for key screens to keep loading states aligned with the real UI.",                    "Documentation image downloads now save to Documents/DART/Documentations with structured DOCUMENTATION_[reportdate][generationdate] file naming."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Refined the alert popups by removing the redundant X close button for a much cleaner, modern aesthetic.",
                    "Streamlined the Edit Profile screen by moving all avatar management exclusively to the main Profile screen.",
                    "Perfected the AI generation animations by centering the background glow and prominently highlighting the report period date.",
                    "Updated the Dynamic Header to utilize the global unified card shadow for a more consistent depth effect.",
                    "Restructured the Report Item cards to display entry counts and logged hours horizontally below the time, and aligned status tags into a compact 2x2 grid.",
                    "Tooltips on Report Items now trigger on Hold (Long Press) and safely float outside container boundaries with automatic width sizing to prevent text cut-offs.",
                    "Unified the Attendance and Task container designs, added a dynamic Work Hour/s badge, and matched Action Menu icon styles.",
                    "Locked font sizes and weights for time displays to prevent unwanted auto-shrinking or layout shifts.",
                    "Refined the Biometric Button into a safer hold-to-time-in and hold-to-time-out interaction to reduce accidental taps.",
                    "Smoothed the searchable selection modal with a cleaner modern bottom-sheet layout, tighter search bar, and cleaner selected-state visuals.",
                    "Improved Edit Profile, Job Form, and Manage Jobs flows with dirty-state footers, better exit confirmation, and more consistent save actions.",
                    "Refined the Job Form compensation section, including clearer pay-rate presentation and stronger footer/action consistency.",
                    "Polished notification copy, daily summary presentation, and professional email templates for a cleaner product feel.",
                    "Redesigned the About screen version card and release-check flow with cleaner version comparison, exact GitHub release targeting, and a more professional footer treatment.",
                    "Refined the Dynamic Bar, Dynamic Header, home top-stack blur, and matching skeleton loaders for a cleaner, more interactive home experience.",
                    "Refined the overtime modal with faster hour shortcuts, cleaner settings-style actions, and smoother action-menu-style transitions.",
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Fixed an issue where the profile picture would incorrectly revert to the previous image upon app restart.",
                    "Fixed a major offline storage bug where React Native failed to read and upload content:// URIs from Android's external storage.",
                    "Fixed Supabase storage bloat by ensuring old avatars and deleted reports are completely purged from the cloud buckets.",
                    "Resolved specific React Native Reanimated layout animation conflicts and ESLint warnings.",
                    "Fixed a critical JNI/C++ crash caused by background garbage collection conflicting with scroll animations on the Report Details screen.",
                    "Fixed a UTC shifting bug where editing attendance times would accidentally bump the record to a different day, resulting in a No Record error.",
                    "Fixed the 24h+ duration bug. Time In and Time Out inputs are now strictly clamped within the current local date boundaries (12:00 AM - 11:59 PM).",
                    "Prevented manual time editing for active/ongoing (In Progress) sessions to ensure time-tracking integrity.",
                    "Fixed the cloud sync database mismatch that caused no such column: file_url errors during saved report syncing.",
                    "Fixed report editing so attendance timestamps now stay on the selected report day when the report date changes.",
                    "Fixed time-in and time-out handling so each attendance session is limited to a single local day only (12:00:00 AM to 11:59:59 PM).",
                    "Fixed stale open sessions by automatically clamping overdue checkouts to the original clock-in day before a new session starts.",
                    "Fixed Android folder selection so choosing Documents reuses the existing Documents/DART/Reports directory instead of creating duplicate folders like DART (1).",
                    "Fixed the Biometric Button hold state getting stuck between presses.",
                    "Fixed the Saved Reports action-menu Open File flow so it also marks the report as read.",
                    "Fixed the About release checker so it compares the installed app version against the latest GitHub release more reliably.",
                    "Fixed notification master-toggle behavior so child notification settings correctly disable and re-enable with the app-level notifications state.",                    "Fixed deletion behavior for reports with an in-progress session by warning the user to time out first instead of allowing an unsafe delete path."
                ]
            }
        ]
    },
    {
        version: "1.0.3",
        date: "March 2, 2026",
        categories: [
            {
                type: "Highlights",
                items: [
                    "Introduced Monetization & App Polish.",
                    "Overhauled the Settings & Profile UI for a cleaner user experience."
                ]
            },
            {
                type: "What's New",
                items: [
                    "Google AdMob integration implemented across main screens.",
                    "In-app Changelog viewer to keep you up-to-date with releases."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Implemented Gmail-style swipe interactions for the Notifications screen.",
                    "Redesigned the Sync Status Indicator for a cleaner, non-intrusive view.",
                    "Updated App sharing functionality directly from the settings header.",
                    "Added dual-signature (Primary and Approver) support for generated PDF reports.",
                    "Streamlined the Signature Modal and Generate Report UI for a smoother signing experience."
                ]
            },
            {
                type: "Fixes",
                items: [
                    "Resolved issue where saved PDF reports incorrectly attempted to open as XLSX files.",
                    "Fixed native module dependency errors during the Android build process.",
                    "Optimized background syncing callbacks for accurate progress tracking.",
                    "Resolved a critical bug where the Signature canvas appeared invisible (white ink on white background) due to Dark Mode inversion.",
                    "Fixed an issue where the Signature pad became unresponsive when switching between multiple signees.",
                    "Fixed a navigation bug that incorrectly triggered the Unsaved Changes warning after successfully generating a report."
                ]
            }
        ]
    },
    {
        version: "1.0.2",
        date: "January 28, 2026",
        categories: [
            {
                type: "Highlights",
                items: [
                    "Major upgrade: Seamless Cloud Synchronization and AI Integrations.",
                    "Full offline-first architecture allows you to work without an internet connection."
                ]
            },
            {
                type: "What's New",
                items: [
                    "Automated background data syncing with Supabase.",
                    "Integrated Gemini AI for intelligent summary generation of your work reports.",
                    "Professional PDF and Excel report exporting capabilities."
                ]
            },
            {
                type: "Added",
                items: [
                    "Biometric App Lock for enhanced data privacy and security.",
                    "Digital Signature implementation for reports.",
                    "Push Notifications and Reminders for clocking out."
                ]
            },
            {
                type: "Improvements",
                items: [
                    "Enhanced the dynamic header to clearly display Overtime and Shift progress."
                ]
            }
        ]
    },
    {
        version: "1.0.1",
        date: "January 11, 2026",
        categories: [
            {
                type: "Highlights",
                items: [
                    "The Initial Launch of DART (Daily Accomplishment Report Tools)."
                ]
            },
            {
                type: "Added",
                items: [
                    "Core timer functionality for tracking daily shifts.",
                    "Local SQLite database implementation for fast, reliable data storage.",
                    "Job Positions manager to track rates, employment status, and targets.",
                    "Activity timeline to view daily tasks and accomplishments."
                ]
            }
        ]
    }
];


