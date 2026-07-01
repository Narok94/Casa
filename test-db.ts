import pool, { setupDatabase } from "./src/db.ts";

async function run() {
  await setupDatabase();
  const r = await pool.query("SELECT * FROM users");
  console.log("Users:", r.rows);
  const r2 = await pool.query("SELECT * FROM routines");
  console.log("Routines:", r2.rows);
}

run().catch(console.error);
