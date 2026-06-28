import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import cloudinary from '../config/cloudinary';

// GET /api/projects
export const getProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.query;
    const queryStr = `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.category,
        p.created_at,
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'public_id', pi.public_id,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            ) ORDER BY pi.sort_order ASC, pi.created_at ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as images
      FROM projects p
      LEFT JOIN project_images pi ON pi.project_id = p.id
      WHERE ($1::text IS NULL OR p.category = $1::service_category)
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    const filterVal = category ? String(category) : null;
    const result = await pool.query(queryStr, [filterVal]);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

// GET /api/projects/:id
export const getProjectById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const queryStr = `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.category,
        p.created_at,
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'public_id', pi.public_id,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            ) ORDER BY pi.sort_order ASC, pi.created_at ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as images
      FROM projects p
      LEFT JOIN project_images pi ON pi.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `;
    const result = await pool.query(queryStr, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

// POST /api/projects
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }
    const queryStr = `
      INSERT INTO projects (title, description, category)
      VALUES ($1, $2, $3::service_category)
      RETURNING *
    `;
    const result = await pool.query(queryStr, [title, description || '', category]);
    const newProject = result.rows[0];
    newProject.images = [];
    return res.status(201).json(newProject);
  } catch (error) {
    return next(error);
  }
};

// PUT /api/projects/:id
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, category } = req.body;

    // Build dynamic update set clause
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}::service_category`);
      values.push(category);
    }

    if (updates.length > 0) {
      values.push(id);
      const updateQuery = `
        UPDATE projects 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
      `;
      await pool.query(updateQuery, values);
    }

    // Return the updated project with its images
    const getQuery = `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.category,
        p.created_at,
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'public_id', pi.public_id,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            ) ORDER BY pi.sort_order ASC, pi.created_at ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as images
      FROM projects p
      LEFT JOIN project_images pi ON pi.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `;
    const result = await pool.query(getQuery, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/projects/:id
export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 1. Fetch all project images
    const imagesQuery = `SELECT public_id FROM project_images WHERE project_id = $1`;
    const imagesResult = await pool.query(imagesQuery, [id]);

    // 2. Delete all from Cloudinary
    for (const img of imagesResult.rows) {
      if (img.public_id) {
        try {
          await cloudinary.uploader.destroy(img.public_id);
        } catch (cloudinaryError) {
          console.error(`Failed to delete asset ${img.public_id} from Cloudinary:`, cloudinaryError);
        }
      }
    }

    // 3. Delete project from DB (cascade deletion deletes images records automatically)
    const deleteQuery = `DELETE FROM projects WHERE id = $1`;
    const deleteResult = await pool.query(deleteQuery, [id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};
