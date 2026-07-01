fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: 1, pin: "4902" })
})
.then(r => r.json().then(data => ({status: r.status, data})))
.then(console.log)
.catch(console.error);
