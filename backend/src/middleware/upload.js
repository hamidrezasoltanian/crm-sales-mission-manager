import multer from 'multer';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const REPORT_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'workflow-reports');

export const ensureUploadDirectories = () => {
  if (!existsSync(UPLOAD_ROOT)) {
    mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
  if (!existsSync(REPORT_UPLOAD_DIR)) {
    mkdirSync(REPORT_UPLOAD_DIR, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirectories();
    cb(null, REPORT_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname) || '';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 50);
    cb(null, `${safeBase}_${timestamp}_${random}${ext}`.replace(/_+/g, '_'));
  }
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فرمت فایل پشتیبانی نمی‌شود'));
  }
};

export const reportAttachmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.REPORT_ATTACHMENT_MAX_SIZE || 10 * 1024 * 1024), // 10MB default
    files: Number(process.env.REPORT_ATTACHMENT_MAX_COUNT || 5)
  }
});

export const buildPublicAttachmentPath = (fileName) => {
  return `/api/uploads/workflow-reports/${fileName}`;
};


