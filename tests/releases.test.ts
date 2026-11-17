import test from 'node:test';
import assert from 'node:assert/strict';
import { pickRelease, fetchReleaseInfo } from '../src/pages/releases.ts';
import type { GitHubRelease } from '../src/pages/releases.ts';

test('pickRelease selects the latest stable release when one exists', () => {
  const mockReleases: GitHubRelease[] = [
    {
      tag_name: 'v0.2.0-beta1',
      name: 'v0.2.0-beta1',
      draft: false,
      prerelease: true,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.2.0-beta1',
      assets: [
        { name: 'Soma-beta-windows.exe', browser_download_url: 'https://github.com/.../beta.exe' },
        { name: 'Soma-beta-macos.dmg', browser_download_url: 'https://github.com/.../beta.dmg' },
      ],
    },
    {
      tag_name: 'v0.1.0',
      name: 'v0.1.0',
      draft: false,
      prerelease: false,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0',
      assets: [
        { name: 'Soma-v0.1.0-win.exe', browser_download_url: 'https://github.com/.../v0.1.0-win.exe' },
        { name: 'Soma-v0.1.0-mac.dmg', browser_download_url: 'https://github.com/.../v0.1.0-mac.dmg' },
      ],
    },
    {
      tag_name: 'v0.1.0-dev1',
      name: 'v0.1.0-dev1',
      draft: false,
      prerelease: true,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev1',
      assets: [],
    },
  ];

  const result = pickRelease(mockReleases);
  assert.ok(result);
  assert.equal(result.tagName, 'v0.1.0');
  assert.equal(result.isPrerelease, false);
  assert.equal(result.windowsUrl, 'https://github.com/.../v0.1.0-win.exe');
  assert.equal(result.macosUrl, 'https://github.com/.../v0.1.0-mac.dmg');
});

test('pickRelease defaults to pre-release when no latest stable release exists', () => {
  const mockReleases: GitHubRelease[] = [
    {
      tag_name: 'v0.1.0-dev2',
      name: 'v0.1.0-dev2',
      draft: false,
      prerelease: true,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev2',
      assets: [
        { name: 'Soma-v0.1.0-dev2-win.exe', browser_download_url: 'https://github.com/.../dev2.exe' },
        { name: 'Soma-v0.1.0-dev2-mac.dmg', browser_download_url: 'https://github.com/.../dev2.dmg' },
      ],
    },
    {
      tag_name: 'v0.1.0-dev1',
      name: 'v0.1.0-dev1',
      draft: false,
      prerelease: true,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev1',
      assets: [
        { name: 'Soma-v0.1.0-dev1-win.exe', browser_download_url: 'https://github.com/.../dev1.exe' },
        { name: 'Soma-v0.1.0-dev1-mac.dmg', browser_download_url: 'https://github.com/.../dev1.dmg' },
      ],
    },
  ];

  const result = pickRelease(mockReleases);
  assert.ok(result);
  assert.equal(result.tagName, 'v0.1.0-dev2');
  assert.equal(result.isPrerelease, true);
  assert.equal(result.windowsUrl, 'https://github.com/.../dev2.exe');
  assert.equal(result.macosUrl, 'https://github.com/.../dev2.dmg');
});

test('pickRelease ignores draft releases', () => {
  const mockReleases: GitHubRelease[] = [
    {
      tag_name: 'v1.0.0-draft',
      name: 'v1.0.0-draft',
      draft: true,
      prerelease: false,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v1.0.0-draft',
      assets: [],
    },
    {
      tag_name: 'v0.1.0-dev1',
      name: 'v0.1.0-dev1',
      draft: false,
      prerelease: true,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev1',
      assets: [
        { name: 'Soma-windows-x64-setup.exe', browser_download_url: 'https://github.com/.../setup.exe' },
        { name: 'Soma-macos-arm64.dmg', browser_download_url: 'https://github.com/.../setup.dmg' },
      ],
    },
  ];

  const result = pickRelease(mockReleases);
  assert.ok(result);
  assert.equal(result.tagName, 'v0.1.0-dev1');
  assert.equal(result.isPrerelease, true);
});

test('pickRelease falls back to html_url when platform assets are missing', () => {
  const mockReleases: GitHubRelease[] = [
    {
      tag_name: 'v0.1.0-dev1',
      name: 'v0.1.0-dev1',
      draft: false,
      prerelease: true,
      html_url: 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev1',
      assets: [
        { name: 'source.tar.gz', browser_download_url: 'https://github.com/.../source.tar.gz' },
      ],
    },
  ];

  const result = pickRelease(mockReleases);
  assert.ok(result);
  assert.equal(result.windowsUrl, 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev1');
  assert.equal(result.macosUrl, 'https://github.com/VanDung-dev/soma/releases/tag/v0.1.0-dev1');
});

test('fetchReleaseInfo returns null without fallback on network error or non-200 status', async () => {
  const failingFetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'API rate limit exceeded' }),
  } as Response);

  const result = await fetchReleaseInfo(failingFetch as unknown as typeof fetch);
  assert.equal(result, null);

  const throwingFetch = async () => {
    throw new Error('Network failure');
  };
  const result2 = await fetchReleaseInfo(throwingFetch as unknown as typeof fetch);
  assert.equal(result2, null);
});
