import React, { useState, Dispatch, SetStateAction } from 'react';
import { Camera, Pipeline, CountingZone, PipelineStep, AlertRule } from '../types';
import { PIPELINE_TEMPLATES } from '../mockData';
import { Check, Camera as CamIcon, Cpu, Sliders, Bell, AlertCircle, ArrowRight, ArrowLeft, MessageSquare, Send, Mail, Webhook, FileText, Clock, ChevronRight, Trash2, Pencil, X, LayoutGrid, Shield, BarChart3, HardHat, Flame, Car, Package, Tag, Bug, Search, Activity, UserCheck, Store, Sparkles } from 'lucide-react';
import ImageRoiDrawer, { BoundingBox } from './ImageRoiDrawer';

interface PipelineBuilderProps {
  cameras: Camera[];
  pipelines: Pipeline[];
  setPipelines: Dispatch<SetStateAction<Pipeline[]>>;
  setRules?: Dispatch<SetStateAction<AlertRule[]>>;
  onComplete: () => void;
  onSelectCamera?: (id: string) => void;
}

type InferredMonitoringConfig = {
  mode: 'standard' | 'smart' | 'defect_detection';
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
  const [monitoringMode, setMonitoringMode] = useState<'standard' | 'smart' | 'defect_detection'>('smart');
  const [inferredMode, setInferredMode] = useState<'standard' | 'smart' | 'defect_detection'>('smart');
  const [userDescription, setUserDescription] = useState('');
  const [taskType, setTaskType] = useState<string>('security');
  
  // New task specific states
  const [countingDirection, setCountingDirection] = useState<'in' | 'out' | 'both'>('both');
  const [ppeItems, setPpeItems] = useState({ hardhat: true, vest: true, glove: false, mask: false });
  const [fireSensitivity, setFireSensitivity] = useState<'low' | 'medium' | 'high'>('high');
  const [behaviorItems, setBehaviorItems] = useState({
    fall: false,
    violence: false,
    crowd: false,
    smoking: false,
    phone: false,
    weapon: false,
  });
  const [faceConfidence, setFaceConfidence] = useState(0.8);
  const [retailMode, setRetailMode] = useState<'heatmap' | 'demographics'>('heatmap');
  
  // Defect Detection states
  const [goldenSamples, setGoldenSamples] = useState<string[]>([]);
  const [inspectionROIs, setInspectionROIs] = useState<Record<number, BoundingBox[]>>({});
  const [enableSSIM, setEnableSSIM] = useState(true);
  const [enableCNN, setEnableCNN] = useState(false);
  const [enableOCR, setEnableOCR] = useState(false);
  const [expectedOCRText, setExpectedOCRText] = useState('');
  const [defectSensitivity, setDefectSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
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
  const [standardFunction, setStandardFunction] = useState<'security' | 'counting'>('security');
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
      if (pipe.detectionRule === 'object_counting' || pipe.detectionRule === 'counting') {
        setStandardFunction('counting');
        setDetectionRule('object_counting');
      } else {
        setStandardFunction('security');
        setDetectionRule(pipe.detectionRule || 'enter_area');
      }
      setAlertDuration(Number(pipe.config?.alertDuration || 10));
      setAlertCount(Number(pipe.config?.alertCount || 1));
      setCooldown(Number(pipe.config?.cooldown || 60));
      setConfidence(Number(pipe.config?.confidence || 0.65));
      setIou(Number(pipe.config?.iou || 0.45));
      setTracker(String(pipe.config?.tracker || 'bytetrack'));
      setFrameSkip(Number(pipe.config?.frameSkip || 0));
      setInferenceFps(Number(pipe.config?.inferenceFps || 15));
    } else if (pipe.monitoringMode === 'smart') {
      setSimilarityThreshold(Number(pipe.config?.similarityThreshold || 0.78));
      setRetrievalTopK(Number(pipe.config?.retrievalTopK || 5));
      setCooldown(Number(pipe.config?.cooldown || 60));
    } else if (pipe.monitoringMode === 'defect_detection') {
      setGoldenSamples((pipe.config?.goldenSamples as unknown) as string[] || []);
      setEnableSSIM(Boolean(pipe.config?.enableSSIM ?? true));
      setEnableCNN(Boolean(pipe.config?.enableCNN ?? false));
      setEnableOCR(Boolean(pipe.config?.enableOCR ?? false));
      setExpectedOCRText(String(pipe.config?.expectedOCRText || ''));
      setDefectSensitivity(pipe.config?.defectSensitivity as 'low'|'medium'|'high' || 'medium');
      setInspectionROIs((pipe.config?.inspectionROIs as unknown) as Record<number, BoundingBox[]> || {});
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
    setGoldenSamples([]);
    setEnableSSIM(true);
    setEnableCNN(false);
    setEnableOCR(false);
    setExpectedOCRText('');
    setDefectSensitivity('medium');
    setInspectionROIs({});
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
        alertDuration: loiteringKeywords.some(kw => lowerText.includes(kw)) ? 60 : 10,
        alertCount: asksCount ? maxLimit : 1,
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
    setInferredMode(inferred.mode);
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
      setConfidence(Number(inferred.config.confidence || 0.65));
      setIou(Number(inferred.config.iou || 0.45));
      setTracker(String(inferred.config.tracker || 'bytetrack'));
      setFrameSkip(Number(inferred.config.frameSkip || 0));
      setInferenceFps(Number(inferred.config.inferenceFps || 15));
    } else {
      setSimilarityThreshold(Number(inferred.config.similarityThreshold || 0.78));
      setRetrievalTopK(Number(inferred.config.retrievalTopK || 5));
    }
    
    setDetectionRule(inferred.rule);
    setAlertDuration(Number(inferred.config.alertDuration || 10));
    setAlertCount(Number(inferred.config.alertCount || 1));
    setCooldown(Number(inferred.config.cooldown || 60));
  };

  const applyTemplate = (tpl: any) => {
    handleDescriptionChange(tpl.description || '');
    if (tpl.countingType) setCountingType(tpl.countingType);
    if (tpl.ruleCondition) setRuleCondition(tpl.ruleCondition);
    setZoneName(tpl.countingType === 'line' ? 'Vạch kiểm soát chính' : 'Vùng giới hạn an toàn');
  };

  const PIPELINE_STEPS: PipelineStep[] = ['camera', 'task', 'mode', 'config', 'zone', 'alert', 'preview'];

  const handleNext = () => {
    if (currentStep === 'task') {
      if (taskType.startsWith('defect_')) {
        setMonitoringMode('defect_detection');
        setCurrentStep('config');
        return;
      } else if (taskType === 'counting') {
        setStandardFunction('counting');
      } else {
        setStandardFunction('security');
        // Preset targets for specific domains if they choose standard mode later
        if (taskType === 'ppe') { setDetectionTarget('person'); setCustomTarget(''); }
        if (taskType === 'traffic') { setDetectionTarget('vehicle'); setCustomTarget(''); }
      }
    }
    
    const currentIndex = PIPELINE_STEPS.indexOf(currentStep as PipelineStep);
    if (currentIndex < PIPELINE_STEPS.length - 1) {
      setCurrentStep(PIPELINE_STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStep === 'config' && taskType.startsWith('defect_')) {
      setCurrentStep('task');
      return;
    }
    const currentIndex = PIPELINE_STEPS.indexOf(currentStep as PipelineStep);
    if (currentIndex > 0) {
      setCurrentStep(PIPELINE_STEPS[currentIndex - 1]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        alert('File quá lớn. Vui lòng chọn ảnh dưới 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setGoldenSamples(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset input value so same file can be selected again if removed
    e.target.value = '';
  };

  const removeGoldenSample = (index: number) => {
    setGoldenSamples(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const existingPipeline = editingPipelineId ? pipelines.find(p => p.id === editingPipelineId) : undefined;
    const newPipelines = selectedCameraIds.map(cameraId => {
      const cam = cameras.find(c => c.id === cameraId);
      const camPoints = zoneDrawings[cameraId] || [];
      const hasDrawnScope = camPoints.length > 0;
      
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
      
      let finalConfig: Record<string, any> = {};
      let finalTarget = undefined;
      let finalRule = 'semantic_match';
      
      if (monitoringMode === 'standard') {
        finalTarget = detectionTarget === 'custom' ? customTarget : detectionTarget;
        finalRule = detectionRule;
        finalConfig = { alertDuration, alertCount, cooldown, confidence, iou, tracker, frameSkip, inferenceFps };
      } else if (monitoringMode === 'smart') {
        finalRule = ruleCondition;
        finalConfig = { similarityThreshold, retrievalTopK, cooldown };
      } else if (monitoringMode === 'defect_detection') {
        finalRule = 'defect_detected';
        finalConfig = {
          goldenSamples,
          inspectionROIs,
          enableSSIM,
          enableCNN,
          enableOCR,
          expectedOCRText,
          alertDuration,
          alertCount,
          cooldown
        };
      }

      return {
        id: editingPipelineId || `pipe-${Date.now()}-${cameraId}`,
        name: flowName.trim() || `Luồng giám sát - ${cam?.name.split(' ')[1] || 'Camera'}`,
        cameraId,
        detectorName: routedModelName,
        monitoringMode: monitoringMode,
        detectionTarget: finalTarget,
        detectionRule: finalRule,
        searchScope: searchScope,
        config: finalConfig,
        searchQuery: monitoringMode === 'smart' ? searchQuery : undefined,
        description: monitoringMode === 'smart' ? userDescription : undefined,
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
    <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden w-full h-full flex flex-col" id="pipeline-builder-container">
      {savedToast && (
        <div className="fixed bottom-5 right-5 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          ✓ Kích hoạt luồng AI mới thành công!
        </div>
      )}
      <div className="bg-white border-b border-slate-100 px-6 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner border border-emerald-100">
            <Sparkles size={28} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Trợ lý Cấu hình AI thông minh</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">Tạo và quản lý các luồng xử lý AI (Pipeline) cho hệ thống camera của bạn</p>
          </div>
        </div>
      </div>

      {currentStep !== 'list' && (
        <div className="border-b border-slate-100 px-4 md:px-8 pt-6 pb-4 bg-slate-50 overflow-hidden">
          <div className="relative flex items-start justify-between w-full mx-auto px-4 lg:px-12">
            {/* Background Line */}
            <div className="absolute left-0 top-4 -translate-y-1/2 w-full h-[3px] bg-slate-200 rounded-full z-0" />
            
            {/* Active Progress Line */}
            <div 
              className="absolute left-0 top-4 -translate-y-1/2 h-[3px] bg-emerald-500 rounded-full transition-all duration-700 ease-in-out z-0"
              style={{ width: `${(['camera', 'task', 'mode', 'config', 'zone', 'alert', 'preview'].indexOf(currentStep) / 6) * 100}%` }}
            />

            {[
              { key: 'camera', label: '1. Camera', icon: <CamIcon size={14} /> },
              { key: 'task', label: '2. Nghiệp vụ', icon: <FileText size={14} /> },
              { key: 'mode', label: '3. Loại', icon: <Cpu size={14} /> },
              { key: 'config', label: '4. Cấu hình', icon: <Sliders size={14} /> },
              { key: 'zone', label: '5. ROI', icon: <LayoutGrid size={14} /> },
              { key: 'alert', label: '6. Báo động', icon: <Bell size={14} /> },
              { key: 'preview', label: '7. Preview', icon: <Check size={14} /> },
            ].map((s) => {
              const PIPELINE_STEPS: PipelineStep[] = ['camera', 'task', 'mode', 'config', 'zone', 'alert', 'preview'];
              const stepIndex = PIPELINE_STEPS.indexOf(s.key as PipelineStep);
              const currentIndex = PIPELINE_STEPS.indexOf(currentStep as PipelineStep);
              const isCompleted = currentIndex > stepIndex;
              const isActive = currentStep === s.key;

              return (
                <div key={s.key} className="relative z-10 flex flex-col items-center w-12 md:w-16">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full transition-all duration-500 shadow-sm ${
                    isCompleted ? 'bg-emerald-600 text-white' : isActive ? 'bg-white border-2 border-emerald-500 text-emerald-600 ring-4 ring-emerald-50' : 'bg-slate-100 border-2 border-slate-200 text-slate-400'
                  }`}>
                    {isCompleted ? <Check size={16} strokeWidth={3} /> : s.icon}
                  </div>
                  <span className={`mt-2 text-[9px] md:text-[11px] font-bold text-center whitespace-nowrap transition-colors duration-300 ${
                    isActive ? 'text-emerald-700' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {s.label.substring(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
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
              <h3 className="text-base font-bold text-slate-800">Chọn bài toán & Đặt tên tác vụ</h3>
              <p className="text-xs text-slate-500 mt-1">Chọn nghiệp vụ thực tế bạn muốn giải quyết và thiết lập thông tin cơ bản.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Nghiệp vụ thực tế</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'security' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'security'} onChange={() => setTaskType('security')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Shield size={18} className={taskType === 'security' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'security' ? 'text-emerald-800' : 'text-slate-700'}`}>Giám sát An ninh</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Phát hiện xâm nhập trái phép, đột nhập, mất cắp, gây rối</p>
                  </label>
                  
                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'counting' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'counting'} onChange={() => setTaskType('counting')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} className={taskType === 'counting' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'counting' ? 'text-emerald-800' : 'text-slate-700'}`}>Đếm lưu lượng</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Đếm số lượng người, xe cộ, hàng hóa ra vào qua vạch kẻ</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'defect_surface' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'defect_surface'} onChange={() => setTaskType('defect_surface')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Search size={18} className={taskType === 'defect_surface' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'defect_surface' ? 'text-emerald-800' : 'text-slate-700'}`}>Lỗi bề mặt</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Phát hiện vết xước, nứt vỡ, rỗ khí, biến dạng trên bề mặt sản phẩm</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'defect_assembly' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'defect_assembly'} onChange={() => setTaskType('defect_assembly')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Package size={18} className={taskType === 'defect_assembly' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'defect_assembly' ? 'text-emerald-800' : 'text-slate-700'}`}>Lỗi lắp ráp & Đóng gói</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Phát hiện thiếu linh kiện, ốc vít, sai vị trí, đóng gói sai quy cách</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'defect_label' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'defect_label'} onChange={() => setTaskType('defect_label')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Tag size={18} className={taskType === 'defect_label' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'defect_label' ? 'text-emerald-800' : 'text-slate-700'}`}>Kiểm tra tem nhãn</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Kiểm tra nhãn mác, đọc mã vạch (OCR), kiểm tra hạn sử dụng</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'defect_foreign' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'defect_foreign'} onChange={() => setTaskType('defect_foreign')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Bug size={18} className={taskType === 'defect_foreign' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'defect_foreign' ? 'text-emerald-800' : 'text-slate-700'}`}>Phát hiện dị vật</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Phát hiện tóc, côn trùng, dị vật kim loại lẫn trong thực phẩm</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'ppe' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'ppe'} onChange={() => setTaskType('ppe')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <HardHat size={18} className={taskType === 'ppe' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'ppe' ? 'text-emerald-800' : 'text-slate-700'}`}>An toàn lao động</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Kiểm tra đồ bảo hộ (mũ, áo dạ quang, găng tay) tại công trường</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'fire' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'fire'} onChange={() => setTaskType('fire')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Flame size={18} className={taskType === 'fire' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'fire' ? 'text-emerald-800' : 'text-slate-700'}`}>Phòng cháy chữa cháy</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Cảnh báo khói, lửa, tia lửa điện tại nhà xưởng, kho bãi</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'traffic' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'traffic'} onChange={() => setTaskType('traffic')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Car size={18} className={taskType === 'traffic' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'traffic' ? 'text-emerald-800' : 'text-slate-700'}`}>Giao thông thông minh</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Đọc biển số (ALPR), phát hiện đi ngược chiều, dừng đỗ sai phép</p>
                  </label>

                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'behavior' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'behavior'} onChange={() => setTaskType('behavior')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Activity size={18} className={taskType === 'behavior' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'behavior' ? 'text-emerald-800' : 'text-slate-700'}`}>Phân tích hành vi</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Phát hiện bạo lực, té ngã, tụ tập, hút thuốc, dùng điện thoại</p>
                  </label>


                  <label className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${taskType === 'retail_analytics' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                    <input type="radio" name="taskType" checked={taskType === 'retail_analytics'} onChange={() => setTaskType('retail_analytics')} className="hidden" />
                    <div className="flex items-center gap-2">
                      <Store size={18} className={taskType === 'retail_analytics' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className={`text-sm font-bold ${taskType === 'retail_analytics' ? 'text-emerald-800' : 'text-slate-700'}`}>Phân tích Bán lẻ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 hidden md:block">Vẽ bản đồ nhiệt (Heatmap), đếm khách, phân tích tuổi, giới tính</p>
                  </label>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tên tác vụ giám sát</label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="VD: Chấm công cổng chính, Giám sát kệ hàng khu A..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                />
              </div>

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

        {currentStep === 'mode' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h3 className="text-base font-bold text-slate-800">Chọn công nghệ AI</h3>
              <p className="text-xs text-slate-500 mt-1">
                Chọn phương pháp phân tích phù hợp cho bài toán <span className="font-bold text-emerald-600">{taskType === 'security' ? 'Giám sát An ninh' : 'Đếm lưu lượng'}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => { setMonitoringMode('standard'); setCurrentStep('config'); }}
                className="text-left bg-white border-2 border-slate-200 hover:border-emerald-400 rounded-2xl p-6 transition-all group hover:shadow-md cursor-pointer flex flex-col h-full"
              >
                <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-600 group-hover:text-emerald-600 flex items-center justify-center mb-4 transition-colors shrink-0">
                  <Sliders size={24} />
                </div>
                <h4 className="font-bold text-lg text-slate-800 mb-2">Luồng Tiêu chuẩn</h4>
                <p className="text-sm text-slate-500 flex-grow">Sử dụng các bộ quy tắc nhận diện có sẵn (người, xe cộ,...) với tốc độ xử lý nhanh. Thích hợp cho các bài toán thông dụng.</p>
              </button>

              <button
                onClick={() => { setMonitoringMode('smart'); setCurrentStep('config'); }}
                className="text-left bg-white border-2 border-slate-200 hover:border-emerald-400 rounded-2xl p-6 transition-all group hover:shadow-md cursor-pointer flex flex-col h-full"
              >
                <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-600 group-hover:text-emerald-600 flex items-center justify-center mb-4 transition-colors shrink-0">
                  <Cpu size={24} />
                </div>
                <h4 className="font-bold text-lg text-slate-800 mb-2">Luồng Thông minh</h4>
                <p className="text-sm text-slate-500 flex-grow">Ứng dụng AI phân tích ngôn ngữ tự nhiên. Bạn chỉ cần gõ yêu cầu (VD: "Tìm người đội nón đỏ"), hệ thống sẽ tự hiểu và tìm kiếm mà không cần cài đặt luật phức tạp.</p>
              </button>
            </div>
          </div>
        )}

        {currentStep === 'config' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {monitoringMode === 'standard' ? 'Cấu hình Luồng Tiêu chuẩn' : monitoringMode === 'smart' ? 'Cấu hình Luồng Thông minh' : 'Cấu hình Kiểm tra Ngoại quan'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {monitoringMode === 'standard'
                  ? 'Chọn đối tượng, luật phát hiện, ngưỡng cảnh báo và tham số nâng cao.'
                  : monitoringMode === 'smart'
                    ? 'Nhập mô tả tự nhiên, phạm vi tìm kiếm, thời gian chạy và tham số truy xuất.'
                    : 'Upload ảnh chuẩn, chọn vùng kiểm tra và cấu hình thuật toán phát hiện lỗi.'}
              </p>
            </div>

            {monitoringMode === 'standard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  {taskType === 'security' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Đối tượng phát hiện</label>
                        <select
                          value={detectionTarget}
                          onChange={(e) => setDetectionTarget(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="person">Người</option>
                          <option value="vehicle">Phương tiện (chung)</option>
                          <option value="custom">Đối tượng tuỳ chỉnh</option>
                        </select>
                      </div>
                      {detectionTarget === 'custom' && (
                        <input
                          type="text"
                          value={customTarget}
                          onChange={(e) => setCustomTarget(e.target.value)}
                          placeholder="Nhập tên đối tượng tiếng anh (VD: box, helmet)"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        />
                      )}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Luật phát hiện cảnh báo</label>
                        <select
                          value={detectionRule === 'object_counting' ? 'enter_area' : detectionRule}
                          onChange={(e) => setDetectionRule(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="enter_area">Xâm nhập trái phép (Đi vào vùng cấm)</option>
                          <option value="exit_area">Rời khỏi khu vực (Đi ra khỏi vùng)</option>
                          <option value="cross_line">Vượt ranh giới ảo (Cắt ngang vạch)</option>
                          <option value="appear">Phát hiện vật thể lạ (Xuất hiện trong vùng)</option>
                          <option value="disappear">Mất tài sản / Rời đi (Biến mất khỏi vùng)</option>
                          <option value="loitering">Dừng đỗ / Lảng vảng sai quy định (Dừng quá lâu)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
                        <div className="flex flex-col justify-between h-full">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Thời gian duy trì (giây)</label>
                          <input type="number" value={alertDuration} onChange={(e) => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                        </div>
                        <div className="flex flex-col justify-between h-full">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Số lượng tối thiểu</label>
                          <input type="number" value={alertCount} onChange={(e) => setAlertCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                        </div>
                        <div className="flex flex-col justify-between h-full">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tạm ngưng (giây)</label>
                          <input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                        </div>
                      </div>
                    </>
                  )}

                  {taskType === 'counting' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Đối tượng đếm</label>
                        <select
                          value={detectionTarget}
                          onChange={(e) => setDetectionTarget(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="person">Người</option>
                          <option value="vehicle">Phương tiện (chung)</option>
                          <option value="bicycle">Xe đạp</option>
                          <option value="motorcycle">Xe máy</option>
                          <option value="truck">Xe tải</option>
                          <option value="custom">Tuỳ chỉnh</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Hướng đếm (Line Crossing)</label>
                        <select
                          value={countingDirection}
                          onChange={(e) => setCountingDirection(e.target.value as 'in' | 'out' | 'both')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="in">Chỉ đếm chiều đi vào (In)</option>
                          <option value="out">Chỉ đếm chiều đi ra (Out)</option>
                          <option value="both">Đếm cả 2 chiều (Bi-directional)</option>
                        </select>
                      </div>
                    </>
                  )}

                  {taskType === 'ppe' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Cảnh báo khi KHÔNG mang</label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={ppeItems.hardhat} onChange={() => setPpeItems(p => ({ ...p, hardhat: !p.hardhat }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Mũ bảo hộ</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={ppeItems.vest} onChange={() => setPpeItems(p => ({ ...p, vest: !p.vest }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Áo dạ quang</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={ppeItems.glove} onChange={() => setPpeItems(p => ({ ...p, glove: !p.glove }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Găng tay</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={ppeItems.mask} onChange={() => setPpeItems(p => ({ ...p, mask: !p.mask }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Khẩu trang</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tạm ngưng báo động liên tục (giây)</label>
                        <input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                      </div>
                    </>
                  )}

                  {taskType === 'fire' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Đối tượng giám sát</label>
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 font-medium">
                          Mặc định: Khói (Smoke) & Lửa (Fire)
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Mức độ nhạy cảm (Sensitivity)</label>
                        <select
                          value={fireSensitivity}
                          onChange={(e) => setFireSensitivity(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="high">Cao (Báo động khi có vệt khói/lửa nhỏ)</option>
                          <option value="medium">Trung bình (Báo động khi đám cháy rõ ràng)</option>
                          <option value="low">Thấp (Tránh báo giả do hơi nước, khói thuốc)</option>
                        </select>
                      </div>
                    </>
                  )}

                  {taskType === 'traffic' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Đối tượng giao thông</label>
                        <select
                          value={detectionTarget}
                          onChange={(e) => setDetectionTarget(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="vehicle">Mọi loại xe</option>
                          <option value="car">Ô tô (Car)</option>
                          <option value="motorcycle">Xe máy (Motorcycle)</option>
                          <option value="truck">Xe tải / Xe buýt (Truck/Bus)</option>
                          <option value="license_plate">Biển số xe (License Plate)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Luật giao thông</label>
                        <select
                          value={detectionRule}
                          onChange={(e) => setDetectionRule(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="alpr">Nhận diện & Đọc biển số (ALPR)</option>
                          <option value="wrong_way">Đi ngược chiều (Wrong way)</option>
                          <option value="illegal_parking">Dừng đỗ sai quy định (Illegal parking)</option>
                          <option value="red_light">Vượt đèn đỏ (Red light violation)</option>
                        </select>
                      </div>
                      {detectionRule === 'illegal_parking' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Thời gian cho phép dừng đỗ (giây)</label>
                          <input type="number" value={alertDuration} onChange={(e) => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                        </div>
                      )}
                    </>
                  )}

                  {taskType === 'behavior' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Các hành vi bất thường cần phát hiện</label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={behaviorItems.fall} onChange={() => setBehaviorItems(p => ({ ...p, fall: !p.fall }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Té ngã / Đột quỵ</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={behaviorItems.violence} onChange={() => setBehaviorItems(p => ({ ...p, violence: !p.violence }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Đánh nhau / Ẩu đả</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={behaviorItems.crowd} onChange={() => setBehaviorItems(p => ({ ...p, crowd: !p.crowd }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Tụ tập đông người</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={behaviorItems.smoking} onChange={() => setBehaviorItems(p => ({ ...p, smoking: !p.smoking }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Hút thuốc</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={behaviorItems.phone} onChange={() => setBehaviorItems(p => ({ ...p, phone: !p.phone }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Dùng điện thoại</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                            <input type="checkbox" checked={behaviorItems.weapon} onChange={() => setBehaviorItems(p => ({ ...p, weapon: !p.weapon }))} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">Người mang vũ khí</span>
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                        <div className="flex flex-col justify-between h-full">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Thời gian duy trì hành vi (giây)</label>
                          <input type="number" value={alertDuration} onChange={(e) => setAlertDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                        </div>
                        <div className="flex flex-col justify-between h-full">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tạm ngưng báo động liên tục (giây)</label>
                          <input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                        </div>
                      </div>
                    </>
                  )}


                  {taskType === 'retail_analytics' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Chế độ phân tích bán lẻ</label>
                        <select
                          value={retailMode}
                          onChange={(e) => setRetailMode(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500"
                        >
                          <option value="heatmap">Biểu đồ nhiệt (Heatmap khu vực đông khách)</option>
                          <option value="demographics">Nhân khẩu học (Độ tuổi, Giới tính, Cảm xúc)</option>
                          <option value="flow">Luồng di chuyển khách hàng (Customer Journey)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tần suất xuất báo cáo</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-emerald-500">
                          <option value="realtime">Cập nhật theo thời gian thực (Real-time dashboard)</option>
                          <option value="hourly">Mỗi giờ 1 lần</option>
                          <option value="daily">Tổng hợp cuối ngày</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : monitoringMode === 'smart' ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <FileText className="text-emerald-600" size={18} />
                  Mô tả hành vi bằng văn bản
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  <div className="flex flex-col justify-between h-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Phạm vi tìm kiếm & cảnh báo</label>
                    <select value={searchScope} onChange={(e) => setSearchScope(e.target.value as 'whole_scene' | 'roi')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm mt-auto">
                      <option value="whole_scene">Toàn khung hình</option>
                      <option value="roi">Chỉ trong vùng chọn (ROI)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-between h-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tạm ngưng báo động liên tục (giây)</label>
                    <input type="number" min="0" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm mt-auto" />
                  </div>
                </div>

                {inferredMode === 'standard' && userDescription.trim().length > 0 && (
                  <div className="bg-slate-50 border border-emerald-200 rounded-xl p-4 mt-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sliders className="text-emerald-600" size={16} />
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Cấu hình Tự động Trích xuất (Cơ bản)</h4>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Đối tượng</label>
                        <select value={detectionTarget} onChange={(e) => setDetectionTarget(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700">
                          <option value="person">Người</option>
                          <option value="vehicle">Phương tiện</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Luật cảnh báo</label>
                        <select value={detectionRule} onChange={(e) => setDetectionRule(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700">
                          <option value="enter_area">Xâm nhập vùng</option>
                          <option value="cross_line">Cắt ngang vạch</option>
                          <option value="exit_area">Rời khỏi vùng</option>
                          <option value="loitering">Dừng đỗ/Lảng vảng</option>
                          <option value="object_counting">Đếm số lượng</option>
                          <option value="appear">Phát hiện vật thể</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Duy trì (giây)</label>
                        <input type="number" value={alertDuration} onChange={(e) => setAlertDuration(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Số lượng tối thiểu</label>
                        <input type="number" value={alertCount} onChange={(e) => setAlertCount(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700" />
                      </div>
                    </div>
                  </div>
                )}
                {inferredMode === 'smart' && userDescription.trim().length > 0 && (
                  <div className="bg-slate-50 border border-indigo-200 rounded-xl p-4 mt-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sliders className="text-indigo-600" size={16} />
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Cấu hình Tự động Trích xuất (Nâng cao)</h4>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Truy xuất (Top K)</label>
                        <input type="number" value={retrievalTopK} onChange={(e) => setRetrievalTopK(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Luật cảnh báo</label>
                        <select value={detectionRule} onChange={(e) => setDetectionRule(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700">
                          <option value="appear">Phát hiện (Có mặt)</option>
                          <option value="disappear">Biến mất (Mất cắp)</option>
                          <option value="enter_area">Xâm nhập vùng</option>
                          <option value="loitering">Dừng đỗ/Lảng vảng</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Duy trì (giây)</label>
                        <input type="number" value={alertDuration} onChange={(e) => setAlertDuration(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Số lượng tối thiểu</label>
                        <input type="number" value={alertCount} onChange={(e) => setAlertCount(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-800">Ảnh Tiêu Chuẩn (Golden Samples)</label>
                  
                  {goldenSamples.length > 0 && (
                    <div className="flex flex-col gap-4 mb-4">
                      {goldenSamples.map((imgSrc, idx) => (
                        <ImageRoiDrawer
                          key={idx}
                          imgSrc={imgSrc}
                          rois={inspectionROIs[idx] || []}
                          onChange={(rois) => setInspectionROIs(prev => ({ ...prev, [idx]: rois }))}
                          onRemove={() => {
                            removeGoldenSample(idx);
                            setInspectionROIs(prev => {
                              const next = { ...prev };
                              delete next[idx];
                              // Re-index remaining ROIs
                              const newRois: Record<number, BoundingBox[]> = {};
                              Object.keys(next).forEach(key => {
                                const k = Number(key);
                                if (k > idx) newRois[k - 1] = next[k];
                                else newRois[k] = next[k];
                              });
                              return newRois;
                            });
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                    <input type="file" accept="image/jpeg, image/png" multiple className="hidden" onChange={handleImageUpload} />
                    <div className="text-slate-500 text-sm">
                      Kéo thả hoặc click để tải lên ảnh sản phẩm chuẩn (Mặt trước, mặt sau...)
                    </div>
                    <div className="mt-2 text-xs text-slate-400">Hỗ trợ JPG, PNG (Tối đa 5MB)</div>
                  </label>
                </div>
                
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-800">Phương pháp Kiểm tra</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${enableSSIM ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={enableSSIM} onChange={e => setEnableSSIM(e.target.checked)} className="mt-1" />
                      <div>
                        <div className="font-bold text-sm text-slate-800">Kiểm tra Bề mặt</div>
                        <div className="text-xs text-slate-500">Phát hiện xước, sai lệch vị trí nhỏ.</div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${enableCNN ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={enableCNN} onChange={e => setEnableCNN(e.target.checked)} className="mt-1" />
                      <div>
                        <div className="font-bold text-sm text-slate-800">Kiểm tra Cấu trúc</div>
                        <div className="text-xs text-slate-500">Phát hiện thiếu linh kiện, sai khác lớn.</div>
                      </div>
                    </label>
                    <div className={`p-3 rounded-xl border-2 transition-all ${enableOCR ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={enableOCR} onChange={e => setEnableOCR(e.target.checked)} className="mt-1" />
                        <div>
                          <div className="font-bold text-sm text-slate-800">Đọc chữ / Nhãn mác</div>
                          <div className="text-xs text-slate-500">Kiểm tra nhãn mác, số Serial.</div>
                        </div>
                      </label>
                      {enableOCR && (
                        <div className="mt-3 pl-7">
                          <input 
                            type="text" 
                            value={expectedOCRText}
                            onChange={e => setExpectedOCRText(e.target.value)}
                            placeholder="Nhập chuỗi text kỳ vọng..."
                            className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch pt-4 border-t border-slate-100 mt-4">
                  <div className="flex flex-col justify-between h-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Số sản phẩm lỗi liên tiếp để báo động</label>
                    <input type="number" min="1" value={alertCount} onChange={(e) => setAlertCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                  </div>
                  <div className="flex flex-col justify-between h-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Tạm ngưng báo động liên tục (giây)</label>
                    <input type="number" min="0" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-auto" />
                  </div>
                </div>
              </div>
            )}

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

      <div className="border-t border-slate-100 px-8 py-5 bg-slate-50 flex items-center justify-between flex-shrink-0">
        {currentStep === 'list' ? (
          <div className="w-full flex justify-end">
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              ← Quay lại Giám sát
            </button>
          </div>
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
