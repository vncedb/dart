/**
 * GitHub Release Update Check
 * Fetches latest release from GitHub and compares with current app version.
 * On Android: can download APK and trigger install.
 */

const GITHUB_REPO = "vncedb/dart";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface ReleaseInfo {
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    content_type: string;
    size: number;
  }>;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  release: ReleaseInfo | null;
  error?: string;
}

/**
 * Parse semver-like version string (e.g. "1.0.3", "v1.0.4") to comparable numbers
 */
function parseVersion(v: string): number[] {
  const cleaned = v.replace(/^v/i, "").trim();
  const parts = cleaned.split(".").map((n) => parseInt(n, 10) || 0);
  return parts;
}

/**
 * Compare two version strings. Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const na = va[i] ?? 0;
    const nb = vb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Check if a newer release is available on GitHub
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        release: null,
        error: `API error: ${res.status}`,
      };
    }

    const release: ReleaseInfo = await res.json();
    const latestVersion = (release.tag_name || release.name || "").replace(/^v/i, "").trim();

    if (!latestVersion) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        release: null,
        error: "No version in release",
      };
    }

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      release,
    };
  } catch (e: any) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      release: null,
      error: e?.message || "Network error",
    };
  }
}

/**
 * Get the APK download URL from release assets (Android)
 */
export function getApkDownloadUrl(release: ReleaseInfo | null): string | null {
  if (!release?.assets?.length) return null;
  const apk = release.assets.find(
    (a) =>
      a.name.toLowerCase().endsWith(".apk") ||
      a.content_type === "application/vnd.android.package-archive"
  );
  return apk?.browser_download_url ?? null;
}
