import { Router } from 'express';
import { uploadImages, deleteImage } from '../controllers/uploadController';
import { upload } from '../middleware/upload';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, upload.array('images', 10), uploadImages);
router.delete('/:imageId', requireAuth, deleteImage);

export default router;
