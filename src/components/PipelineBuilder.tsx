import { useState, Dispatch, SetStateAction } from 'react';
import { Camera, Pipeline, CountingZone, PipelineStep, AlertRule } from '../types';
import { PIPELINE_TEMPLATES } from '../mockData';
import { Check, Camera as CamIcon, Cpu, Sliders, Bell, AlertCircle, ArrowRight, ArrowLeft, MessageSquare, Send, Mail, Webhook, FileText, Clock, ChevronRight, Trash2 } from 'lucide-react';

interface PipelineBuilderProps {
  cameras: Camera[];
  pipelines: Pipeline[];
  setPipelines: Dispatch<SetStateAction<Pipeline[]>>;
  setRules?: Dispatch<SetStateAction<AlertRule[]>>;
  onComplete: () => void;
  onSelectCamera?: (id: string) => void;
}

export default function PipelineBuilder({
  cameras,
  pipelines,
  setPipelines,
  setRules,
  onComplete,
  onSelectCamera,
}: PipelineBuilderProps) {
  const [currentStep, setCurrentStep] = useState<PipelineStep | 'list'>('list');

  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [routedModelName, setRoutedModelName] = useState('YOLO-NAS-S');
  const [routedModelReason, setRoutedModelReason] = useState('Mặc định');

  const [searchQuery, setSearchQuery] = useState('');
  const [cameraSearch, setCameraSearch] = useState('');
  const [scheduleStart, setScheduleStart] = useState('00:00');
  const [scheduleEnd, setScheduleEnd] = useState('23:59');
  const [countingType, setCountingType] = useState<'zone' | 'line'>('line');
  const [zoneName, setZoneName] = useState('Vùng giám sát A');
  const [maxLimit, setMaxLimit] = useState(5);
  const [channels, setChannels] = useState({
    zalo: true,
    email: false,
    telegram: false,
    webhook: false,
  });

  const [zoneDrawings, setZoneDrawings] = useState<Record<string, { x: number; y: number }[]>>({});
  const [activeZoneCamIdx, setActiveZoneCamIdx] = useState(0);
  const [savedToast, setSavedToast] = useState(false);

  const [ruleCondition, setRuleCondition] = useState('count_lt_min');
  const [ruleSeverity, setRuleSeverity] = useState<'info' | 'warning' | 'error' | 'critical'>('warning');
  const [ruleAction, setRuleAction] = useState('Gửi cảnh báo đa kênh');

  const activeCamera = cameras.find(c => c.id === selectedCameraIds[0]);
  const activeCamId = selectedCameraIds[activeZoneCamIdx] || selectedCameraIds[0] || '';
  const currentDrawPoints = zoneDrawings[activeCamId] || [];

  const handleDescriptionChange = (text: string) => {
    setUserDescription(text);

    if (text.trim().length === 0) {
      setRoutedModelName('Chưa xác định');
      setRoutedModelReason('Vui lòng mô tả yêu cầu của bạn.');
      return;
    }

    const lowerText = text.toLowerCase();

    const ppeKeywords = ['mũ', 'áo phản quang', 'bảo hộ', 'ppe', 'an toàn'];
    const cocoKeywords = ['người', 'khách', 'xe', 'ô tô', 'xâm nhập', 'đỗ', 'vào ra'];

    let isPPE = ppeKeywords.some(kw => lowerText.includes(kw));
    let isCOCO = cocoKeywords.some(kw => lowerText.includes(kw));

    if (isPPE) {
      setRoutedModelName('YOLO-NAS + LocateAnything (Crop Mode)');
      setRoutedModelReason('Phát hiện kết hợp: Tìm người bằng YOLO sau đó cắt vùng ảnh để LocateAnything kiểm tra đồ bảo hộ.');
      setCountingType('zone');
      setZoneDrawings(prev => ({ ...prev, [activeCamId]: [] }));
      setRuleCondition('safety_violation');
      setSearchQuery('không đội mũ bảo hộ, không mặc áo phản quang');
    } else if (isCOCO && !lowerText.includes('móp') && !lowerText.includes('lỗi')) {
      setRoutedModelName('YOLO-NAS-S (Fast & Accurate)');
      setRoutedModelReason('Phát hiện các đối tượng phổ thông (bộ dữ liệu COCO). Tối ưu để chạy tốc độ cao.');

      if (lowerText.includes('vào ra') || lowerText.includes('đi qua')) {
        setCountingType('line');
        setRuleCondition('count_gt_max');
      } else {
        setCountingType('zone');
        setRuleCondition(lowerText.includes('xâm nhập') ? 'intrusion' : 'count_gt_max');
      }
    } else {
      setRoutedModelName('LocateAnything-3B (Zero-shot)');
      setRoutedModelReason('Tìm kiếm đối tượng đặc thù không có sẵn trong tập huấn luyện.');
      setSearchQuery(text);
      setCountingType('zone');
      if (lowerText.includes('lỗi') || lowerText.includes('móp') || lowerText.includes('rách')) {
        setRuleCondition('defect_detected');
      } else {
        setRuleCondition('count_lt_min');
      }
    }
  };

  const applyTemplate = (tpl: any) => {
    handleDescriptionChange(tpl.description || '');
    if (tpl.countingType) setCountingType(tpl.countingType);
    if (tpl.ruleCondition) setRuleCondition(tpl.ruleCondition);
    setZoneName(tpl.countingType === 'line' ? 'Vạch kiểm soát chính' : 'Vùng giới hạn an toàn');
  };

  const handleNext = () => {
    const stepOrder: PipelineStep[] = ['camera', 'task', 'zone', 'alert'];
    const currentIndex = stepOrder.indexOf(currentStep as PipelineStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: PipelineStep[] = ['camera', 'task', 'zone', 'alert'];
    const currentIndex = stepOrder.indexOf(currentStep as PipelineStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleSave = () => {
    const newPipelines = selectedCameraIds.map(cameraId => {
      const cam = cameras.find(c => c.id === cameraId);
      const camPoints = zoneDrawings[cameraId] || [];
      const zones: CountingZone[] = camPoints.length > 0 ? [{
        id: `zone-${Date.now()}-${cameraId}`,
        name: zoneName,
        type: countingType,
        points: countingType === 'zone' ? camPoints : [],
        lineStart: countingType === 'line' && camPoints.length >= 2 ? camPoints[0] : undefined,
        lineEnd: countingType === 'line' && camPoints.length >= 2 ? camPoints[camPoints.length - 1] : undefined,
        count: 0,
        inCount: countingType === 'line' ? 0 : undefined,
        outCount: countingType === 'line' ? 0 : undefined,
      }] : [];
      return {
        id: `pipe-${Date.now()}-${cameraId}`,
        name: `Luồng giám sát - ${cam?.name.split(' ')[1] || 'Camera'}`,
        cameraId,
        detectorName: routedModelName.split(' ')[0] || 'AI',
        searchQuery: searchQuery || undefined,
        countingZones: zones,
        alertChannels: channels,
        scheduleStart: scheduleStart !== '00:00' || scheduleEnd !== '23:59' ? scheduleStart : undefined,
        scheduleEnd: scheduleStart !== '00:00' || scheduleEnd !== '23:59' ? scheduleEnd : undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
      } as Pipeline;
    });

    setPipelines(prev => [...newPipelines, ...prev]);
    setCurrentStep('list');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
    if (onSelectCamera && selectedCameraIds[0]) {
      onSelectCamera(selectedCameraIds[0]);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden max-w-4xl mx-auto" id="pipeline-builder-container">
      {savedToast && (
        <div className="fixed bottom-5 right-5 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          ✓ Kích hoạt luồng AI mới thành công!
        </div>
      )}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-8 text-white">
        <h2 className="text-2xl font-black tracking-tight">Trợ lý Cấu hình AI thông minh</h2>
      </div>

      {currentStep !== 'list' && (
        <div className="border-b border-slate-100 px-8 py-5 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4 w-full max-w-3xl overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {[
              { key: 'camera', label: '1. Camera', icon: <CamIcon size={14} /> },
              { key: 'task', label: '2. Nhu cầu', icon: <Cpu size={14} /> },
              { key: 'zone', label: '3. Vùng & Quy tắc', icon: <Sliders size={14} /> },
              { key: 'alert', label: '4. Thông báo', icon: <Bell size={14} /> },
            ].map((s, idx) => {
              const stepOrder = ['camera', 'task', 'zone', 'alert'];
              const isCompleted = stepOrder.indexOf(currentStep as string) > idx;
              const isActive = currentStep === s.key;

              return (
                <div key={s.key} className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <div className={`flex items-center justify-center h-6 w-6 md:h-7 md:w-7 rounded-full text-xs font-bold transition-all ${
                    isCompleted ? 'bg-emerald-600 text-white' : isActive ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600/30' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isCompleted ? <Check size={14} /> : idx + 1}
                  </div>
                  <span className={`text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors ${
                    isActive ? 'text-emerald-900' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {s.label.substring(3)}
                  </span>
                  {idx < 3 && <div className="h-[1px] w-4 md:w-8 bg-slate-200 ml-1 md:ml-2" />}
                </div>
              );
            })}
          </div>

        </div>
      )}

      <div className="p-8">
        {currentStep === 'list' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Luồng giám sát đang hoạt động ({pipelines.length})</h3>
                <p className="text-xs text-slate-500 mt-1">Danh sách các AI Pipeline đang chạy trên các camera của bạn.</p>
              </div>
              <button
                onClick={() => setCurrentStep('camera')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <span>+ Tạo Luồng Mới</span>
              </button>
            </div>

            {pipelines.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">Chưa có luồng giám sát nào đang chạy.</p>
                <button
                  onClick={() => setCurrentStep('camera')}
                  className="text-emerald-600 font-bold text-sm mt-3 hover:underline"
                >
                  Tạo ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pipelines.map(pipe => {
                  const cam = cameras.find(c => c.id === pipe.cameraId);
                  return (
                    <div key={pipe.id} className="border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all bg-white relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                            {pipe.name}
                            {pipe.isActive && <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <CamIcon size={12} /> {cam?.name || 'Camera'} ({cam?.location || ''})
                          </p>
                        </div>
                        <button
                          onClick={() => setPipelines(prev => prev.map(p2 => p2.id === pipe.id ? { ...p2, isActive: !p2.isActive } : p2))}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                            pipe.isActive
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {pipe.isActive ? 'Bật' : 'Tắt'}
                        </button>
                        <button
                          onClick={() => setPipelines(prev => prev.filter(p2 => p2.id !== pipe.id))}
                          className="text-[10px] p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xoá pipeline"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-medium border border-emerald-100 flex items-center gap-1">
                          <Sliders size={10} /> {pipe.countingZones.length} Vùng
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 'camera' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Chọn camera</h3>
              <p className="text-xs text-slate-500 mt-1">Có thể chọn nhiều camera để áp dụng cùng một luồng AI.</p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={cameraSearch}
                onChange={(e) => setCameraSearch(e.target.value)}
                placeholder="Tìm camera..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {cameras
                .filter(c => !cameraSearch || c.name.toLowerCase().includes(cameraSearch.toLowerCase()) || c.location.toLowerCase().includes(cameraSearch.toLowerCase()))
                .map((cam) => (
                <div
                  key={cam.id}
                  onClick={() => {
                    setSelectedCameraIds(prev =>
                      prev.includes(cam.id) ? prev.filter(id => id !== cam.id) : [...prev, cam.id]
                    );
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    selectedCameraIds.includes(cam.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm flex-1 ${
                    selectedCameraIds.includes(cam.id) ? 'font-medium text-emerald-700' : 'text-slate-700'
                  }`}>{cam.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
              ))}
              {cameras.filter(c => !cameraSearch || c.name.toLowerCase().includes(cameraSearch.toLowerCase()) || c.location.toLowerCase().includes(cameraSearch.toLowerCase())).length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">Không tìm thấy camera</div>
              )}
            </div>

            {selectedCameraIds.length === 0 && (
              <div className="text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle size={12} /> Vui lòng chọn ít nhất một camera
              </div>
            )}
          </div>
        )}

        {currentStep === 'task' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Mô tả bài toán giám sát</h3>
              <p className="text-xs text-slate-500 mt-1">Mô tả bất kỳ yêu cầu nào bằng tiếng Việt, hệ thống sẽ tự phân tích và đề xuất cấu hình phù hợp.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FileText className="text-emerald-600" size={18} />
                Bạn muốn giám sát điều gì?
              </label>
              <textarea
                value={userDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder='Ví dụ: "Nhận diện biển số xe ô tô màu đỏ ra vào cổng" hoặc "Đếm số lượng khách hàng ra vào cửa hàng và phát hiện xâm nhập trái phép sau 22h" hoặc "Phát hiện sản phẩm lỗi trên băng chuyền đóng gói"'
                className="w-full h-36 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 resize-none transition-all"
              />

              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={14} />
                  <span>Lên lịch chạy:</span>
                </div>
                <input
                  type="time"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-slate-400 text-xs">→</span>
                <input
                  type="time"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400">(Để trống nếu chạy 24/7)</span>
              </div>
            </div>

            <div>
              <details className="group">
                <summary className="text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors list-none flex items-center gap-1">
                  <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                  Gợi ý nhanh
                </summary>
                <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {PIPELINE_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { applyTemplate(t); setScheduleStart('00:00'); setScheduleEnd('23:59'); }}
                      className="text-left bg-white border border-slate-200 hover:border-emerald-300 p-2.5 rounded-lg transition-all group"
                    >
                      <h5 className="font-bold text-[11px] text-slate-700 group-hover:text-emerald-700 transition-colors">{t.name}</h5>
                      <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-2">{t.description}</p>
                    </button>
                  ))}
                </div>
              </details>
            </div>

          </div>
        )}

        {currentStep === 'zone' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Vùng giám sát</h3>
              <p className="text-xs text-slate-500 mt-1">Click lên khung hình để vẽ vùng giám sát. Click chuột trái để thêm điểm.</p>
            </div>

            {selectedCameraIds.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                {selectedCameraIds.map((camId, idx) => {
                  const cam = cameras.find(c => c.id === camId);
                  return (
                    <button
                      key={camId}
                      onClick={() => setActiveZoneCamIdx(idx)}
                      className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                        activeZoneCamIdx === idx
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cam?.name || camId}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 relative aspect-video shadow-xs">
                <div className="absolute top-3 left-3 flex gap-1 z-10 bg-slate-900/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
                  <button
                        onClick={() => { setCountingType('line'); setZoneDrawings(prev => ({ ...prev, [activeCamId]: [] })); }}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-xs transition-colors ${countingType === 'line' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    title="Kẻ vạch thẳng"
                  >╱</button>
                  <button
                    onClick={() => { setCountingType('zone'); setZoneDrawings(prev => ({ ...prev, [activeCamId]: [] })); }}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-xs transition-colors ${countingType === 'zone' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    title="Khoanh vùng tự do"
                  >⬠</button>
                  <span className="w-px bg-white/10 mx-1" />
                  <button
                    onClick={() => setZoneDrawings(prev => ({ ...prev, [activeCamId]: (prev[activeCamId] || []).slice(0, -1) }))}
                    disabled={currentDrawPoints.length === 0}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Hoàn tác"
                  >↩</button>
                  <button
                    onClick={() => setZoneDrawings(prev => ({ ...prev, [activeCamId]: [] }))}
                    disabled={currentDrawPoints.length === 0}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Xóa tất cả"
                  >🗑</button>
                </div>

                <svg
                  className="w-full h-full absolute inset-0 z-[5] cursor-crosshair"
                  viewBox="0 0 1000 562.5"
                  preserveAspectRatio="xMidYMid meet"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setZoneDrawings(prev => ({ ...prev, [activeCamId]: [...(prev[activeCamId] || []), { x, y }] }));
                  }}
                >
                  {currentDrawPoints.length > 1 && currentDrawPoints.map((p, i) => {
                    if (i === 0) return null;
                    const prev = currentDrawPoints[i - 1];
                    return (
                      <line
                        key={`line-${i}`}
                        x1={`${prev.x}%`} y1={`${prev.y}%`}
                        x2={`${p.x}%`} y2={`${p.y}%`}
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    );
                  })}
                  {countingType === 'zone' && currentDrawPoints.length > 2 && (
                    <polygon
                      points={currentDrawPoints.map(p => `${p.x}% ${p.y}%`).join(' ')}
                      fill="rgba(16,185,129,0.2)"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                  )}
                  {countingType === 'line' && currentDrawPoints.length === 1 && (
                    <circle cx={`${currentDrawPoints[0].x}%`} cy={`${currentDrawPoints[0].y}%`} r="6" fill="#10b981" opacity="0.5" />
                  )}
                  {currentDrawPoints.map((p, i) => (
                    <g key={`pt-${i}`}>
                      <circle cx={`${p.x}%`} cy={`${p.y}%`} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />
                      {i === currentDrawPoints.length - 1 && (
                        <circle cx={`${p.x}%`} cy={`${p.y}%`} r="8" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6">
                          <animate attributeName="r" values="8;12;8" dur="1s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  ))}
                </svg>
                <div className="w-full h-full flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_100%)] bg-[length:20px_20px]"></div>
                  <CamIcon size={48} className="text-slate-700 opacity-50" />
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tên Zone</label>
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 shadow-2xs"
                    placeholder="VD: Cổng A chính"
                  />
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Loại vùng vẽ</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                    onClick={() => { setCountingType('line'); setZoneDrawings(prev => ({ ...prev, [activeCamId]: [] })); }}
                        className={`border rounded-xl p-3 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                          countingType === 'line'
                            ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="w-full h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <div className="w-[60%] h-[1px] border-t-2 border-dashed border-emerald-400"></div>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">Kẻ vạch thẳng</h5>
                        </div>
                      </div>
                      <div
                    onClick={() => { setCountingType('zone'); setZoneDrawings(prev => ({ ...prev, [activeCamId]: [] })); }}
                        className={`border rounded-xl p-3 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                          countingType === 'zone'
                            ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="w-full h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <div className="w-[50%] h-[50%] border-2 border-emerald-400 bg-emerald-500/10 rounded-sm"></div>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">Khoanh vùng tự do</h5>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'alert' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Thiết lập nhận thông báo báo động</h3>
              <p className="text-xs text-slate-500 mt-1">Khi sự kiện kích hoạt, VisionOS tự động gửi cảnh báo tới hệ thống thông tin nội bộ.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${
                channels.zalo ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Gửi Zalo OA</h4>
                    <p className="text-[10px] text-slate-400">Tin nhắn trực tiếp về Zalo NV</p>
                  </div>
                </div>
                <input type="checkbox" checked={channels.zalo} onChange={() => setChannels(prev => ({ ...prev, zalo: !prev.zalo }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              </label>

              <label className={`border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${
                channels.email ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Gửi Email Báo cáo</h4>
                    <p className="text-[10px] text-slate-400">Gửi ảnh kèm thời điểm vi phạm</p>
                  </div>
                </div>
                <input type="checkbox" checked={channels.email} onChange={() => setChannels(prev => ({ ...prev, email: !prev.email }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              </label>

              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between bg-slate-50/50 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-200 text-slate-500 rounded-xl">
                    <Send size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Gửi Telegram Bot</h4>
                    <p className="text-[10px] text-slate-400">Chưa được cấu hình</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-200/50 px-2 py-1 rounded">Chưa cấu hình</span>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between bg-slate-50/50 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-200 text-slate-500 rounded-xl">
                    <Webhook size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Webhook API</h4>
                    <p className="text-[10px] text-slate-400">Chưa được cấu hình</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-200/50 px-2 py-1 rounded">Chưa cấu hình</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-8 py-5 bg-slate-50 flex items-center justify-between">
        {currentStep === 'list' ? (
          <button
            onClick={onComplete}
            className="text-slate-500 hover:text-slate-800 font-bold text-sm px-4 py-2"
          >
            Đóng
          </button>
        ) : (
          <>
            <button
              onClick={() => currentStep === 'camera' ? setCurrentStep('list') : handleBack()}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all border-slate-300 text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer bg-white`}
            >
              <ArrowLeft size={14} /> Quay lại
            </button>

            {currentStep === 'alert' ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check size={14} /> Hoàn tất & Kích hoạt AI
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Tiếp tục <ArrowRight size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
