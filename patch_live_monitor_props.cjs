const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// We need to inject the props into BOTH <LiveMonitor ... /> calls.
code = code.replace(/role={role}\n\s+\/>/g, `role={role}\n                onEditCamera={(id) => {\n                  setEditingCameraId(id);\n                  const cam = cameras.find(c => c.id === id);\n                  if (cam) {\n                    setNewCamera({ name: cam.name, location: cam.location, type: cam.type, site: cam.site });\n                  }\n                  setShowAddCamera(true);\n                }}\n                onDeleteCamera={handleDeleteCamera}\n              />`);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched LiveMonitor Props');
