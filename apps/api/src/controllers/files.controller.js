import { prisma } from '../utils/prisma.js';
import { logActivity } from '../utils/activity.js';
import { presignUploadSchema, renameFileSchema } from '../validators/schemas.js';
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  listFiles,
  deleteFile,
  deleteFolder,
  renameFile,
  createFolderMarker,
  readTextFile,
  writeTextFile,
} from '../services/storage/r2Files.js';
import { extractZip, compressFolder } from '../services/storage/r2Archive.js';

async function loadOwnedServer(req) {
  const server = await prisma.server.findUnique({ where: { id: req.params.id } });
  if (!server) {
    const err = new Error('Server not found.');
    err.status = 404;
    throw err;
  }
  const isOwner = server.userId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    const err = new Error('You do not have permission to perform this action.');
    err.status = 403;
    throw err;
  }
  return server;
}

export async function listServerFiles(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const prefixPath = req.query.path || '';
    const result = await listFiles({ userId: server.userId, serverId: server.id, prefixPath });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function requestUpload(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { path, contentType } = presignUploadSchema.parse(req.body);
    const result = await createPresignedUploadUrl({ userId: server.userId, serverId: server.id, path, contentType });
    await logActivity({ userId: req.user.id, action: 'file.upload_requested', metadata: { serverId: server.id, path }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function requestDownload(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const path = req.query.path;
    if (!path) return res.status(400).json({ error: { message: 'path is required.' } });
    const result = await createPresignedDownloadUrl({ userId: server.userId, serverId: server.id, path });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeFile(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { path, isDirectory } = req.body;
    if (!path) return res.status(400).json({ error: { message: 'path is required.' } });

    if (isDirectory) {
      await deleteFolder({ userId: server.userId, serverId: server.id, path });
    } else {
      await deleteFile({ userId: server.userId, serverId: server.id, path });
    }

    await logActivity({ userId: req.user.id, action: 'file.deleted', metadata: { serverId: server.id, path }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function rename(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { fromPath, toPath } = renameFileSchema.parse(req.body);
    const result = await renameFile({ userId: server.userId, serverId: server.id, fromPath, toPath });
    await logActivity({ userId: req.user.id, action: 'file.renamed', metadata: { serverId: server.id, fromPath, toPath }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createFolder(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: { message: 'path is required.' } });
    const result = await createFolderMarker({ userId: server.userId, serverId: server.id, path });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function readFile(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const path = req.query.path;
    const content = await readTextFile({ userId: server.userId, serverId: server.id, path });
    res.json({ content });
  } catch (err) {
    next(err);
  }
}

export async function writeFile(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { path, content } = req.body;
    if (!path || content === undefined) return res.status(400).json({ error: { message: 'path and content are required.' } });
    const result = await writeTextFile({ userId: server.userId, serverId: server.id, path, content });
    await logActivity({ userId: req.user.id, action: 'file.edited', metadata: { serverId: server.id, path }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function extract(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { zipPath, destPath } = req.body;
    if (!zipPath) return res.status(400).json({ error: { message: 'zipPath is required.' } });
    const result = await extractZip({ userId: server.userId, serverId: server.id, zipPath, destPath });
    await logActivity({ userId: req.user.id, action: 'file.extracted', metadata: { serverId: server.id, zipPath }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function compress(req, res, next) {
  try {
    const server = await loadOwnedServer(req);
    const { sourcePath, zipName } = req.body;
    if (!sourcePath || !zipName) return res.status(400).json({ error: { message: 'sourcePath and zipName are required.' } });
    const result = await compressFolder({ userId: server.userId, serverId: server.id, sourcePath, zipName });
    await logActivity({ userId: req.user.id, action: 'file.compressed', metadata: { serverId: server.id, zipName }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
