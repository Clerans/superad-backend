import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import cloudinary from '../config/cloudinary';

// POST /api/upload
export const uploadImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project_id } = req.body;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check if the project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get count and max sort order of existing images for this project
    const countRes = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(MAX(sort_order), -1) as max_sort 
       FROM project_images WHERE project_id = $1`,
      [project_id]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    const maxSort = parseInt(countRes.rows[0].max_sort, 10);
    const hasExistingImages = count > 0;

    const insertedImages = [];

    // Loop through uploaded files and save to DB
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // req.files is uploaded via multer-storage-cloudinary
      // each file has .path (Cloudinary URL) and .filename (public_id)
      const imageUrl = file.path;
      const publicId = file.filename;
      const isPrimary = i === 0 && !hasExistingImages;
      const sortOrder = maxSort + 1 + i;

      const insertRes = await pool.query(
        `INSERT INTO project_images (project_id, image_url, public_id, is_primary, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [project_id, imageUrl, publicId, isPrimary, sortOrder]
      );
      insertedImages.push(insertRes.rows[0]);
    }

    return res.status(201).json(insertedImages);
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/upload/:imageId
export const deleteImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageId } = req.params;

    // 1. Fetch image info from DB
    const imageQuery = `SELECT * FROM project_images WHERE id = $1`;
    const imageResult = await pool.query(imageQuery, [imageId]);

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageRecord = imageResult.rows[0];

    // 2. Delete from Cloudinary
    if (imageRecord.public_id) {
      try {
        await cloudinary.uploader.destroy(imageRecord.public_id);
      } catch (cloudinaryError) {
        console.error(`Failed to delete asset ${imageRecord.public_id} from Cloudinary:`, cloudinaryError);
      }
    }

    // 3. Delete from DB
    await pool.query('DELETE FROM project_images WHERE id = $1', [imageId]);

    // 4. If this was the primary image, make another image primary (if any exist)
    if (imageRecord.is_primary) {
      const otherImg = await pool.query(
        `SELECT id FROM project_images 
         WHERE project_id = $1 
         ORDER BY sort_order ASC, created_at ASC 
         LIMIT 1`,
        [imageRecord.project_id]
      );
      if (otherImg.rows.length > 0) {
        await pool.query(
          'UPDATE project_images SET is_primary = TRUE WHERE id = $1',
          [otherImg.rows[0].id]
        );
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};
