import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import cloudinary from '../config/cloudinary';
import { BadRequestError } from '../utils/errors';

const router = Router();
router.use(authenticateToken);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /api/v1/upload/avatar - Upload user avatar
router.post('/avatar', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    const userId = req.user!.userId;

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'portalwave/avatars',
          public_id: `avatar_${userId}`,
          overwrite: true,
          transformation: [
            { width: 200, height: 200, crop: 'fill', gravity: 'face' },
            { quality: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file!.buffer);
    });

    const uploadResult = result as any;

    res.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload avatar' });
  }
});

// POST /api/v1/upload/workspace-logo - Upload workspace logo
router.post('/workspace-logo', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    const { workspaceId } = req.body;
    if (!workspaceId) {
      throw new BadRequestError('workspaceId is required');
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'portalwave/workspace-logos',
          public_id: `logo_${workspaceId}`,
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'fit' },
            { quality: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file!.buffer);
    });

    const uploadResult = result as any;

    res.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (error: any) {
    console.error('Logo upload error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload logo' });
  }
});

// POST /api/v1/upload/project-attachment - Upload project attachment
router.post('/project-attachment', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    const { projectId } = req.body;
    if (!projectId) {
      throw new BadRequestError('projectId is required');
    }

    const userId = req.user!.userId;
    const timestamp = Date.now();

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `portalwave/projects/${projectId}`,
          public_id: `${timestamp}_${req.file!.originalname.replace(/\.[^/.]+$/, '')}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file!.buffer);
    });

    const uploadResult = result as any;

    res.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error: any) {
    console.error('Attachment upload error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload attachment' });
  }
});

// DELETE /api/v1/upload - Delete uploaded file (pass publicId in body)
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      throw new BadRequestError('publicId is required');
    }

    await cloudinary.uploader.destroy(publicId);

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Delete file error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete file' });
  }
});


export default router;