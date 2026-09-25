import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, getR2Bucket, buildObjectKey } from './r2Client.js';

const PRESIGN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Generate a presigned PUT URL so the browser uploads directly to R2
 * without the file ever passing through the ZetaPanel backend
 * (project rule #7 / #18).
 */
export async function createPresignedUploadUrl({ userId, serverId, path, contentType }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path);
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  const url = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  return { url, key, expiresIn: PRESIGN_EXPIRY_SECONDS };
}

export async function createPresignedDownloadUrl({ userId, serverId, path }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path);
  const command = new GetObjectCommand({ Bucket: getR2Bucket(), Key: key });
  const url = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  return { url, key, expiresIn: PRESIGN_EXPIRY_SECONDS };
}

export async function listFiles({ userId, serverId, prefixPath = '', delimiter = '/' }) {
  const client = getR2Client();
  const prefix = buildObjectKey(userId, serverId, prefixPath);
  const normalizedPrefix = prefix.endsWith('/') || prefix === '' ? prefix : `${prefix}/`;

  const command = new ListObjectsV2Command({
    Bucket: getR2Bucket(),
    Prefix: normalizedPrefix,
    Delimiter: delimiter,
  });
  const res = await client.send(command);

  const folders = (res.CommonPrefixes || []).map((p) => ({
    type: 'folder',
    name: p.Prefix.replace(normalizedPrefix, '').replace(/\/$/, ''),
    path: p.Prefix,
  }));

  const files = (res.Contents || [])
    .filter((obj) => obj.Key !== normalizedPrefix)
    .map((obj) => ({
      type: 'file',
      name: obj.Key.replace(normalizedPrefix, ''),
      path: obj.Key,
      size: obj.Size,
      modifiedAt: obj.LastModified,
    }));

  return { folders, files };
}

export async function statFile({ userId, serverId, path }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path);
  const res = await client.send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
  return { key, size: res.ContentLength, contentType: res.ContentType, modifiedAt: res.LastModified };
}

export async function deleteFile({ userId, serverId, path }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path);
  await client.send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
  return true;
}

/** Delete an entire "folder" (all objects under a prefix). */
export async function deleteFolder({ userId, serverId, path }) {
  const client = getR2Client();
  const prefix = buildObjectKey(userId, serverId, path);
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;

  let continuationToken;
  let deleted = 0;
  do {
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: getR2Bucket(),
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      })
    );
    const objects = (listRes.Contents || []).map((o) => ({ Key: o.Key }));
    if (objects.length) {
      await client.send(new DeleteObjectsCommand({ Bucket: getR2Bucket(), Delete: { Objects: objects } }));
      deleted += objects.length;
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);

  return { deleted };
}

/** Rename == copy then delete, since R2/S3 has no native rename. */
export async function renameFile({ userId, serverId, fromPath, toPath }) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const fromKey = buildObjectKey(userId, serverId, fromPath);
  const toKey = buildObjectKey(userId, serverId, toPath);

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${encodeURIComponent(fromKey)}`,
      Key: toKey,
    })
  );
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fromKey }));
  return { key: toKey };
}

export async function createFolderMarker({ userId, serverId, path }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path.endsWith('/') ? path : `${path}/`);
  await client.send(new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, Body: '' }));
  return { key };
}

/**
 * Server-side text edit — only used for small text files opened in the
 * in-browser editor (the actual file bytes still round-trip through R2's
 * GetObject/PutObject, not a fabricated in-memory store).
 */
export async function readTextFile({ userId, serverId, path, maxBytes = 2 * 1024 * 1024 }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path);
  const res = await client.send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));
  if (res.ContentLength > maxBytes) {
    throw new Error(`File is ${res.ContentLength} bytes; the inline editor only supports files under ${maxBytes} bytes. Download it instead.`);
  }
  const body = await res.Body.transformToString('utf-8');
  return body;
}

export async function writeTextFile({ userId, serverId, path, content }) {
  const client = getR2Client();
  const key = buildObjectKey(userId, serverId, path);
  await client.send(
    new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, Body: content, ContentType: 'text/plain; charset=utf-8' })
  );
  return { key };
}

export { MULTIPART_THRESHOLD_BYTES, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand };
