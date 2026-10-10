import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../release/', import.meta.url));
// Outside the repository, so electron-builder sees a plain project rather than the pnpm workspace, whose links it
// would follow back to the packages' sources and pack empty.
const app = join(mkdtempSync(join(tmpdir(), 'jinion-desktop-')), 'app');
const electron = (createRequire(import.meta.url)('electron/package.json') as { version: string }).version;
const config = fileURLToPath(new URL('../electron-builder.yml', import.meta.url));
// From the repository rather than the app folder, which holds only what the app runs with.
const icon = fileURLToPath(new URL('../resources/icon.icns', import.meta.url));
const entitlements = fileURLToPath(new URL('../resources/entitlements.mac.plist', import.meta.url));

// electron-builder skips signing quietly when it finds no certificate, which would make a release macOS refuses.
const identities = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' }).stdout;

if (!identities.includes('Developer ID Application')) {
  console.error('No Developer ID Application certificate in the keychain, so the app could not be signed.');
  process.exit(1);
}

// Made once with `xcrun notarytool store-credentials jinion`; the password stays in the keychain.
process.env.APPLE_KEYCHAIN_PROFILE ??= 'jinion';

rmSync(out, { recursive: true, force: true });

// The compilers run directly rather than as pnpm scripts: a nested `pnpm run` checks the installed dependencies first,
// and under NODE_ENV=production it would reinstall without the dev ones.
run('tsc', ['-p', '../../packages/core/tsconfig.build.json']);
run('tsc', ['-p', 'tsconfig.main.json']);
run('vite', ['build']);

// The app folder is the desktop app's built files with only what it needs to run, copied flat out of the workspace.
// `deploy` writes its own settings into the workspace's install state, after which the next pnpm command would
// reinstall the workspace to match them; the state goes back as it was.
const state = fileURLToPath(new URL('../../../node_modules/.pnpm-workspace-state-v1.json', import.meta.url));
const before = readFileSync(state);

run('pnpm', ['--filter', '@jinion/desktop', 'deploy', '--prod', '--legacy', '--config.node-linker=hoisted', app]);
writeFileSync(state, before);

// node-pty 1.1.0 ships its spawn helper without the execute bit, so no terminal could start; the app is never changed
// at run time, so it gets the bit here.
const prebuilds = join(app, 'node_modules/node-pty/prebuilds');

for (const platform of readdirSync(prebuilds)) {
  const helper = join(prebuilds, platform, 'spawn-helper');

  if (existsSync(helper)) chmodSync(helper, 0o755);
}

run('electron-builder', [
  '--mac',
  // The release goes up by hand, with its notes; electron-builder only writes the files.
  '--publish',
  'never',
  '--projectDir',
  app,
  '--config',
  config,
  `-c.electronVersion=${electron}`,
  `-c.directories.output=${out}`,
  `-c.mac.icon=${icon}`,
  `-c.mac.entitlements=${entitlements}`,
  `-c.mac.entitlementsInherit=${entitlements}`,
]);

const { version } = JSON.parse(readFileSync(`${app}/package.json`, 'utf8')) as { version: string };

// The feed sits in a release of its own, and the files it names stay in this version's release, so it names them in full.
const feed = join(out, 'latest-mac.yml');
const files = `https://github.com/itsemirhanengin/jinion/releases/download/${encodeURIComponent(`@jinion/desktop@${version}`)}/`;

writeFileSync(feed, readFileSync(feed, 'utf8').replace(/^(\s*(?:- )?(?:url|path): )(\S+)$/gm, `$1${files}$2`));

rmSync(app, { recursive: true, force: true });
console.log(`\nJinion ${version} is in ${out}`);

function run(command: string, args: string[]) {
  const { status } = spawnSync(command, args, { stdio: 'inherit' });

  if (status !== 0) process.exit(status ?? 1);
}
