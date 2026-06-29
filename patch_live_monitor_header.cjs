const fs = require('fs');
let code = fs.readFileSync('src/components/LiveMonitor.tsx', 'utf8');

const target = `<div className="flex items-center flex-wrap gap-2">`;
const replacement = `<div className="flex items-center flex-wrap gap-2">
            {/* Camera Actions Dropdown */}
            {(onEditCamera || onDeleteCamera) && (
              <div className="relative mr-2">
                {showMenu && (
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                  />
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <MoreVertical size={16} />
                </button>
                {showMenu && (
                  <div className="absolute top-full right-0 mt-1 w-32 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {onEditCamera && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onEditCamera(camera.id);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                      >
                        <Edit2 size={12} /> Sửa camera
                      </button>
                    )}
                    {onDeleteCamera && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onDeleteCamera(e, camera.id);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-rose-400 hover:bg-slate-700 hover:text-rose-300 flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Xoá camera
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/LiveMonitor.tsx', code);
console.log('Patched LiveMonitor Header');
