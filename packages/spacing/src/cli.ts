import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkSpacing } from './spacing.js';

const SKIPPED = /(^|\/)(node_modules|dist|fixtures|__snapshots__|\.next|\.source)\/|next-env\.d\.ts$/;

const fix = process.argv.includes('--fix');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '*.ts', '*.tsx', '*.mts', '*.cts'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && !SKIPPED.test(file));

let problems = 0;
let fixed = 0;

for (const file of files) {
  const path = join(root, file);
  let source: string;

  try {
    source = readFileSync(path, 'utf8');
  } catch {
    continue;
  }

  const result = checkSpacing(source, file);

  if (result.error) {
    console.error(`${file}: couldn't be parsed: ${result.error}`);
    problems++;
    continue;
  }

  if (result.issues.length === 0) continue;

  if (fix) {
    writeFileSync(path, result.fixed);
    fixed++;
    continue;
  }

  for (const issue of result.issues) console.error(`${file}:${issue.line}: ${issue.message}`);
  problems += result.issues.length;
}

if (fix) console.log(`Fixed the spacing in ${fixed} ${fixed === 1 ? 'file' : 'files'}.`);
else if (problems > 0) {
  console.error(`\n${problems} spacing ${problems === 1 ? 'problem' : 'problems'}. pnpm lint:fix fixes them.`);
  process.exitCode = 1;
} else console.log(`Checked the spacing in ${files.length} files.`);
