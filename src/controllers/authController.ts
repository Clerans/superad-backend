import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Query admin user
    const queryStr = 'SELECT * FROM admin_users WHERE username = $1';
    const result = await pool.query(queryStr, [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Compare password
    const isMatch = await bcryptjs.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Sign JWT token
    const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-change-this';
    const token = jwt.sign({ adminId: admin.id }, jwtSecret, { expiresIn: '7d' });

    return res.json({
      token,
      username: admin.username,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/setup
export const setup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Check if any admin exists
    const checkQuery = 'SELECT COUNT(*) as count FROM admin_users';
    const checkResult = await pool.query(checkQuery);
    const count = parseInt(checkResult.rows[0].count, 10);

    if (count > 0) {
      return res.status(400).json({ error: 'Setup already completed. Initial admin already exists.' });
    }

    // 2. Fetch credentials from environment variables or post body as fallback
    const username = process.env.ADMIN_USERNAME || req.body.username || 'admin';
    const password = process.env.ADMIN_PASSWORD || req.body.password || 'admin_password';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required for setup' });
    }

    // 3. Hash password
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // 4. Create admin user
    const insertQuery = `
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at
    `;
    const insertResult = await pool.query(insertQuery, [username, passwordHash]);
    const createdAdmin = insertResult.rows[0];

    return res.status(201).json({
      message: 'Admin user created successfully',
      admin: {
        id: createdAdmin.id,
        username: createdAdmin.username,
        created_at: createdAdmin.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
};
