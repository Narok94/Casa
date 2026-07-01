fetch("http://localhost:3000/api/users").then(r => r.json()).then(console.log).catch(console.error);
