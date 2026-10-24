// FORMAT: the specs drive the hostable page in Chromium. "features" runs each feature's specs, kept in its folder
//   (src/<feature>/*.spec.mjs); "repo" runs the checks across the whole repository (security, accessibility,
//   conventions, the benchmark) in tests/. The desktop shell (../tauri) is tested by cargo test there
//   (npm run test:tauri): what its app:// origin serves and refuses, the publish forwarder, the display backend.
// INVARIANT: every test gets a fresh profile, so each starts like a first launch.
import {defineConfig} from '@playwright/test';
import {PUBLISH_SOCK} from './tests/helpers.mjs';

// HACK: the player starts sound from scripted clicks, which autoplay policy would hold back.
const WEB = {browserName: 'chromium', launchOptions: {args: ['--autoplay-policy=no-user-gesture-required']}};

export default defineConfig({
  testMatch: /\.spec\.mjs$/,
  timeout: 90_000,
  expect: {timeout: 15_000},
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  use: {baseURL: 'http://localhost:4173/'},
  // INVARIANT: the dev server forwards /__publish to a socket the publish test owns.
  webServer: {command: 'node scripts/serve.mjs', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI, env: {PIXIWYG_PUBLISH_SOCK: PUBLISH_SOCK}},
  projects: [
    {name: 'features', testDir: '../src', use: WEB},
    {name: 'repo', testDir: 'tests', use: WEB},
  ],
});
