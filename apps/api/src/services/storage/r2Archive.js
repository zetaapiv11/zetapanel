/**
 * ZIP extract/compress against real R2 objects. Because R2 has no native
 * "extract this zip in place" operation, ZetaPanel streams the object down,
 * processes it with a real zip library, and streams the results back up —
 * it does not just flip a "extracted" flag in the database.
 */

import AdmZip from 'adm-zip';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2Bucket, buildObjectKey } from './r2Client.js';
import { listFiles } from './r2Files.js';

const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024; // 200 MB safety cap

export async function extractZip({ userId, serverId, zipPath, destPath = '' }) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const key = buildObjectKey(userId, serverId, zipPath);

  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (obj.ContentLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`Archive is ${obj.ContentLength} bytes, over the ${MAX_ARCHIVE_BYTES}-byte extract limit.`);
  }

  const buffer = Buffer.from(await obj.Body.transformToByteArray());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  let written = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const targetPath = destPath ? `${destPath.replace(/\/$/, '')}/${entry.entryName}` : entry.entryName;
    const targetKey = buildObjectKey(userId, serverId, targetPath);
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: targetKey, Body: entry.getData() })
    );
    written += 1;
  }

  return { extractedFiles: written };
}

export async function compressFolder({ userId, serverId, sourcePath, zipName }) {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const { files, folders } = await listFilesRecursive({ userId, serverId, prefixPath: sourcePath });

  const zip = new AdmZip();
  for (const file of files) {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: file.path }));
    const buffer = Buffer.from(await obj.Body.transformToByteArray());
    const relativeName = file.path.replace(new RegExp(`^${escapeRegExp(buildObjectKey(userId, serverId, sourcePath))}/?`), '');
    zip.addFile(relativeName, buffer);
  }

  const zipBuffer = zip.toBuffer();
  const zipKey = buildObjectKey(userId, serverId, zipName);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: zipKey, Body: zipBuffer, ContentType: 'application/zip' }));

  return { key: zipKey, size: zipBuffer.length, fileCount: files.length, folderCount: folders.length };
}

async function listFilesRecursive({ userId, serverId, prefixPath }) {
  // Non-delimited listing to walk every object under the prefix at once.
  const { files } = await listFiles({ userId, serverId, prefixPath, delimiter: '' });
  return { files, folders: [] };
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
