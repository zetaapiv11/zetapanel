/**
 * Cloudflare R2 client, using the S3-compatible API via AWS SDK v3.
 * Reference: https://developers.cloudflare.com/r2/api/s3/api/
 *
 * R2 credentials never leave the backend. The frontend only ever receives
 * short-lived presigned URLs generated here.
 */

import { S3Client } from '@aws-sdk/client-s3';

let client;

export function getR2Client() {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.'
    );
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export function getR2Bucket() {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('R2_BUCKET is not configured.');
  return bucket;
}

/**
 * Canonical object key layout, per project rule #33:
 * users/{userId}/servers/{serverId}/files/{path}
 */
export function buildObjectKey(userId, serverId, relativePath = '') {
  const cleaned = relativePath.replace(/^\/+/, '');
  return `users/${userId}/servers/${serverId}/files/${cleaned}`;
}
