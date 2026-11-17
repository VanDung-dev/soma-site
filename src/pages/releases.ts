export interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  assets: GitHubAsset[];
}

export interface ReleaseInfo {
  tagName: string;
  isPrerelease: boolean;
  releaseUrl: string;
  windowsUrl: string;
  macosUrl: string;
}

export const RELEASES_API_URL = 'https://api.github.com/repos/VanDung-dev/soma/releases';
export const RELEASES_PAGE_URL = 'https://github.com/VanDung-dev/soma/releases';

export function pickRelease(releases: GitHubRelease[]): ReleaseInfo | null {
  const published = releases.filter(r => !r.draft);
  if (published.length === 0) return null;

  // Rule: If there is no latest stable release (!r.prerelease), default to latest pre-release
  const chosen = published.find(r => !r.prerelease) ?? published.find(r => r.prerelease) ?? published[0];
  if (!chosen) return null;

  const assets = chosen.assets || [];
  const windowsAsset =
    assets.find(a => /\.(exe|msi)$/i.test(a.name)) ??
    assets.find(a => /win/i.test(a.name) && !/source/i.test(a.name));
  const macosAsset =
    assets.find(a => /\.(dmg|pkg)$/i.test(a.name)) ??
    assets.find(a => /(?:mac|darwin|osx)/i.test(a.name) && !/source/i.test(a.name));

  return {
    tagName: chosen.tag_name,
    isPrerelease: chosen.prerelease,
    releaseUrl: chosen.html_url,
    windowsUrl: windowsAsset ? windowsAsset.browser_download_url : chosen.html_url,
    macosUrl: macosAsset ? macosAsset.browser_download_url : chosen.html_url,
  };
}

export async function fetchReleaseInfo(fetchFn: typeof fetch = fetch): Promise<ReleaseInfo | null> {
  try {
    const res = await fetchFn(RELEASES_API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubRelease[];
    if (!Array.isArray(data)) return null;
    return pickRelease(data);
  } catch {
    return null;
  }
}

