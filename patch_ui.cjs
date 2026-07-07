const fs = require('fs');
let content = fs.readFileSync('src/components/PipelineBuilder.tsx', 'utf8');

const newUI = `
            {/* ── Domain browser ── */}
            <div className="space-y-6">
              {/* Domain strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {DOMAINS.map(domain => {
                  const c = DOMAIN_COLOR_MAP[domain.color];
                  const isActive = selectedDomain === domain.key;
                  return (
                    <button
                      key={domain.key}
                      onClick={() => { setSelectedDomain(isActive ? '' : domain.key); }}
                      className={\`relative flex items-center p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden group hover:-translate-y-0.5 hover:shadow-md cursor-pointer \${isActive ? \`\${c.border} bg-white shadow-lg ring-2 ring-offset-1 \${c.text.replace('text-', 'ring-')}\` : \`bg-white border-slate-200 hover:border-slate-300\`}\`}
                    >
                      {isActive && <div className={\`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl opacity-20 \${c.activeBg}\`} />}
                      
                      <div className={\`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 transition-colors \${isActive ? c.activeBg + ' text-white shadow-inner' : c.bg + ' ' + c.text + ' group-hover:' + c.activeBg + ' group-hover:text-white'}\`}>
                        {domain.key === 'security' && <Shield size={20} />}
                        {domain.key === 'traffic' && <Car size={20} />}
                        {domain.key === 'production' && <Cpu size={20} />}
                        {domain.key === 'safety' && <HardHat size={20} />}
                        {domain.key === 'fire' && <Flame size={20} />}
                        {domain.key === 'retail' && <Store size={20} />}
                        {domain.key === 'warehouse' && <Package size={20} />}
                      </div>
                      <div className="flex-1 relative z-10">
                        <div className={\`font-bold text-sm \${isActive ? c.text : 'text-slate-800'}\`}>{domain.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{domain.useCases.length} bài toán</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Use case list */}
              <div className={\`transition-all duration-500 overflow-hidden \${selectedDomain ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}\`}>
                {selectedDomain && (() => {
                  const domain = DOMAINS.find(d => d.key === selectedDomain)!;
                  const c = DOMAIN_COLOR_MAP[domain.color];
                  return (
                    <div className={\`bg-slate-50 border rounded-3xl p-5 md:p-6 relative overflow-hidden \${c.border.replace('border-', 'border-').replace('200', '100')}\`}>
                      {/* Sub-header background element */}
                      <div className={\`absolute top-0 left-0 w-full h-32 opacity-10 bg-gradient-to-b from-\${domain.color}-500 to-transparent\`} />
                      
                      <div className="relative z-10 flex items-center gap-2 mb-5">
                        <span className={\`text-sm font-black uppercase tracking-wider \${c.text}\`}>{domain.name}</span>
                        <span className="text-sm text-slate-400 font-medium">— Chọn một bài toán cụ thể để cấu hình</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 relative z-10">
                        {domain.useCases.map(uc => {
                          const isSelected = selectedUseCaseDef?.id === uc.id;
                          const hasImage = uc.needsImage;
                          return (
                            <button
                              key={uc.id}
                              onClick={() => {
                                if (selectedUseCaseDef && selectedUseCaseDef.id !== uc.id) {
                                  useCaseParamsCache.current[selectedUseCaseDef.id] = useCaseParamValues;
                                  useCaseImagesCache.current[selectedUseCaseDef.id] = useCaseImages;
                                  useCaseImageROIsCache.current[selectedUseCaseDef.id] = useCaseImageROIs;
                                }
                                setSelectedUseCaseDef(isSelected ? null : uc);
                                setTaskType(uc.taskMapType);
                                if (!isSelected) {
                                  setUseCaseParamValues(useCaseParamsCache.current[uc.id] || {});
                                  setUseCaseImages(useCaseImagesCache.current[uc.id] || []);
                                  setUseCaseImageROIs(useCaseImageROIsCache.current[uc.id] || {});
                                }
                                setMultiZones({});
                                setDrawingPoints([]);
                                setUserDescription('');
                                setSmartFlowState('idle');
                              }}
                              className={\`text-left flex flex-col p-4 rounded-2xl border transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-lg \${isSelected ? \`\${c.border} \${c.bg} shadow-md ring-1 ring-offset-0 \${c.text.replace('text-', 'ring-').replace('700', '400')}\` : 'bg-white border-slate-200 hover:border-slate-300'}\`}
                            >
                              <div className="flex items-start justify-between w-full mb-3">
                                <div className={\`w-8 h-8 rounded-full flex items-center justify-center transition-colors \${isSelected ? c.activeBg + ' text-white shadow-inner' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}\`}>
                                  {isSelected ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                </div>
                                {hasImage && (
                                  <span className={\`text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 \${isSelected ? 'bg-white/60 ' + c.text : 'bg-slate-100 text-slate-500'}\`}>
                                    <CamIcon size={10} /> Cần ảnh mẫu
                                  </span>
                                )}
                              </div>
                              <div className={\`text-sm font-bold leading-tight mb-1 \${isSelected ? c.text : 'text-slate-800'}\`}>{uc.name}</div>
                              {uc.desc && <p className={\`text-[11px] leading-relaxed flex-1 \${isSelected ? c.text.replace('700', '600') : 'text-slate-500'}\`}>{uc.desc}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Selected use case chip */}
              <div className={\`transition-all duration-300 overflow-hidden \${selectedUseCaseDef ? 'opacity-100 max-h-40 mt-6' : 'opacity-0 max-h-0'}\`}>
                {selectedUseCaseDef && (() => {
                  const domain = DOMAINS.find(d => d.key === selectedDomain)!;
                  const c = DOMAIN_COLOR_MAP[domain.color];
                  return (
                    <div className={\`flex items-center gap-4 border rounded-2xl p-4 shadow-sm relative overflow-hidden \${c.bg} \${c.border}\`}>
                      <div className={\`absolute top-0 left-0 w-1 h-full \${c.activeBg}\`} />
                      <div className={\`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 \${c.activeBg} text-white shadow-inner\`}>
                        <Check size={20} strokeWidth={3} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={\`text-xs font-bold uppercase tracking-wider mb-0.5 \${c.text.replace('700', '600')}\`}>Đã chọn bài toán</div>
                        <div className={\`text-base font-black truncate \${c.text}\`}>{selectedUseCaseDef.name}</div>
                      </div>
                      <button onClick={() => {
                        if (selectedUseCaseDef) {
                          useCaseParamsCache.current[selectedUseCaseDef.id] = useCaseParamValues;
                          useCaseImagesCache.current[selectedUseCaseDef.id] = useCaseImages;
                          useCaseImageROIsCache.current[selectedUseCaseDef.id] = useCaseImageROIs;
                        }
                        setSelectedUseCaseDef(null); setUseCaseParamValues({}); setUseCaseImages([]);
                      }} className={\`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border \${c.border} bg-white \${c.text} hover:\${c.bg} hover:shadow-sm\`}>
                        Thay đổi
                      </button>
                    </div>
                  );
                })()}
              </div>

              {!selectedDomain && (
`;

// Extract everything from {/* ── Domain browser ── */} to {!selectedDomain && ( inclusive
const startMarker = "{/* ── Domain browser ── */}";
const endMarker = "{!selectedDomain && (";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newUI + content.substring(endIndex + endMarker.length);
  fs.writeFileSync('src/components/PipelineBuilder.tsx', content, 'utf8');
} else {
  console.log('Could not find markers');
}
