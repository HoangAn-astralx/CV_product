import { useState, Dispatch, SetStateAction, useEffect } from 'react';
import { Camera, Pipeline, CountingZone, PipelineStep, AlertRule } from '../types';
import { INITIAL_CAMERAS, MODEL_OPTIONS, PIPELINE_TEMPLATES, AI_USECASES } from '../mockData';
import { Check, Camera as CamIcon, Cpu, Sliders, Bell, AlertCircle, ArrowRight, ArrowLeft, MessageSquare, Send, Mail, Webhook, FileText } from 'lucide-react';

interface PipelineBuilderProps {
  cameras: Camera[];
  pipelines: Pipeline[];
  setPipelines: Dispatch<SetStateAction<Pipeline[]>>;
  setRules?: Dispatch<SetStateAction<AlertRule[]>>;
  role: 'admin' | 'operator' | 'viewer';
  onComplete: () => void;
}

export default function PipelineBuilder({
  cameras,
  pipelines,
  setPipelines,
  setRules,
  role,
  onComplete,
}: PipelineBuilderProps) {
  const [currentStep, setCurrentStep] = useState<PipelineStep | 'list'>('list');
  
  // Builder Draft State
  const [selectedCameraId, setSelectedCameraId] = useState(cameras[0]?.id || '');
  const [selectedUseCaseId, setSelectedUseCaseId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('model-yolo');
  const [userDescription, setUserDescription] = useState('');
  const [routedModelName, setRoutedModelName] = useState('YOLO-NAS-S');
  const [routedModelReason, setRoutedModelReason] = useState('Mặc định');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [countingType, setCountingType] = useState<'zone' | 'line'>('line');
  const [drawPoints, setDrawPoints] = useState<{x: number, y: number}[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoneName, setZoneName] = useState('Vùng giám sát A');
  const [maxLimit, setMaxLimit] = useState(5);
  const [channels, setChannels] = useState({
    zalo: true,
    email: false,
    telegram: false,
    webhook: false,
  });
  const [alertActions, setAlertActions] = useState({
    recordVideo: true,
    showPopup: true,
    takeSnapshot: true,
  });

  // Rule Draft State
  const [ruleCondition, setRuleCondition] = useState('count_lt_min');
  const [ruleSeverity, setRuleSeverity] = useState<'info' | 'warning' | 'error' | 'critical'>('warning');
  const [ruleAction, setRuleAction] = useState('Gửi cảnh báo đa kênh');

  const activeCamera = cameras.find(c => c.id === selectedCameraId);

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
      setSelectedModelId('model-yolo-locate');
      setRoutedModelName('YOLO-NAS + LocateAnything (Crop Mode)');
      setRoutedModelReason('Phát hiện kết hợp: Tìm người bằng YOLO sau đó cắt vùng ảnh để LocateAnything kiểm tra đồ bảo hộ.');
      setCountingType('zone');
      setRuleCondition('safety_violation');
      setSearchQuery('không đội mũ bảo hộ, không mặc áo phản quang');
    } else if (isCOCO && !lowerText.includes('móp') && !lowerText.includes('lỗi')) {
      setSelectedModelId('model-yolo');
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
      setSelectedModelId('model-locate');
      setRoutedModelName('LocateAnything-3B (Zero-shot)');
      setRoutedModelReason('Tìm kiếm đối tượng đặc thù không có sẵn trong tập huấn luyện.');
      setSearchQuery(text); // auto fill search query
      setCountingType('zone');
      if (lowerText.includes('lỗi') || lowerText.includes('móp') || lowerText.includes('rách')) {
        setRuleCondition('defect_detected');
      } else {
        setRuleCondition('count_lt_min');
      }
    }
  };

  // Apply a quick preset template to make setup even easier for non-techs!
  const applyTemplate = (tpl: any) => {
    setSelectedCameraId(tpl.cameraId);
    handleDescriptionChange(tpl.description || '');
    if (tpl.countingType) setCountingType(tpl.countingType);
    if (tpl.ruleCondition) setRuleCondition(tpl.ruleCondition);
    setZoneName(tpl.countingType === 'line' ? 'Vạch kiểm soát chính' : 'Vùng giới hạn an toàn');
    addLogMessage(`Đã áp dụng mẫu thiết lập: "${tpl.name}"`);
  };

  const addLogMessage = (msg: string) => {
    // Console notice
    console.log(msg);
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
    // Generate new pipeline
    const newZone: CountingZone = {
      id: `zone-${Date.now()}`,
      name: zoneName,
      type: countingType,
      points: countingType === 'zone' ? [
        { x: 20, y: 30 }, { x: 80, y: 30 }, { x: 80, y: 75 }, { x: 20, y: 75 }
      ] : [],
      lineStart: countingType === 'line' ? { x: 15, y: 50 } : undefined,
      lineEnd: countingType === 'line' ? { x: 85, y: 50 } : undefined,
      count: 0,
      inCount: countingType === 'line' ? 0 : undefined,
      outCount: countingType === 'line' ? 0 : undefined,
      maxLimit: countingType === 'zone' ? maxLimit : undefined,
    };

    const newPipeline: Pipeline = {
      id: `pipe-${Date.now()}`,
      name: `Luồng giám sát - ${activeCamera?.name.split(' ')[1] || 'Camera'}`,
      cameraId: selectedCameraId,
      modelId: selectedModelId,
      detectorName: routedModelName.split(' ')[0] || 'AI',
      searchQuery: selectedModelId.includes('locate') ? searchQuery : undefined,
      countingZones: [newZone],
      alertChannels: channels,
      alertActions: alertActions,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    if (setRules) {
      let conditionText = ruleCondition;
      if (ruleCondition === 'count_lt_min') conditionText = `Số lượng < ${maxLimit}`;
      else if (ruleCondition === 'count_gt_max') conditionText = `Số lượng > ${maxLimit}`;
      else if (ruleCondition === 'intrusion') conditionText = `Xâm nhập vùng: ${zoneName}`;
      else if (ruleCondition === 'safety_violation') conditionText = `Vi phạm an toàn (Thiếu PPE)`;
      else if (ruleCondition === 'parking_violation') conditionText = `Dừng đỗ sai quy định`;
      else if (ruleCondition === 'defect_detected') conditionText = `Phát hiện sản phẩm lỗi/bất thường`;

      const newRule: AlertRule = {
        id: `rule-${Date.now()}`,
        name: `Quy tắc: ${newPipeline.name}`,
        cameraId: selectedCameraId,
        pipelineId: newPipeline.id,
        isActive: true,
        targetObject: routedModelName || 'Đối tượng',
        condition: conditionText,
        action: ruleAction,
        severity: ruleSeverity,
        createdAt: new Date().toISOString(),
      };
      setRules(prev => [newRule, ...prev]);
    }

    setPipelines(prev => [newPipeline, ...prev]);
    onComplete(); // callback to go back to Live Monitor view
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden max-w-4xl mx-auto" id="pipeline-builder-container">
      {/* Wizard Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-8 text-white">
        <h2 className="text-2xl font-black tracking-tight">Trợ lý Cấu hình AI thông minh</h2>
        <p className="text-xs text-slate-300 mt-1 max-w-xl">
          Tự tạo luồng đếm đồ vật hoặc cảnh báo an toàn qua camera chỉ với 4 bước đơn giản, không cần lập trình.
        </p>
      </div>

      {/* Progress Steps Indicators - Hide in list view */}
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
                    isCompleted ? 'bg-indigo-600 text-white' : isActive ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600/30' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isCompleted ? <Check size={14} /> : idx + 1}
                  </div>
                  <span className={`text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors ${
                    isActive ? 'text-indigo-900' : isCompleted ? 'text-indigo-600' : 'text-slate-400'
                  }`}>
                    {s.label.substring(3)}
                  </span>
                  {idx < 3 && <div className="h-[1px] w-4 md:w-8 bg-slate-200 ml-1 md:ml-2" />}
                </div>
              );
            })}
          </div>

        {/* Templates dropdown for ease of use */}
        {currentStep === 'camera' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Hoặc chọn mẫu nhanh:</span>
            <select
              onChange={(e) => {
                const tpl = PIPELINE_TEMPLATES.find(t => t.id === e.target.value);
                if (tpl) applyTemplate(tpl);
              }}
              defaultValue=""
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-semibold focus:outline-hidden cursor-pointer shadow-2xs"
            >
              <option value="" disabled>--- Áp dụng mẫu ---</option>
              {PIPELINE_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
        </div>
      )}

      {/* Steps Workspace content */}
      <div className="p-8">
        {/* STEP 0: ACTIVE PIPELINES LIST */}
        {currentStep === 'list' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Luồng giám sát đang hoạt động ({pipelines.length})</h3>
                <p className="text-xs text-slate-500 mt-1">Danh sách các AI Pipeline đang chạy trên các camera của bạn.</p>
              </div>
              <button 
                onClick={() => setCurrentStep('camera')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <span>+ Tạo Luồng Mới</span>
              </button>
            </div>

            {pipelines.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">Chưa có luồng giám sát nào đang chạy.</p>
                <button 
                  onClick={() => setCurrentStep('camera')}
                  className="text-indigo-600 font-bold text-sm mt-3 hover:underline"
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
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium border border-slate-200/50 flex items-center gap-1">
                          <Cpu size={10} /> {pipe.detectorName}
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium border border-indigo-100 flex items-center gap-1">
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
        {/* STEP 1: CAMERA SELECTION */}
        {currentStep === 'camera' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Chọn mắt camera bạn muốn áp dụng luồng AI</h3>
              <p className="text-xs text-slate-500 mt-1">Hệ thống hỗ trợ kết nối mọi camera IP chuẩn RTSP hoặc Web.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cameras.map((cam) => (
                <div
                  key={cam.id}
                  onClick={() => setSelectedCameraId(cam.id)}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all flex gap-3.5 relative ${
                    selectedCameraId === cam.id
                      ? 'border-indigo-600 bg-indigo-50/15 ring-2 ring-indigo-600/10 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selectedCameraId === cam.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CamIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-slate-800">{cam.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{cam.location}</p>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        Đang hoạt động
                      </span>
                      <span>•</span>
                      <span>Độ phân giải: {cam.resolution}</span>
                    </div>
                  </div>

                  {selectedCameraId === cam.id && (
                    <div className="absolute top-4 right-4 bg-indigo-600 text-white rounded-full p-1">
                      <Check size={12} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Camera Configuration Block */}
            {activeCamera && (
              <div className="border-t border-slate-100 pt-5 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800">Cấu hình luồng video (Tuỳ chọn)</h4>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-medium">Tham số hệ thống</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Đường dẫn RTSP / Stream URL:</label>
                    <input
                      type="text"
                      defaultValue={`rtsp://admin:*****@192.168.1.${activeCamera.id.length}:554/h264/ch1/main/av_stream`}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Độ phân giải xử lý AI:</label>
                    <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-hidden cursor-pointer">
                      <option value="auto">Giữ nguyên gốc ({activeCamera.resolution})</option>
                      <option value="720p">Thu nhỏ còn 720p (Tối ưu tốc độ)</option>
                      <option value="480p">Thu nhỏ còn 480p (Siêu mượt)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Khung hình trên giây (FPS):</label>
                    <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-hidden cursor-pointer">
                      <option value="max">Tối đa từ camera ({activeCamera.fps} FPS)</option>
                      <option value="15">Giới hạn 15 FPS</option>
                      <option value="5">Giới hạn 5 FPS (Tiết kiệm tài nguyên)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="gpu-accel" defaultChecked className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="gpu-accel" className="text-xs font-bold text-slate-700 cursor-pointer">Kích hoạt bộ tăng tốc phần cứng (GPU/NPU)</label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: MODEL SELECTION & CONFIG via NLP */}
        {currentStep === 'task' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Mô tả nhu cầu giám sát</h3>
              <p className="text-xs text-slate-500 mt-1">Chỉ cần viết yêu cầu bằng tiếng Việt, hệ thống sẽ tự động phân tích và cấu hình nhận diện phù hợp nhất.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FileText className="text-indigo-600" size={18} />
                Hệ thống có thể giúp gì cho bạn?
              </label>
              <div className="relative">
                <textarea
                  value={userDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder='Mô tả chi tiết nhu cầu giám sát bạn cần...'
                  className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none transition-all"
                />
              </div>
              
              {userDescription.length > 5 && (
                <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 shrink-0">
                    <Cpu size={18} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Mô hình AI tự động định tuyến</h4>
                    <p className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                      {routedModelName}
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Auto-selected</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{routedModelReason}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Template Library directly accessible here as well if they want to switch */}
            <div className="mt-6">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Hoặc chọn nhanh từ thư viện mẫu (Template Library)</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {PIPELINE_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="text-left bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 p-3 rounded-xl transition-all shadow-2xs group"
                  >
                    <h5 className="font-bold text-xs text-slate-800 group-hover:text-indigo-700 transition-colors">{t.name}</h5>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ZONE DESIGNER & RULE (Combined) */}
        {currentStep === 'zone' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Cấu hình Zone & Đếm</h3>
              <p className="text-xs text-slate-500 mt-1">Vẽ vùng giám sát trên camera và cấu hình chế độ đếm.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: Canvas Area */}
              <div className="lg:col-span-3 border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 relative aspect-video shadow-xs">
                {/* Toolbar */}
                <div className="absolute top-3 left-3 flex gap-1 z-10 bg-slate-900/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
                  <button onClick={() => {setCountingType('zone'); setDrawPoints([]);}} className={`w-8 h-8 rounded-md flex items-center justify-center text-xs ${countingType === 'zone' ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} title="Khoanh vùng">⬠</button>
                  <button onClick={() => {setCountingType('line'); setDrawPoints([]);}} className={`w-8 h-8 rounded-md flex items-center justify-center text-xs ${countingType === 'line' ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} title="Đường kẻ">╱</button>
                  <button onClick={() => setDrawPoints([])} className="w-8 h-8 rounded-md text-slate-300 hover:bg-white/10 hover:text-white flex items-center justify-center text-xs" title="Xóa tất cả">🗑</button>
                </div>
                
                {/* Interactive Camera Preview */}
                <div 
                  className="w-full h-full flex items-center justify-center relative cursor-crosshair"
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    
                    setIsDrawing(true);
                    if (countingType === 'line') {
                      setDrawPoints([{ x, y }, { x, y }]);
                    } else {
                      // Bounding box: top-left, top-right, bottom-right, bottom-left
                      setDrawPoints([
                        { x, y },
                        { x, y },
                        { x, y },
                        { x, y }
                      ]);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (!isDrawing) return;
                    
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                    
                    if (countingType === 'line') {
                      setDrawPoints(prev => [prev[0], { x, y }]);
                    } else {
                      // Update rectangle based on start point (prev[0]) and current point
                      setDrawPoints(prev => {
                        const p1 = prev[0];
                        return [
                          p1,
                          { x, y: p1.y },
                          { x, y },
                          { x: p1.x, y }
                        ];
                      });
                    }
                  }}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_100%)] bg-[length:20px_20px] pointer-events-none"></div>
                  <CamIcon size={48} className="text-slate-700 opacity-50 pointer-events-none" />
                  
                  {/* SVG for drawing lines/polygons */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {countingType === 'line' && drawPoints.length === 2 && (
                      <line 
                        x1={drawPoints[0].x} y1={drawPoints[0].y} 
                        x2={drawPoints[1].x} y2={drawPoints[1].y} 
                        stroke="#818cf8" strokeWidth="0.5" strokeDasharray="1,1" vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {countingType === 'zone' && drawPoints.length > 1 && (
                      <polygon 
                        points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="rgba(99, 102, 241, 0.2)" 
                        stroke="#818cf8" strokeWidth="0.5" vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>

                  {/* Points (Circles) rendered as DOM elements */}
                  {drawPoints.map((pt, i) => (
                    <div 
                      key={i} 
                      className="absolute w-2 h-2 bg-indigo-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-sm ring-2 ring-white/50"
                      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                    />
                  ))}
                  
                  {drawPoints.length === 0 && (
                    <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none animate-pulse">
                      <span className="bg-slate-900/80 text-white text-[10px] px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl">
                        Kéo thả chuột để vẽ vùng giám sát
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Config Panel */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tên Zone</label>
                    <input
                      type="text"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                      placeholder="VD: Cổng A chính"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Loại vùng vẽ</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => { setCountingType('line'); setDrawPoints([]); }}
                        className={`border rounded-xl p-3 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                          countingType === 'line'
                            ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="w-full h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <div className="w-[60%] h-[1px] border-t-2 border-dashed border-indigo-400"></div>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">Kẻ vạch thẳng</h5>
                          <p className="text-[9px] text-slate-500 mt-0.5">Đếm cắt ngang qua</p>
                        </div>
                      </div>

                      <div
                        onClick={() => { setCountingType('zone'); setDrawPoints([]); }}
                        className={`border rounded-xl p-3 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                          countingType === 'zone'
                            ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="w-full h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <div className="w-[50%] h-[50%] border-2 border-indigo-400 bg-indigo-500/10 rounded-sm"></div>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-800">Kéo thả vùng chữ nhật</h5>
                          <p className="text-[9px] text-slate-500 mt-0.5">Đếm số lượng bên trong</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Quy tắc cảnh báo (Rule) đính kèm vùng này</label>
                    <div className="grid grid-cols-1 gap-3">
                      <select
                        value={ruleCondition}
                        onChange={(e) => setRuleCondition(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                      >
                        <option value="count_lt_min">Số lượng đối tượng ít hơn Ngưỡng (Thiếu hàng hóa)</option>
                        <option value="count_gt_max">Số lượng đối tượng vượt Ngưỡng (Quá tải)</option>
                        <option value="defect_detected">Phát hiện sản phẩm lỗi/bất thường</option>
                        <option value="intrusion">Xâm nhập vùng giới hạn</option>
                        <option value="safety_violation">Phát hiện vi phạm an toàn (Thiếu PPE, sai vị trí)</option>
                        <option value="parking_violation">Phát hiện dừng đỗ sai quy định</option>
                      </select>
                      
                      {['count_lt_min', 'count_gt_max'].includes(ruleCondition) && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 mt-2">Ngưỡng số lượng (Threshold)</label>
                          <input
                            type="number"
                            value={maxLimit}
                            onChange={(e) => setMaxLimit(parseInt(e.target.value) || 1)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                            min="1"
                            placeholder="VD: 5"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: ALERT NOTIFICATIONS */}
        {currentStep === 'alert' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Hành động khi phát hiện vi phạm</h3>
              <p className="text-xs text-slate-500 mt-1">Chọn các hành động hệ thống sẽ tự động thực hiện khi có sự kiện xảy ra.</p>
              <div className="flex flex-wrap gap-6 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={alertActions.recordVideo} onChange={() => setAlertActions(p => ({...p, recordVideo: !p.recordVideo}))} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 font-medium">Ghi hình</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={alertActions.showPopup} onChange={() => setAlertActions(p => ({...p, showPopup: !p.showPopup}))} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 font-medium">Pop-up cảnh báo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={alertActions.takeSnapshot} onChange={() => setAlertActions(p => ({...p, takeSnapshot: !p.takeSnapshot}))} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 font-medium">Chụp snapshot</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Kênh thông báo</h3>
              <p className="text-xs text-slate-500 mt-1">Khi sự kiện kích hoạt, VisionOS tự động gửi cảnh báo tới hệ thống thông tin nội bộ.</p>
              {role === 'operator' && (
                <div className="mt-2 bg-amber-50 text-amber-700 text-[11px] font-medium px-3 py-2 rounded-lg border border-amber-100/50 flex items-center gap-1.5 w-fit">
                  ⚠️ Chỉ Admin mới có quyền thay đổi cấu hình kênh thông báo.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Channel 1: Zalo */}
              <div
                onClick={() => { if (role !== 'admin') return; setChannels(prev => ({ ...prev, zalo: !prev.zalo })) }}
                className={`border rounded-2xl p-4 flex items-center justify-between ${role === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} transition-colors ${
                  channels.zalo ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Gửi Zalo OA (Doanh nghiệp)</h4>
                    <p className="text-[10px] text-slate-400">Tin nhắn Zalo trực tiếp về điện thoại nhân viên</p>
                  </div>
                </div>
                <div className={`w-8 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${channels.zalo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`bg-white h-4 w-4 rounded-full shadow-sm transform transition-transform ${channels.zalo ? 'translate-x-3' : 'translate-x-0'}`}></div>
                </div>
              </div>

              {/* Channel 2: Telegram */}
              <div
                onClick={() => { if (role !== 'admin') return; setChannels(prev => ({ ...prev, telegram: !prev.telegram })) }}
                className={`border rounded-2xl p-4 flex items-center justify-between ${role === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} transition-colors ${
                  channels.telegram ? 'border-sky-500 bg-sky-50/10' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 text-sky-600 rounded-xl">
                    <Send size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Gửi Telegram Bot</h4>
                    <p className="text-[10px] text-slate-400">Báo động tức thì vào group Telegram ban quản lý</p>
                  </div>
                </div>
                <div className={`w-8 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${channels.telegram ? 'bg-sky-500' : 'bg-slate-300'}`}>
                  <div className={`bg-white h-4 w-4 rounded-full shadow-sm transform transition-transform ${channels.telegram ? 'translate-x-3' : 'translate-x-0'}`}></div>
                </div>
              </div>

              {/* Channel 3: Email */}
              <div
                onClick={() => { if (role !== 'admin') return; setChannels(prev => ({ ...prev, email: !prev.email })) }}
                className={`border rounded-2xl p-4 flex items-center justify-between ${role === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} transition-colors ${
                  channels.email ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Gửi Email Báo cáo</h4>
                    <p className="text-[10px] text-slate-400">Gửi ảnh snapshot kèm thời điểm vi phạm</p>
                  </div>
                </div>
                <div className={`w-8 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${channels.email ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <div className={`bg-white h-4 w-4 rounded-full shadow-sm transform transition-transform ${channels.email ? 'translate-x-3' : 'translate-x-0'}`}></div>
                </div>
              </div>

              {/* Channel 4: Webhook */}
              <div
                onClick={() => { if (role !== 'admin') return; setChannels(prev => ({ ...prev, webhook: !prev.webhook })) }}
                className={`border rounded-2xl p-4 flex items-center justify-between ${role === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} transition-colors ${
                  channels.webhook ? 'border-purple-500 bg-purple-50/10' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                    <Webhook size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Webhook API Đẩy Dữ Liệu</h4>
                    <p className="text-[10px] text-slate-400">Tích hợp vào phần mềm kế toán ERP / CRM sẵn có</p>
                  </div>
                </div>
                <div className={`w-8 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${channels.webhook ? 'bg-purple-500' : 'bg-slate-300'}`}>
                  <div className={`bg-white h-4 w-4 rounded-full shadow-sm transform transition-transform ${channels.webhook ? 'translate-x-3' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Navigation Buttons footer */}
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
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check size={14} /> Hoàn tất &amp; Kích hoạt AI
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
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
