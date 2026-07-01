import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import pool, { setupDatabase } from './src/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-jwt';
const PORT = 3000;

async function startServer() {
  const app = express();
  
  app.use(express.json());
  app.use(cookieParser());

  // Setup Database
  await setupDatabase();

  // Authentication Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Não autorizado' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Token inválido' });
      (req as any).user = user;
      next();
    });
  };

  // API Routes
  
  // Login
  app.post('/api/auth/login', async (req, res) => {
    const { userId, pin } = req.body;
    if (!process.env.DATABASE_URL) {
      // Mock login for preview if DB is not connected
      if (pin === '4902' || pin === '9860') {
         const mockUser = pin === '4902' ? { id: 1, name: 'Henrique', color: '#5F7A61' } : { id: 2, name: 'Jessica', color: '#A96B54' };
         const token = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '7d' });
         res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
         return res.json({ user: mockUser });
      }
      return res.status(401).json({ error: 'PIN incorreto' });
    }

    try {
      const result = await pool.query('SELECT id, name, color, pin FROM users WHERE id = $1', [userId]);
      const user = result.rows[0];
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      if (user.pin !== pin) {
        return res.status(401).json({ error: 'PIN incorreto' });
      }

      const payload = { id: user.id, name: user.name, color: user.color };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ user: payload });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
  });

  // Get current user
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // Get users
  app.get('/api/users', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.json([
        { id: 1, name: 'Henrique', color: '#5F7A61' },
        { id: 2, name: 'Jessica', color: '#A96B54' }
      ]);
    }
    try {
      const result = await pool.query('SELECT id, name, color FROM users');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
  });

  // Get Tasks
  app.get('/api/tasks', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.json([]);
    try {
      const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar tarefas' });
    }
  });

  // Create Task
  app.post('/api/tasks', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Database not connected' });
    const { title, description, category, assigned_to, priority, due_date, is_recurring, recurrence } = req.body;
    const user = (req as any).user;
    try {
      const result = await pool.query(`
        INSERT INTO tasks (title, description, category, assigned_to, priority, due_date, is_recurring, recurrence, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [title, description, category, assigned_to || null, priority, due_date || null, is_recurring || false, recurrence || null, user.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar tarefa' });
    }
  });

  // Update Task (e.g. complete)
  app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Database not connected' });
    const { id } = req.params;
    const { status, title, description, category, assigned_to, priority, due_date } = req.body;
    try {
      if (status === 'concluida') {
         const result = await pool.query(`
          UPDATE tasks SET status = $1, completed_at = NOW() WHERE id = $2 RETURNING *
         `, [status, id]);
         return res.json(result.rows[0]);
      }
      
      const result = await pool.query(`
        UPDATE tasks SET title = $1, description = $2, category = $3, assigned_to = $4, priority = $5, due_date = $6, status = $7
        WHERE id = $8 RETURNING *
      `, [title, description, category, assigned_to, priority, due_date, status, id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar tarefa' });
    }
  });

  // Delete Task
  app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Database not connected' });
    try {
      await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao deletar tarefa' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
