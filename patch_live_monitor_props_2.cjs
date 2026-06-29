const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/onExpand=\{\(\) => \{\n\s+setSelectedCameraId\(cam\.id\);\n\s+setViewMode\('single'\);\n\s+\}\}\n\s+\/>/g, `onExpand={() => {\n                      setSelectedCameraId(cam.id);\n                      setViewMode('single');\n                    }}\n                    onEditCamera={(id) => {\n                      setEditingCameraId(id);\n                      const c = cameras.find(c => c.id === id);\n                      if (c) {\n                        setNewCamera({ name: c.name, location: c.location, type: c.type, site: c.site });\n                      }\n                      setShowAddCamera(true);\n                    }}\n                    onDeleteCamera={handleDeleteCamera}\n                  />`);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched second LiveMonitor Props');
