/**
 * GitHub Release Update Check
 * Fetches latest release from GitHub and compares with current app version.
 */

const GITHUB_REPO = "vncedb/dart";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/tag/`;

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

function normalizeVersion(v: string): string {
  const input = String(v || '').trim();
  const match = input.match(/\d+(?:\.\d+){1,3}/);
  return match ? match[0] : '';
}

function parseVersion(v: string): number[] {
  const cleaned = normalizeVersion(v);
  const parts = cleaned.split('.').map((n) => parseInt(n, 10) || 0);
  return parts;
}

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

export async function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  const normalizedCurrentVersion = normalizeVersion(currentVersion);

  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion: normalizedCurrentVersion,
        latestVersion: normalizedCurrentVersion,
        release: null,
        error: `API error: ${res.status}`,
      };
    }

    const release: ReleaseInfo = await res.json();
    const latestVersion = normalizeVersion(release.tag_name || release.name || '');

    if (!latestVersion) {
      return {
        hasUpdate: false,
        currentVersion: normalizedCurrentVersion,
        latestVersion: normalizedCurrentVersion,
        release: null,
        error: 'No version in release',
      };
    }

    const hasUpdate = compareVersions(latestVersion, normalizedCurrentVersion) > 0;

    return {
      hasUpdate,
      currentVersion: normalizedCurrentVersion,
      latestVersion,
      release,
    };
  } catch (e: any) {
    return {
      hasUpdate: false,
      currentVersion: normalizedCurrentVersion,
      latestVersion: normalizedCurrentVersion,
      release: null,
      error: e?.message || 'Network error',
    };
  }
}

export function getReleaseTagUrl(release: ReleaseInfo | null, version?: string | null): string | null {
  const candidate = normalizeVersion(version || release?.tag_name || release?.name || '');
  if (!candidate) {
    return release?.html_url || null;
  }
  return `${GITHUB_RELEASE_BASE}v${candidate}`;
}

export function getApkDownloadUrl(release: ReleaseInfo | null): string | null {
  if (!release?.assets?.length) return null;
  const apk = release.assets.find(
    (a) =>
      a.name.toLowerCase().endsWith('.apk') ||
      a.content_type === 'application/vnd.android.package-archive'
  );
  return apk?.browser_download_url ?? null;
}

