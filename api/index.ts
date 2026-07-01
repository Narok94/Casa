import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import pool, { setupDatabase } from '../src/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-jwt';
const app = express();

app.use(express.json());
app.use(cookieParser());

let mockRoutines = [
  { id: 1, title: 'Tirar o lixo', category: 'Limpeza', assigned_to: 1, days_of_week: [2, 4, 6], priority: 'media', active: true, created_by: 1, created_at: new Date() },
  { id: 2, title: 'Regar as plantas', category: 'Jardim', assigned_to: 2, days_of_week: [1, 3, 5], priority: 'baixa', active: true, created_by: 2, created_at: new Date() },
  { id: 3, title: 'Fazer o jantar', category: 'Cozinha', assigned_to: null, days_of_week: [1, 2, 3, 4, 5], priority: 'alta', active: true, created_by: 1, created_at: new Date() }
];

let mockRoutineCompletions: any[] = [];
let mockTasks: any[] = [
  { id: 1, title: 'Comprar lâmpadas novas', description: '', category: 'Limpeza', assigned_to: 1, status: 'pendente', priority: 'baixa', due_date: new Date().toISOString().split('T')[0], created_by: 1, created_at: new Date() }
];

// Configuração de CORS para Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Setup DB on boot (for Vercel it might run on first request)
let dbSetupDone = false;
app.use(async (req, res, next) => {
  if (!dbSetupDone && process.env.DATABASE_URL) {
    await setupDatabase();
    dbSetupDone = true;
  }
  next();
});

const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.auth_token;
  if (!token) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Token inválido' });
      return;
    }
    (req as any).user = user;
    next();
  });
};

// --- ROTAS (Idênticas ao server.ts) ---

app.post('/api/auth/login', async (req, res) => {
  const { userId, pin } = req.body;
  if (!process.env.DATABASE_URL) {
    if (pin === '4902' || pin === '9860') {
        const mockUser = pin === '4902' ? { id: 1, name: 'Henrique', color: '#5F7A61' } : { id: 2, name: 'Jessica', color: '#A96B54' };
        const token = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ user: mockUser });
        return;
    }
    res.status(401).json({ error: 'PIN incorreto' });
    return;
  }

  try {
    const result = await pool.query('SELECT id, name, color, pin FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    if (user.pin !== pin) {
      res.status(401).json({ error: 'PIN incorreto' });
      return;
    }

    const payload = { id: user.id, name: user.name, color: user.color };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: (req as any).user });
});

app.get('/api/users', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    res.json([
      { id: 1, name: 'Henrique', color: '#5F7A61' },
      { id: 2, name: 'Jessica', color: '#A96B54' }
    ]);
    return;
  }
  try {
    const result = await pool.query('SELECT id, name, color FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json(mockTasks);
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar tarefas' });
  }
});

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

app.get('/api/routines', authenticateToken, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json(mockRoutines);
  try {
    const result = await pool.query('SELECT * FROM routines ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar rotinas' });
  }
});

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

app.get('/api/routine_completions', authenticateToken, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json(mockRoutineCompletions);
  try {
    const result = await pool.query('SELECT * FROM routine_completions');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar conclusões de rotina' });
  }
});

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

export default app;
