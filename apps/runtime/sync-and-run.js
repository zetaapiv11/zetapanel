/**
 * ZetaPanel Runtime Bridge
 * =========================
 * This is what makes "upload a ZIP → extract in R2 → it actually runs"
 * true instead of a claim. Render can only build/run a service from a Git
 * repo or a Docker image — it has no concept of "run whatever is in this
 * R2 bucket". So every ZIP-deployed ZetaPanel server is really a Docker
 * service on Render that points at THIS Dockerfile (same repo, every
 * server), and at container start this script:
 *
 *   1. Downloads every object under R2_PREFIX (the user's extracted
 *      project files) into /app
 *   2. Runs the user's configured build command
 *   3. Execs the user's configured start command (so it becomes PID 1 and
 *      receives Render's SIGTERM correctly on restart/redeploy)
 *
 * Re-deploying on Render re-runs this container from scratch, which
 * re-syncs from R2 — so editing files in the ZetaPanel File Manager and
 * hitting "Deploy" really does ship the new files, it's not cosmetic.
 */
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PREFIX, // e.g. users/<userId>/servers/<serverId>/files/
  APP_BUILD_COMMAND,
  APP_START_COMMAND,
  APP_DIR = '/app/workspace',
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    console.error(`[zetapanel-runtime] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  requireEnv('R2_ACCOUNT_ID', R2_ACCOUNT_ID);
  requireEnv('R2_ACCESS_KEY_ID', R2_ACCESS_KEY_ID);
  requireEnv('R2_SECRET_ACCESS_KEY', R2_SECRET_ACCESS_KEY);
  requireEnv('R2_BUCKET', R2_BUCKET);
  requireEnv('R2_PREFIX', R2_PREFIX);
  requireEnv('APP_START_COMMAND', APP_START_COMMAND);

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  console.log(`[zetapanel-runtime] Syncing r2://${R2_BUCKET}/${R2_PREFIX} -> ${APP_DIR}`);
  mkdirSync(APP_DIR, { recursive: true });

  let continuationToken;
  let count = 0;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: R2_PREFIX, ContinuationToken: continuationToken })
    );
    for (const obj of res.Contents || []) {
      if (obj.Key.endsWith('/')) continue; // folder marker
      const relative = obj.Key.slice(R2_PREFIX.length);
      if (!relative) continue;
      const localPath = path.join(APP_DIR, relative);
      mkdirSync(path.dirname(localPath), { recursive: true });

      const getRes = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: obj.Key }));
      await pipeline(getRes.Body, createWriteStream(localPath));
      count += 1;
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (count === 0) {
    console.error('[zetapanel-runtime] No files found at that R2 prefix — nothing to run. Upload your project via the File Manager first.');
    process.exit(1);
  }
  console.log(`[zetapanel-runtime] Synced ${count} file(s). Starting the app.`);

  if (APP_BUILD_COMMAND) {
    await run(APP_BUILD_COMMAND, APP_DIR);
  }

  // exec, not spawn-and-wait: the app becomes this process's replacement
  // so Render's restart/stop signals reach it directly.
  const child = spawn(APP_START_COMMAND, { shell: true, cwd: APP_DIR, stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

function run(command, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`[zetapanel-runtime] $ ${command}`);
    const child = spawn(command, { shell: true, cwd, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Build command failed with exit code ${code}`))));
  });
}

main().catch((err) => {
  console.error('[zetapanel-runtime] Fatal error:', err);
  process.exit(1);
});
