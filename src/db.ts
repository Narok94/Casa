import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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

    client.release();
    console.log('Database schema verified.');
  } catch (err) {
    console.error('Error setting up database schema:', err);
  }
};

export default pool;
