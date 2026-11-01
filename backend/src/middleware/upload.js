import multer from 'multer';
import path from 'node:path';
import config from '../config.js';

/**
 * Multer instance for resume PDF uploads.
 * - Memory storage (buffer passed to pdf-parse, never written to disk)
 * - 5 MB limit
 * - PDF MIME type only
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.UPLOAD_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      const err = new Error(
        `Only PDF files are accepted. Received: "${file.mimetype}"`
      );
      err.statusCode = 415;
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      cb(err);
    }
  },
}).single('resume');

export function sanitizeFilename(filename) {
  const basename = path.basename(String(filename || 'resume.pdf'));
  const safe = basename
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
  return safe || 'resume.pdf';
}

/**
 * Wraps multer in a promise so async/await works naturally in controllers.
 * Translates multer-specific errors into our standard error shape.
 */
export function handleUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return resolve();

      if (err.code === 'LIMIT_FILE_SIZE') {
        const sizeErr = new Error(`File exceeds the ${Math.round(config.UPLOAD_MAX_BYTES / (1024 * 1024))} MB size limit`);
        sizeErr.statusCode = 413;
        sizeErr.code = 'FILE_TOO_LARGE';
        return reject(sizeErr);
      }

      return reject(err);
    });
  });
}

export default { handleUpload, uploadMiddleware };
