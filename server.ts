import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import pool, { setupDatabase } from './src/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-jwt';
const PORT = 3000;

let mockRoutines = [
  { id: 1, title: 'Tirar o lixo', category: 'Limpeza', assigned_to: 1, days_of_week: [2, 4, 6], priority: 'media', active: true, created_by: 1, created_at: new Date() },
  { id: 2, title: 'Regar as plantas', category: 'Jardim', assigned_to: 2, days_of_week: [1, 3, 5], priority: 'baixa', active: true, created_by: 2, created_at: new Date() },
  { id: 3, title: 'Fazer o jantar', category: 'Cozinha', assigned_to: null, days_of_week: [1, 2, 3, 4, 5], priority: 'alta', active: true, created_by: 1, created_at: new Date() }
];

let mockRoutineCompletions: any[] = [];
let mockTasks: any[] = [
  { id: 1, title: 'Comprar lâmpadas novas', description: '', category: 'Limpeza', assigned_to: 1, status: 'pendente', priority: 'baixa', due_date: new Date().toISOString().split('T')[0], created_by: 1, created_at: new Date() }
];

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

  // CORS / Options handling just in case
  app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  // API Routes
  
  // Login
  app.post('/api/auth/login', async (req, res) => {
    console.log("Login body:", req.body);
    const { userId, pin } = req.body;
    if (!process.env.DATABASE_URL) {
      // Mock login for preview if DB is not connected
      if (pin === '4902' || pin === '9860') {
         const mockUser = pin === '4902' ? { id: 1, name: 'Henrique', color: '#5F7A61' } : { id: 2, name: 'Jessica', color: '#A96B54' };
         const token = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '7d' });
         res.cookie('auth_token', token, { 
           httpOnly: true, 
           secure: true, 
           sameSite: 'none',
           maxAge: 7 * 24 * 60 * 60 * 1000 
         });
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
      
      res.cookie('auth_token', token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });
      res.json({ user: payload });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro no servidor' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token', { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none'
    });
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

  // Get Tasks (avulsas only)
  app.get('/api/tasks', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.json(mockTasks);
    try {
      const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar tarefas' });
    }
  });

  // Create Task
  app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, category, assigned_to, priority, due_date } = req.body;
    const user = (req as any).user;
    if (!process.env.DATABASE_URL) {
      const newTask = {
        id: mockTasks.length + 1,
        title,
        description: description || '',
        category,
        assigned_to: assigned_to || null,
        status: 'pendente',
        priority: priority || 'media',
        due_date: due_date || null,
        created_by: user.id,
        created_at: new Date()
      };
      mockTasks.push(newTask);
      return res.json(newTask);
    }
    try {
      const result = await pool.query(`
        INSERT INTO tasks (title, description, category, assigned_to, priority, due_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [title, description || '', category, assigned_to || null, priority || 'media', due_date || null, user.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar tarefa' });
    }
  });

  // Update Task
  app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, title, description, category, assigned_to, priority, due_date } = req.body;
    if (!process.env.DATABASE_URL) {
      const task = mockTasks.find(t => t.id === parseInt(id));
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      if (status !== undefined) {
        task.status = status;
        if (status === 'concluida') task.completed_at = new Date();
        else task.completed_at = null;
      }
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (category !== undefined) task.category = category;
      task.assigned_to = assigned_to || null;
      if (priority !== undefined) task.priority = priority;
      if (due_date !== undefined) task.due_date = due_date;
      return res.json(task);
    }
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
    const { id } = req.params;
    if (!process.env.DATABASE_URL) {
      mockTasks = mockTasks.filter(t => t.id !== parseInt(id));
      return res.json({ success: true });
    }
    try {
      await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao deletar tarefa' });
    }
  });

  // --- ROUTINES ---

  // Get Routines
  app.get('/api/routines', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.json(mockRoutines);
    try {
      const result = await pool.query('SELECT * FROM routines ORDER BY id DESC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar rotinas' });
    }
  });

  // Create Routine
  app.post('/api/routines', authenticateToken, async (req, res) => {
    const { title, category, assigned_to, days_of_week, priority } = req.body;
    const user = (req as any).user;
    if (!process.env.DATABASE_URL) {
      const newRoutine = {
        id: mockRoutines.length + 1,
        title,
        category,
        assigned_to: assigned_to || null,
        days_of_week: days_of_week || [],
        priority: priority || 'media',
        active: true,
        created_by: user.id,
        created_at: new Date()
      };
      mockRoutines.push(newRoutine);
      return res.json(newRoutine);
    }
    try {
      const result = await pool.query(`
        INSERT INTO routines (title, category, assigned_to, days_of_week, priority, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [title, category, assigned_to || null, days_of_week, priority || 'media', user.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar rotina' });
    }
  });

  // Update Routine
  app.put('/api/routines/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { active, title, category, assigned_to, days_of_week, priority } = req.body;
    if (!process.env.DATABASE_URL) {
      const routine = mockRoutines.find(r => r.id === parseInt(id));
      if (!routine) return res.status(404).json({ error: 'Rotina não encontrada' });
      if (active !== undefined) routine.active = active;
      if (title !== undefined) routine.title = title;
      if (category !== undefined) routine.category = category;
      routine.assigned_to = assigned_to || null;
      if (days_of_week !== undefined) routine.days_of_week = days_of_week;
      if (priority !== undefined) routine.priority = priority;
      return res.json(routine);
    }
    try {
      const result = await pool.query(`
        UPDATE routines 
        SET active = COALESCE($1, active),
            title = COALESCE($2, title),
            category = COALESCE($3, category),
            assigned_to = $4,
            days_of_week = COALESCE($5, days_of_week),
            priority = COALESCE($6, priority)
        WHERE id = $7 RETURNING *
      `, [active === undefined ? null : active, title || null, category || null, assigned_to || null, days_of_week || null, priority || null, id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar rotina' });
    }
  });

  // Delete Routine
  app.delete('/api/routines/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (!process.env.DATABASE_URL) {
      mockRoutines = mockRoutines.filter(r => r.id !== parseInt(id));
      mockRoutineCompletions = mockRoutineCompletions.filter(rc => rc.routine_id !== parseInt(id));
      return res.json({ success: true });
    }
    try {
      await pool.query('DELETE FROM routines WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao deletar rotina' });
    }
  });

  // Get Routine Completions
  app.get('/api/routine_completions', authenticateToken, async (req, res) => {
    if (!process.env.DATABASE_URL) return res.json(mockRoutineCompletions);
    try {
      const result = await pool.query('SELECT * FROM routine_completions');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar conclusões de rotina' });
    }
  });

  // Complete/Incomplete Routine
  app.post('/api/routines/:id/complete', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { completion_date } = req.body;
    const user = (req as any).user;
    if (!process.env.DATABASE_URL) {
      const existing = mockRoutineCompletions.find(rc => rc.routine_id === parseInt(id) && rc.completion_date === completion_date);
      if (existing) return res.json(existing);
      const newCompletion = {
        id: mockRoutineCompletions.length + 1,
        routine_id: parseInt(id),
        completion_date,
        completed_by: user.id,
        completed_at: new Date()
      };
      mockRoutineCompletions.push(newCompletion);
      return res.json(newCompletion);
    }
    try {
      const result = await pool.query(`
        INSERT INTO routine_completions (routine_id, completion_date, completed_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (routine_id, completion_date) DO UPDATE SET completed_by = EXCLUDED.completed_by
        RETURNING *
      `, [id, completion_date, user.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao completar rotina' });
    }
  });

  // Uncomplete Routine
  app.delete('/api/routines/:id/complete', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { completion_date } = req.body;
    if (!process.env.DATABASE_URL) {
      mockRoutineCompletions = mockRoutineCompletions.filter(rc => !(rc.routine_id === parseInt(id) && rc.completion_date === completion_date));
      return res.json({ success: true });
    }
    try {
      await pool.query(`
        DELETE FROM routine_completions 
        WHERE routine_id = $1 AND completion_date = $2
      `, [id, completion_date]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao desfazer conclusão de rotina' });
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
    console.log(`Server running on http://localhost:${PORT} with Express!`);
  });
}

startServer();
