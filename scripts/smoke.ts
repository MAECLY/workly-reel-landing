/**
 * The smoke test.
 *
 * Four questions, asked of the production build rather than of the source:
 * does a build exist, does the server it produces answer, are the real assets
 * still on disk and still the bytes the manifest describes, and do the content
 * rules still hold against the rendered HTML.
 *
 * It is deliberately much smaller than `pnpm test:e2e`. This is the check that
 * runs straight after `pnpm build` and says whether the artefact is worth
 * pointing a browser at; the end-to-end suite is what interrogates the page.
 *
 * Run with `pnpm smoke`, after `pnpm build`.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { lint } from './check-content';
import { realAssets, site } from '../content';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Not 3210. That port belongs to the Playwright web server, and a smoke test
 * that quietly answered from a server someone else started would report on a
 * build that is not the one on disk.
 */
const PORT = Number(process.env.SMOKE_PORT ?? '4310');
const ORIGIN = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 250;

/** The register and the three files it approves. Nothing else may be rendered. */
const CRITICAL_ASSETS = ['/assets/manifest.json', ...realAssets.map((asset) => asset.file)];

/** Present, and produced by a build rather than left over from a dev server. */
const BUILD_ARTEFACTS = [
  join('.next', 'BUILD_ID'),
  join('.next', 'routes-manifest.json'),
  join('.next', 'server', 'app', 'index.html'),
];

interface Check {
  readonly name: string;
  readonly detail: string;
  readonly ok: boolean;
}

const checks: Check[] = [];

const record = (ok: boolean, name: string, detail: string): boolean => {
  checks.push({ ok, name, detail });
  return ok;
};

const sizeOf = (path: string): number => {
  try {
    return statSync(join(ROOT, path)).size;
  } catch {
    return -1;
  }
};

const checkBuild = (): void => {
  for (const artefact of BUILD_ARTEFACTS) {
    const size = sizeOf(artefact);
    record(
      size > 0,
      'production build',
      size < 0
        ? `${artefact} is missing; run pnpm build`
        : `${artefact} is ${size} bytes${size === 0 ? ', which is empty' : ''}`,
    );
  }
};

const checkAssets = (): void => {
  for (const file of CRITICAL_ASSETS) {
    const path = join('public', file);
    const size = sizeOf(path);
    if (size < 0) {
      record(false, 'critical asset', `${path} is missing`);
      continue;
    }
    if (size === 0) {
      record(false, 'critical asset', `${path} is present but empty`);
      continue;
    }

    const asset = realAssets.find((entry) => entry.file === file);
    if (asset === undefined) {
      record(true, 'critical asset', `${path} is ${size} bytes`);
      continue;
    }

    // Presence is not enough for the three approved files. A re-encoded or
    // regenerated screenshot is still a file, and the page would go on
    // claiming provenance the bytes no longer support.
    const bytes = readFileSync(join(ROOT, path));
    const digest = createHash('sha256').update(bytes).digest('hex');
    const intact = bytes.byteLength === asset.bytes && digest === asset.sha256;
    record(
      intact,
      'critical asset',
      intact
        ? `${path} is ${bytes.byteLength} bytes, sha256 ${digest.slice(0, 12)}`
        : `${path} is ${bytes.byteLength} bytes and sha256 ${digest.slice(0, 12)}, but the manifest records ${asset.bytes} bytes and ${asset.sha256.slice(0, 12)}`,
    );
  }
};

const checkContentRules = (): void => {
  const report = lint();
  record(
    report.failures.length === 0,
    'content rules',
    report.failures.length === 0
      ? `${report.ruleCount} rules over ${report.sourceFileCount} source files and ${report.htmlFiles.length} rendered documents`
      : report.failures
          .map((failure) => `${failure.file}:${failure.line} [${failure.rule}] ${failure.message}`)
          .join('; '),
  );
  record(
    report.htmlFiles.length > 0,
    'content rules',
    `${report.htmlFiles.length} rendered documents were available to check`,
  );
};

const wait = async (milliseconds: number): Promise<void> =>
  new Promise((settle) => {
    setTimeout(settle, milliseconds);
  });

const waitForServer = async (server: ChildProcess): Promise<Response> => {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastReason = 'it never accepted a connection';

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited with code ${server.exitCode}`);
    }
    try {
      return await fetch(`${ORIGIN}/`);
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
      await wait(POLL_INTERVAL_MS);
    }
  }

  throw new Error(`${ORIGIN} did not answer within ${START_TIMEOUT_MS}ms: ${lastReason}`);
};

const checkTheServedPage = async (): Promise<void> => {
  const server = spawn(join(ROOT, 'node_modules', '.bin', 'next'), ['start', '-p', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  try {
    const response = await waitForServer(server);
    const html = await response.text();

    record(
      response.status === 200,
      'the page answers',
      `GET ${ORIGIN}/ returned ${response.status}`,
    );
    // A 200 alone would also be satisfied by an error page rendered at 200,
    // so the honest status label has to be in the body that came back.
    record(
      html.includes(site.phaseLabel),
      'the page answers',
      html.includes(site.phaseLabel)
        ? `the body carries "${site.phaseLabel}"`
        : `the body does not carry "${site.phaseLabel}"`,
    );
  } catch (error) {
    record(false, 'the page answers', error instanceof Error ? error.message : String(error));
  } finally {
    server.kill('SIGTERM');
  }
};

const report = (): void => {
  for (const check of checks) {
    process.stdout.write(`  ${check.ok ? 'ok  ' : 'FAIL'}  ${check.name}: ${check.detail}\n`);
  }

  const failures = checks.filter((check) => !check.ok);
  if (failures.length === 0) {
    process.stdout.write(`smoke passed ${checks.length} checks\n`);
    return;
  }

  process.stderr.write(`\nsmoke failed ${failures.length} of ${checks.length} checks\n`);
  process.exitCode = 1;
};

checkBuild();
checkAssets();
checkContentRules();
await checkTheServedPage();
report();
