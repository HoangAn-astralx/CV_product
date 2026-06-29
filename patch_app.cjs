const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove the camera cards grid block
const startIdx = code.indexOf('<div className="grid grid-cols-2 md:grid-cols-4 gap-3">');
const endIdx = code.indexOf('</div>\n            </div>\n\n            {/* Interactive Live Monitor component */}');
if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + code.substring(endIdx + 25);
}

// Write it back
fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx');
