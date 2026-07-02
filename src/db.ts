import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configure pg to return DATE columns (OID 1082) as raw YYYY-MM-DD strings
pg.types.setTypeParser(1082, (val) => val);

const { Pool } = pg;

// Create a new pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fake_user:fake_password@ep-fake-host.neon.tech/fake_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

export const setupDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Skipping database schema setup.');
    return;
  }

  try {
    const client = await pool.connect();

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        pin VARCHAR(4) NOT NULL,
        color VARCHAR(20) NOT NULL
      );
    `);

    // Create tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(30) NOT NULL,
        assigned_to INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pendente',
        priority VARCHAR(10) DEFAULT 'media',
        due_date DATE,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence VARCHAR(20),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);

    // Create routines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routines (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        category VARCHAR(30) NOT NULL,
        assigned_to INTEGER REFERENCES users(id),
        days_of_week INTEGER[] NOT NULL,
        priority VARCHAR(10) DEFAULT 'media',
        active BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create routine_completions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routine_completions (
        id SERIAL PRIMARY KEY,
        routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
        completion_date DATE NOT NULL,
        completed_by INTEGER REFERENCES users(id),
        completed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (routine_id, completion_date)
      );
    `);

    // Add status and note columns to routine_completions and tasks
    await client.query(`
      ALTER TABLE routine_completions ADD COLUMN IF NOT EXISTS status VARCHAR(10) DEFAULT 'completed';
      ALTER TABLE routine_completions ADD COLUMN IF NOT EXISTS note TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note TEXT;
    `);

    // Create push_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Clean up orphaned routine completions where the parent routine was deleted
    await client.query(`
      DELETE FROM routine_completions WHERE routine_id NOT IN (SELECT id FROM routines);
    `);

    // Seed data
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (name, pin, color) VALUES 
        ('Henrique', '4902', '#5F7A61'), -- Sage Green
        ('Jessica', '9860', '#A96B54');  -- Terracotta
      `);
      console.log('Seed data inserted successfully.');
    }

    const routineCount = await client.query('SELECT COUNT(*) FROM routines');
    if (parseInt(routineCount.rows[0].count) === 0) {
      // Seed some initial routines for Henrique (1) and Jessica (2)
      await client.query(`
        INSERT INTO routines (title, category, assigned_to, days_of_week, priority, created_by) VALUES
        ('Tirar o lixo', 'Limpeza', 1, ARRAY[2, 4, 6], 'media', 1),
        ('Regar as plantas', 'Jardim', 2, ARRAY[1, 3, 5], 'baixa', 2),
        ('Fazer o jantar', 'Cozinha', NULL, ARRAY[1, 2, 3, 4, 5], 'alta', 1);
      `);
      console.log('Seed routines inserted successfully.');
    }

    client.release();
    console.log('Database schema verified.');
  } catch (err) {
    console.error('Error setting up database schema:', err);
  }
};

export default pool;
