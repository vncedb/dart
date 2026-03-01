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
                    "Fixed a navigation bug that incorrectly triggered the 'Unsaved Changes' warning after successfully generating a report."
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