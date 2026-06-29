import { useState, Dispatch, SetStateAction } from 'react';
import { Camera, Pipeline, CountingZone, PipelineStep, AlertRule } from '../types';
import { PIPELINE_TEMPLATES } from '../mockData';
import { Check, Camera as CamIcon, Cpu, Sliders, Bell, AlertCircle, ArrowRight, ArrowLeft, MessageSquare, Send, Mail, Webhook, FileText, Clock, ChevronRight, Trash2, Pencil } from 'lucide-react';

interface PipelineBuilderProps {
  cameras: Camera[];
  pipelines: Pipeline[];
  setPipelines: Dispatch<SetStateAction<Pipeline[]>>;
  setRules?: Dispatch<SetStateAction<AlertRule[]>>;
  onComplete: () => void;
  onSelectCamera?: (id: string) => void;
}

type InferredMonitoringConfig = {
  mode: 'standard' | 'smart';
  model: string;
  target?: string;
  rule: string;
  scope: 'whole_scene' | 'roi';
  countingType: 'zone' | 'line';
  searchQuery?: string;
  config: Record<string, string | number | boolean | undefined>;
};

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
  const [flowName, setFlowName] = useState('');
  const [monitoringMode, setMonitoringMode] = useState<'standard' | 'smart'>('smart');
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
  const [detectionTarget, setDetectionTarget] = useState('person');
  const [customTarget, setCustomTarget] = useState('');
  const [detectionRule, setDetectionRule] = useState('enter_area');
  const [alertDuration, setAlertDuration] = useState(10);
  const [alertCount, setAlertCount] = useState(1);
  const [cooldown, setCooldown] = useState(60);
  const [confidence, setConfidence] = useState(0.65);
  const [iou, setIou] = useState(0.45);
  const [tracker, setTracker] = useState('bytetrack');
  const [frameSkip, setFrameSkip] = useState(0);
  const [inferenceFps, setInferenceFps] = useState(15);
  const [searchScope, setSearchScope] = useState<'whole_scene' | 'roi'>('whole_scene');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.78);
  const [retrievalTopK, setRetrievalTopK] = useState(5);
  const [channels, setChannels] = useState({
    zalo: true,
    email: false,
    telegram: false,
    webhook: false,
  });

  const [zoneDrawings, setZoneDrawings] = useState<Record<string, { x: number; y: number }[]>>({});
  const [activeZoneCamIdx, setActiveZoneCamIdx] = useState(0);
  const [savedToast, setSavedToast] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);

  const [ruleCondition, setRuleCondition] = useState('count_lt_min');
  const [ruleSeverity, setRuleSeverity] = useState<'info' | 'warning' | 'error' | 'critical'>('warning');
  const [ruleAction, setRuleAction] = useState('Gửi cảnh báo đa kênh');

  const activeCamera = cameras.find(c => c.id === selectedCameraIds[0]);
  const activeCamId = selectedCameraIds[activeZoneCamIdx] || selectedCameraIds[0] || '';
  const currentDrawPoints = zoneDrawings[activeCamId] || [];

  const hydratePipelineForEdit = (pipe: Pipeline) => {
    const cam = cameras.find(c => c.id === pipe.cameraId);
    const zone = pipe.countingZones[0];
    const restoredPoints = zone
      ? zone.type === 'line'
        ? [zone.lineStart, zone.lineEnd].filter(Boolean).map(p => p as { x: number; y: number })
        : zone.points
      : [];

    setEditingPipelineId(pipe.id);
    setSelectedCameraIds([pipe.cameraId]);
    setFlowName(pipe.name);
    setMonitoringMode(pipe.monitoringMode || 'smart');
    setUserDescription(pipe.description || pipe.searchQuery || '');
    setRoutedModelName(pipe.detectorName || 'Chưa xác định');
    setRoutedModelReason('Đã nạp từ luồng hiện có.');
    setSearchQuery(pipe.searchQuery || '');
    setSearchScope(pipe.searchScope || 'whole_scene');
    setCountingType(zone?.type || 'zone');
    setZoneName(zone?.name || 'Vùng giám sát A');
    setScheduleStart(pipe.scheduleStart || '00:00');
    setScheduleEnd(pipe.scheduleEnd || '23:59');
    setChannels(pipe.alertChannels);
    setZoneDrawings({ [pipe.cameraId]: restoredPoints });
    setActiveZoneCamIdx(0);
    setCurrentStep('task');

    if (pipe.monitoringMode === 'standard') {
      setDetectionTarget(pipe.detectionTarget || 'person');
      setDetectionRule(pipe.detectionRule || 'enter_area');
      setAlertDuration(Number(pipe.config?.alertDuration || 10));
      setAlertCount(Number(pipe.config?.alertCount || 1));
      setCooldown(Number(pipe.config?.cooldown || 60));
      setConfidence(Number(pipe.config?.confidence || 0.65));
      setIou(Number(pipe.config?.iou || 0.45));
      setTracker(String(pipe.config?.tracker || 'bytetrack'));
      setFrameSkip(Number(pipe.config?.frameSkip || 0));
      setInferenceFps(Number(pipe.config?.inferenceFps || 15));
    } else {
      setSimilarityThreshold(Number(pipe.config?.similarityThreshold || 0.78));
      setRetrievalTopK(Number(pipe.config?.retrievalTopK || 5));
      setCooldown(Number(pipe.config?.cooldown || 60));
    }
  };

  const resetBuilderState = () => {
    setEditingPipelineId(null);
    setSelectedCameraIds([]);
    setFlowName('');
    setMonitoringMode('smart');
    setUserDescription('');
    setRoutedModelName('YOLO-NAS-S');
    setRoutedModelReason('Mặc định');
    setSearchQuery('');
    setCameraSearch('');
    setScheduleStart('00:00');
    setScheduleEnd('23:59');
    setCountingType('line');
    setZoneName('Vùng giám sát A');
    setDetectionTarget('person');
    setCustomTarget('');
    setDetectionRule('enter_area');
    setAlertDuration(10);
    setAlertCount(1);
    setCooldown(60);
    setConfidence(0.65);
    setIou(0.45);
    setTracker('bytetrack');
    setFrameSkip(0);
    setInferenceFps(15);
    setSearchScope('whole_scene');
    setSimilarityThreshold(0.78);
    setRetrievalTopK(5);
    setChannels({ zalo: true, email: false, telegram: false, webhook: false });
    setZoneDrawings({});
    setActiveZoneCamIdx(0);
    setRuleCondition('count_lt_min');
    setRuleSeverity('warning');
    setRuleAction('Gửi cảnh báo đa kênh');
  };

  const inferMonitoringConfig = (text: string, hasRoi: boolean): InferredMonitoringConfig => {
    const lowerText = text.toLowerCase();
    const ppeKeywords = ['mũ', 'áo phản quang', 'bảo hộ', 'ppe', 'an toàn'];
    const vehicleKeywords = ['xe', 'ô tô', 'oto', 'ôto', 'xe máy', 'motorcycle', 'truck', 'tải'];
    const personKeywords = ['người', 'khách', 'nhân viên', 'công nhân', 'person'];
    const countKeywords = ['đếm', 'số lượng', 'bao nhiêu', 'count'];
    const lineKeywords = ['vào ra', 'ra vào', 'đi qua', 'qua cổng', 'cross', 'line'];
    const intrusionKeywords = ['xâm nhập', 'đi vào', 'vào khu vực', 'enter'];
    const exitKeywords = ['rời khỏi', 'đi ra', 'exit'];
    const loiteringKeywords = ['lảng vảng', 'ở lại lâu', 'loiter', 'quá lâu'];
    const defectKeywords = ['lỗi', 'móp', 'rách', 'xước', 'hỏng', 'defect'];
    const abandonedKeywords = ['bỏ lại', 'leaving', 'balo', 'ba lô', 'túi'];
    const removalKeywords = ['lấy hàng', 'lấy khỏi', 'remove', 'removes'];

    const hasPpe = ppeKeywords.some(kw => lowerText.includes(kw));
    const hasVehicle = vehicleKeywords.some(kw => lowerText.includes(kw));
    const hasPerson = personKeywords.some(kw => lowerText.includes(kw));
    const asksCount = countKeywords.some(kw => lowerText.includes(kw));
    const usesLine = lineKeywords.some(kw => lowerText.includes(kw));
    const usesKnownTarget = hasPerson || hasVehicle;
    const needsOpenVocabulary = hasPpe
      || defectKeywords.some(kw => lowerText.includes(kw))
      || abandonedKeywords.some(kw => lowerText.includes(kw))
      || removalKeywords.some(kw => lowerText.includes(kw))
      || (!usesKnownTarget && text.trim().length > 0);

    if (!needsOpenVocabulary && usesKnownTarget) {
      const target = hasVehicle ? 'vehicle' : 'person';
      const rule = usesLine
        ? 'cross_line'
        : exitKeywords.some(kw => lowerText.includes(kw))
          ? 'exit_area'
          : intrusionKeywords.some(kw => lowerText.includes(kw))
            ? 'enter_area'
            : loiteringKeywords.some(kw => lowerText.includes(kw))
              ? 'loitering'
              : asksCount
                ? 'object_counting'
                : 'appear';

      return {
        mode: 'standard',
        model: 'YOLO-NAS-S',
        target,
        rule,
        scope: hasRoi ? 'roi' : 'whole_scene',
        countingType: usesLine || rule === 'cross_line' ? 'line' : 'zone',
        config: {
          alertDuration: loiteringKeywords.some(kw => lowerText.includes(kw)) ? 60 : 10,
          alertCount: asksCount ? maxLimit : 1,
          cooldown: lowerText.includes('ngay') ? 15 : 60,
          confidence: 0.65,
          iou: 0.45,
          tracker: 'bytetrack',
          frameSkip: usesLine ? 0 : 1,
          inferenceFps: 15,
        },
      };
    }

    const rule = hasPpe
      ? 'safety_violation'
      : defectKeywords.some(kw => lowerText.includes(kw))
        ? 'defect_detected'
        : abandonedKeywords.some(kw => lowerText.includes(kw))
          ? 'abandoned_object'
          : removalKeywords.some(kw => lowerText.includes(kw))
            ? 'object_removed'
            : intrusionKeywords.some(kw => lowerText.includes(kw))
              ? 'enter_area'
              : asksCount
                ? 'object_counting'
                : 'semantic_match';

    return {
      mode: 'smart',
      model: hasPpe ? 'YOLO-NAS + LocateAnything (Crop Mode)' : 'LocateAnything-3B',
      rule,
      scope: hasRoi ? 'roi' : 'whole_scene',
      countingType: 'zone',
      searchQuery: hasPpe ? 'người không đội mũ bảo hộ, người không mặc áo phản quang' : text,
      config: {
        similarityThreshold: defectKeywords.some(kw => lowerText.includes(kw)) ? 0.82 : 0.78,
        retrievalTopK: hasRoi ? 5 : 8,
        cooldown: lowerText.includes('ngay') ? 15 : 60,
      },
    };
  };

  const handleDescriptionChange = (text: string) => {
    setUserDescription(text);

    if (text.trim().length === 0) {
      setRoutedModelName('Chưa xác định');
      setRoutedModelReason('Vui lòng mô tả yêu cầu của bạn.');
      return;
    }

    const inferred = inferMonitoringConfig(text, currentDrawPoints.length > 0);
    setMonitoringMode(inferred.mode);
    setRoutedModelName(inferred.model);
    setRoutedModelReason(inferred.mode === 'standard'
      ? 'Tự suy luận cấu hình YOLO chuẩn từ đối tượng và rule trong mô tả.'
      : 'Tự suy luận cấu hình LocateAnything từ mô tả ngôn ngữ tự nhiên.');
    setCountingType(inferred.countingType);
    setRuleCondition(inferred.rule);
    setSearchScope(inferred.scope);
    setSearchQuery(inferred.searchQuery || '');

    if (inferred.mode === 'standard') {
      setDetectionTarget(inferred.target || 'person');
      setDetectionRule(inferred.rule);
      setAlertDuration(Number(inferred.config.alertDuration || 10));
      setAlertCount(Number(inferred.config.alertCount || 1));
      setConfidence(Number(inferred.config.confidence || 0.65));
      setIou(Number(inferred.config.iou || 0.45));
      setTracker(String(inferred.config.tracker || 'bytetrack'));
      setFrameSkip(Number(inferred.config.frameSkip || 0));
      setInferenceFps(Number(inferred.config.inferenceFps || 15));
    } else {
      setSimilarityThreshold(Number(inferred.config.similarityThreshold || 0.78));
      setRetrievalTopK(Number(inferred.config.retrievalTopK || 5));
    }
    setCooldown(Number(inferred.config.cooldown || 60));
  };

  const applyTemplate = (tpl: any) => {
    handleDescriptionChange(tpl.description || '');
    if (tpl.countingType) setCountingType(tpl.countingType);
    if (tpl.ruleCondition) setRuleCondition(tpl.ruleCondition);
    setZoneName(tpl.countingType === 'line' ? 'Vạch kiểm soát chính' : 'Vùng giới hạn an toàn');
  };

  const handleNext = () => {
    const stepOrder: PipelineStep[] = ['camera', 'task', 'zone', 'alert', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep as PipelineStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: PipelineStep[] = ['camera', 'task', 'zone', 'alert', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep as PipelineStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleSave = () => {
    const existingPipeline = editingPipelineId ? pipelines.find(p => p.id === editingPipelineId) : undefined;
    const newPipelines = selectedCameraIds.map(cameraId => {
      const cam = cameras.find(c => c.id === cameraId);
      const camPoints = zoneDrawings[cameraId] || [];
      const hasDrawnScope = camPoints.length > 0;
      const inferred = inferMonitoringConfig(userDescription, hasDrawnScope);
      const zonePoints = hasDrawnScope && countingType === 'zone'
        ? camPoints
        : [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ];
      const zones: CountingZone[] = [{
        id: `zone-${Date.now()}-${cameraId}`,
        name: hasDrawnScope ? zoneName : 'Toàn khung hình',
        type: hasDrawnScope ? countingType : 'zone',
        points: zonePoints,
        lineStart: hasDrawnScope && countingType === 'line' && camPoints.length >= 2 ? camPoints[0] : undefined,
        lineEnd: hasDrawnScope && countingType === 'line' && camPoints.length >= 2 ? camPoints[camPoints.length - 1] : undefined,
        count: 0,
        inCount: hasDrawnScope && countingType === 'line' ? 0 : undefined,
        outCount: hasDrawnScope && countingType === 'line' ? 0 : undefined,
      }];
      return {
        id: editingPipelineId || `pipe-${Date.now()}-${cameraId}`,
        name: flowName.trim() || `Luồng giám sát - ${cam?.name.split(' ')[1] || 'Camera'}`,
        cameraId,
        detectorName: inferred.model,
        monitoringMode: inferred.mode,
        detectionTarget: inferred.target,
        detectionRule: inferred.rule,
        searchScope: inferred.scope,
        config: inferred.config,
        searchQuery: inferred.searchQuery || undefined,
        description: userDescription || undefined,
        countingZones: zones,
        alertChannels: channels,
        scheduleStart: scheduleStart !== '00:00' || scheduleEnd !== '23:59' ? scheduleStart : undefined,
        scheduleEnd: scheduleStart !== '00:00' || scheduleEnd !== '23:59' ? scheduleEnd : undefined,
        isActive: existingPipeline?.isActive ?? true,
        createdAt: existingPipeline?.createdAt || new Date().toISOString(),
      } as Pipeline;
    });

    setPipelines(prev => {
      if (editingPipelineId) {
        const next = prev.filter(p => p.id !== editingPipelineId);
        return [...newPipelines, ...next];
      }
      return [...newPipelines, ...prev];
    });
    const savedCameraId = selectedCameraIds[0];
    setCurrentStep('list');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
    if (onSelectCamera && savedCameraId) {
      onSelectCamera(savedCameraId);
    }
    resetBuilderState();
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
              { key: 'task', label: '2. Mô tả', icon: <FileText size={14} /> },
              { key: 'zone', label: '3. ROI', icon: <Sliders size={14} /> },
              { key: 'alert', label: '4. Thông báo', icon: <Bell size={14} /> },
              { key: 'preview', label: '5. Preview', icon: <Check size={14} /> },
            ].map((s, idx) => {
              const stepOrder = ['camera', 'task', 'zone', 'alert', 'preview'];
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
                  {idx < 4 && <div className="h-[1px] w-4 md:w-8 bg-slate-200 ml-1 md:ml-2" />}
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
                onClick={() => {
                  resetBuilderState();
                  setCurrentStep('camera');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <span>+ Tạo Luồng Mới</span>
              </button>
            </div>

            {pipelines.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">Chưa có luồng giám sát nào đang chạy.</p>
                <button
                  onClick={() => {
                    resetBuilderState();
                    setCurrentStep('camera');
                  }}
                  className="text-emerald-600 font-bold text-sm mt-3 hover:underline"
                >
                  Tạo ngay
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Luồng giám sát</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Camera</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cấu hình AI</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Lịch chạy</th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pipelines.map(pipe => {
                        const cam = cameras.find(c => c.id === pipe.cameraId);
                        const schedule = pipe.scheduleStart && pipe.scheduleEnd ? `${pipe.scheduleStart} - ${pipe.scheduleEnd}` : '24/7';
                        const usesFullFrame = pipe.countingZones.length === 0 || pipe.countingZones.some(zone => zone.name === 'Toàn khung hình');
                        return (
                          <tr key={pipe.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 align-middle">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                pipe.isActive
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                                  : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                              }`}>
                                {pipe.isActive && <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                </span>}
                                {pipe.isActive ? 'Đang bật' : 'Đang tắt'}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div className="font-bold text-sm text-slate-800">{pipe.name}</div>
                              {pipe.searchQuery && (
                                <div className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400">{pipe.searchQuery}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex items-start gap-2 text-xs text-slate-600">
                                <CamIcon size={13} className="mt-0.5 shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-700 truncate">{cam?.name || 'Camera'}</div>
                                  <div className="mt-0.5 text-[11px] text-slate-400 truncate">{cam?.location || 'Chưa có vị trí'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                                  <Sliders size={10} /> {usesFullFrame ? 'Toàn khung hình' : 'Vùng đã vẽ'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-middle text-xs font-medium text-slate-600">{schedule}</td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => hydratePipelineForEdit(pipe)}
                                  className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                                  title="Sửa pipeline"
                                >
                                  <Pencil size={12} />
                                  Sửa
                                </button>
                                <button
                                  onClick={() => setPipelines(prev => prev.map(p2 => p2.id === pipe.id ? { ...p2, isActive: !p2.isActive } : p2))}
                                  className={`text-[10px] px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                                    pipe.isActive
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {pipe.isActive ? 'Tắt' : 'Bật'}
                                </button>
                                <button
                                  onClick={() => setPipelines(prev => prev.filter(p2 => p2.id !== pipe.id))}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xoá pipeline"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
              <h3 className="text-base font-bold text-slate-800">Mô tả nhu cầu giám sát</h3>
              <p className="text-xs text-slate-500 mt-1">Người dùng chỉ cần mô tả bài toán. Hệ thống tự chọn model, rule và tham số phù hợp ở phía sau.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tên luồng</label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="VD: Giám sát kệ hàng khu A"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <FileText className="text-emerald-600" size={18} />
                  Bạn muốn giám sát điều gì?
                </label>
                <textarea
                  value={userDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder='Ví dụ: "Cảnh báo khi có người lấy hàng khỏi kệ A" hoặc "Tìm người bỏ lại balo trong khu vực chờ"'
                  className="mt-3 w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 resize-none transition-all"
                />
              </div>

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
                <span className="text-[10px] text-slate-400">(00:00 - 23:59 = chạy 24/7)</span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'config' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {monitoringMode === 'standard' ? 'Configure Standard Monitoring' : 'Configure Smart Monitoring'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {monitoringMode === 'standard'
                  ? 'Chọn đối tượng, luật phát hiện, ngưỡng cảnh báo và tham số nâng cao.'
                  : 'Nhập mô tả tự nhiên, phạm vi tìm kiếm, thời gian chạy và tham số truy xuất.'}
              </p>
            </div>

            {monitoringMode === 'standard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Detection target</label>
                    <select
                      value={detectionTarget}
                      onChange={(e) => setDetectionTarget(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                    >
                      <option value="person">Person</option>
                      <option value="vehicle">Vehicle</option>
                      <option value="bicycle">Bicycle</option>
                      <option value="motorcycle">Motorcycle</option>
                      <option value="truck">Truck</option>
                      <option value="animal">Animal</option>
                      <option value="custom">Custom class</option>
                    </select>
                  </div>
                  {detectionTarget === 'custom' && (
                    <input
                      type="text"
                      value={customTarget}
                      onChange={(e) => setCustomTarget(e.target.value)}
                      placeholder="Nhập custom class"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                    />
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Detection rule</label>
                    <select
                      value={detectionRule}
                      onChange={(e) => setDetectionRule(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                    >
                      <option value="enter_area">Enter area</option>
                      <option value="exit_area">Exit area</option>
                      <option value="cross_line">Cross line</option>
                      <option value="appear">Appear</option>
                      <option value="disappear">Disappear</option>
                      <option value="loitering">Loitering</option>
                      <option value="object_counting">Object counting</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Duration</label>
                      <input type="number" value={alertDuration} onChange={(e) => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Count</label>
                      <input type="number" value={alertCount} onChange={(e) => setAlertCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Cooldown</label>
                      <input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Confidence</label>
                      <input type="number" step="0.01" min="0" max="1" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">IOU</label>
                      <input type="number" step="0.01" min="0" max="1" value={iou} onChange={(e) => setIou(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tracker</label>
                      <select value={tracker} onChange={(e) => setTracker(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                        <option value="bytetrack">ByteTrack</option>
                        <option value="deepsort">DeepSORT</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Frame skip</label>
                      <input type="number" min="0" value={frameSkip} onChange={(e) => setFrameSkip(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Inference FPS</label>
                      <input type="number" min="1" value={inferenceFps} onChange={(e) => setInferenceFps(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <FileText className="text-emerald-600" size={18} />
                  Natural language description
                </label>
                <textarea
                  value={userDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder='Ví dụ: "Cảnh báo khi có người lấy hàng khỏi kệ A" hoặc "Tìm người bỏ lại balo trong khu vực chờ"'
                  className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 resize-none transition-all"
                />

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Search scope</label>
                    <select value={searchScope} onChange={(e) => setSearchScope(e.target.value as 'whole_scene' | 'roi')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
                      <option value="whole_scene">Whole scene</option>
                      <option value="roi">ROI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Similarity threshold</label>
                    <input type="number" step="0.01" min="0" max="1" value={similarityThreshold} onChange={(e) => setSimilarityThreshold(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Retrieval top-k</label>
                    <input type="number" min="1" value={retrievalTopK} onChange={(e) => setRetrievalTopK(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Cooldown</label>
                    <input type="number" min="0" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
                  </div>
                </div>
              </div>
            )}

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
              <span className="text-[10px] text-slate-400">(00:00 - 23:59 = chạy 24/7)</span>
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
                    <h4 className="font-semibold text-xs text-slate-800">Popup</h4>
                    <p className="text-[10px] text-slate-400">Hiển thị cảnh báo trực tiếp trên giao diện</p>
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
                    <h4 className="font-semibold text-xs text-slate-800">Email</h4>
                    <p className="text-[10px] text-slate-400">Gửi ảnh và thông tin sự kiện qua email</p>
                  </div>
                </div>
                <input type="checkbox" checked={channels.email} onChange={() => setChannels(prev => ({ ...prev, email: !prev.email }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              </label>

              <label className={`border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${
                channels.webhook ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <Webhook size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Webhook</h4>
                    <p className="text-[10px] text-slate-400">Gửi sự kiện sang hệ thống bên ngoài</p>
                  </div>
                </div>
                <input type="checkbox" checked={channels.webhook} onChange={() => setChannels(prev => ({ ...prev, webhook: !prev.webhook }))} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              </label>

              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between bg-slate-50/50 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-200 text-slate-500 rounded-xl">
                    <Send size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800">Telegram Bot</h4>
                    <p className="text-[10px] text-slate-400">Chưa được cấu hình</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-200/50 px-2 py-1 rounded">Chưa cấu hình</span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Preview Configuration</h3>
              <p className="text-xs text-slate-500 mt-1">Kiểm tra cấu hình trước khi lưu và triển khai luồng giám sát.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Thông tin chung</div>
                <div className="text-sm font-bold text-slate-800">{flowName.trim() || 'Luồng giám sát mới'}</div>
                <div className="text-xs text-slate-600">Camera: {selectedCameraIds.length} camera đã chọn</div>
                <div className="text-xs text-slate-600">
                  ROI: {currentDrawPoints.length > 0 ? 'Vùng/vạch đã vẽ' : 'Toàn khung hình'}
                </div>
                <div className="text-xs text-slate-600">Lịch chạy: {scheduleStart === '00:00' && scheduleEnd === '23:59' ? '24/7' : `${scheduleStart} - ${scheduleEnd}`}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nhu cầu giám sát</div>
                <div className="text-xs text-slate-600">{userDescription || 'Chưa nhập mô tả'}</div>
                <div className="text-xs text-slate-600">
                  Cảnh báo: {[
                    channels.zalo ? 'Popup' : '',
                    channels.email ? 'Email' : '',
                    channels.webhook ? 'Webhook' : '',
                  ].filter(Boolean).join(', ') || 'Không gửi'}
                </div>
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

            {currentStep === 'preview' ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check size={14} /> Lưu & Triển khai AI
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
