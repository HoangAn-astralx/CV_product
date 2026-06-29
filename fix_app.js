const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

for(let i=510; i<=525; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
