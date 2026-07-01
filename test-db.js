import pool from "./src/db.js";
pool.query("SELECT * FROM users").then(r => console.log(r.rows)).catch(console.error);
