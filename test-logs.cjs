const fs = require('fs'); 
try {
  const out = require('child_process').execSync('ps aux').toString();
  console.log(out);
} catch (e) {
  console.error(e.message);
}
