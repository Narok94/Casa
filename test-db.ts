import pool from "./src/db.ts";
pool.query("SELECT * FROM users").then(r => console.log(r.rows)).catch(console.error);
