import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { getLatestFrame, getLatestDetection, TrackBox } from '../api';
import { Camera, Pipeline, AlertEvent, LogEntry } from '../types';
import { Play, Pause, MoreVertical, Edit2, Trash2, AlertTriangle, Sparkles, Activity, CheckCircle, Wifi, Monitor, Usb, Camera as CameraIcon, ZoomIn, ZoomOut, Move, RotateCcw, Maximize, Maximize2, Minimize } from 'lucide-react';

interface LiveMonitorProps {
  key?: string | number;
  camera: Camera;
  pipelines: Pipeline[];
  alerts: AlertEvent[];
  setAlerts: Dispatch<SetStateAction<AlertEvent[]>>;
  logs: LogEntry[];
  setLogs: Dispatch<SetStateAction<LogEntry[]>>;
  isCompact?: boolean;
  onExpand?: () => void;
  onEditCamera?: (id: string) => void;
  onDeleteCamera?: (id: string) => void;
  onTogglePipeline?: (id: string) => void;
}

export default function LiveMonitor({
  camera,
  pipelines,
  alerts,
  setAlerts,
  logs,
  setLogs,
  isCompact = false,
  onExpand,
  onEditCamera,
  onDeleteCamera,
  onTogglePipeline,
}: LiveMonitorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAIMode, setIsAIMode] = useState(true);
  const [isHeatmap, setIsHeatmap] = useState(false);
  const [isStreamOnline, setIsStreamOnline] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const videoWrapperRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoWrapperRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const panStep = 10;
  const zoomMin = 0.5;
  const zoomMax = 5;

  const handleZoom = (dir: 'in' | 'out') => {
    setZoomLevel(prev => {
      const next = dir === 'in' ? prev + 0.25 : prev - 0.25;
      return Math.max(zoomMin, Math.min(zoomMax, next));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCompact) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isCompact) return;
    e.preventDefault();
    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoomLevel(prev => {
      const next = prev - e.deltaY * 0.005;
      return Math.max(zoomMin, Math.min(zoomMax, next));
    });
  };

  const handlePan = (dx: number, dy: number) => {
    setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const activePipelines = pipelines.filter(p => p.cameraId === camera.id && p.isActive);

  // Poll frame thật + detection thật từ API mỗi 2 giây
  const [liveFrameUrl, setLiveFrameUrl] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<TrackBox[] | null>(null);

  useEffect(() => {
    if (activePipelines.length === 0) {
      setLiveFrameUrl(null);
      setLiveDetections(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      for (const pl of activePipelines) {
        const [url, det] = await Promise.all([
          getLatestFrame(pl.id),
          getLatestDetection(pl.id),
        ]);
        if (url) {
          if (!cancelled) {
            setLiveFrameUrl(url);
            setLiveDetections(det ? det.tracks : []);
          }
          return;
        }
      }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePipelines.map(p => p.id).join(',')]);
  const cameraAlerts = alerts.filter(a => a.cameraName === camera.name);
  const unreadAlertsCount = cameraAlerts.filter(a => a.status === 'new').length;

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      cameraId: camera.id,
      message,
      type
    };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]);
  };

  const handleExportClip = () => {
    const reason = prompt('Nhập lý do xuất clip sự kiện:', 'Phục vụ giải trình báo cáo chất lượng');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do hợp lệ để xuất clip.');
      return;
    }
    alert(`Đã xuất video: VisionOS_Export_${camera.id}_${Date.now()}.mp4`);
    addLog(`Xuất video từ Camera: ${camera.name}. Lý do: "${reason}"`, 'info');
  };

  const renderBackground = () => {
    // Nếu có frame thật từ backend → hiển thị ảnh thay vì mock
    if (liveFrameUrl) {
      return (
        <img
          src={liveFrameUrl}
          alt="Live frame"
          className="absolute inset-0 w-full h-full object-cover select-none"
          draggable={false}
        />
      );
    }
    switch (camera.type) {
      case 'retail':
        return (
          <div
            className="absolute inset-0 overflow-hidden select-none bg-cover bg-center"
            style={{ background: "rgb(248, 250, 252)" }}
          >
            <div className="absolute top-[5%] left-[5%] w-[25%] h-[25%] bg-slate-200/80 border border-slate-300 rounded-md flex flex-col justify-center items-center text-xs text-slate-500 font-medium z-20">
              <span>Kệ Hàng A</span>
              <span className="text-[10px] text-slate-400 font-normal">Thời trang nam</span>
            </div>
            <div className="absolute top-[5%] right-[5%] w-[25%] h-[25%] bg-slate-200/80 border border-slate-300 rounded-md flex flex-col justify-center items-center text-xs text-slate-500 font-medium z-20">
              <span>Kệ Hàng B</span>
              <span className="text-[10px] text-slate-400 font-normal">Đồ mỹ phẩm</span>
            </div>
            <div className="absolute bottom-[5%] left-[30%] right-[30%] w-[40%] h-[20%] bg-slate-100 border border-slate-200 rounded-t-lg flex items-center justify-center text-xs text-slate-500 font-medium z-20">
              Quầy thu ngân
            </div>
          </div>
        );
      case 'warehouse':
        return (
          <div
            className="absolute inset-0 overflow-hidden select-none bg-cover bg-center"
            style={{ background: "rgb(241, 245, 249)" }}
          >
            <div className="absolute top-[8%] left-[5%] w-[25%] h-[20%] bg-amber-50 border border-amber-200 rounded-md p-1 text-[11px] text-amber-700 font-medium flex flex-col justify-center items-center">
              <span>Kệ hàng #01</span>
              <span className="text-[10px] text-emerald-600 font-bold">Hàng lưu kho</span>
            </div>
            <div className="absolute top-[8%] left-[37.5%] w-[25%] h-[20%] bg-amber-50/50 border border-amber-200/50 rounded-md p-1 text-[11px] text-amber-700/50 font-medium flex flex-col justify-center items-center">
              <span>Kệ hàng #02</span>
              <span className="text-[10px] font-normal">Trống</span>
            </div>
            <div className="absolute top-[8%] right-[5%] w-[25%] h-[20%] bg-amber-50 border border-amber-200 rounded-md p-1 text-[11px] text-amber-700 font-medium flex flex-col justify-center items-center">
              <span>Kệ hàng #03</span>
              <span className="text-[10px] text-emerald-600 font-bold">Hàng lưu kho</span>
            </div>
            <div className="absolute bottom-[5%] left-[20%] w-[60%] h-[15%] bg-slate-200/90 border border-slate-300 rounded-t-lg flex items-center justify-center text-xs text-slate-600 font-bold z-20">
              Cổng xuất nhập hàng chính
            </div>
          </div>
        );
      case 'parking':
        return (
          <div
            className="absolute inset-0 overflow-hidden select-none bg-cover bg-center"
            style={{ background: "rgb(241, 245, 249)" }}
          >
            <div className="absolute top-[5%] left-[5%] h-[20%] w-[15%] border border-slate-300 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 z-20 rounded-md">P1</div>
            <div className="absolute top-[40%] left-[5%] h-[20%] w-[15%] border border-emerald-300 bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold z-20 rounded-md">Đã đỗ</div>
            <div className="absolute top-[75%] left-[5%] h-[20%] w-[15%] border border-slate-300 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 z-20 rounded-md">P3</div>
          </div>
        );
      case 'conveyor':
        return (
          <div
            className="absolute inset-0 overflow-hidden flex flex-col justify-center p-4 select-none bg-cover bg-center"
            style={{ background: "rgb(241, 245, 249)" }}
          >
            <div className="h-[30%] w-full bg-slate-300 border-y-4 border-slate-400 shadow-inner relative flex items-center">
              <div className="absolute inset-0 flex justify-around pointer-events-none opacity-20">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-[2px] h-full bg-black"></div>
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'ip': return <Wifi size={14} />;
      case 'onvif': return <Monitor size={14} />;
      case 'usb': return <Usb size={14} />;
      default: return <CameraIcon size={14} />;
    }
  };

  const getDetections = (camId: string, camType: string) => {
    let hash = 0;
    for (let i = 0; i < camId.length; i++) {
      hash = ((hash << 5) - hash) + camId.charCodeAt(i);
    }
    const rng = (max: number) => Math.abs((hash = (hash * 1103515245 + 12345) & 0x7fffffff) % max);

    const objects: { label: string; x: number; y: number; width: number; height: number; color: string; confidence: number }[] = [];

    switch (camType) {
      case 'retail':
        objects.push(
          { label: 'Người', x: 20 + rng(10), y: 30 + rng(10), width: 8, height: 22, color: '#10b981', confidence: 0.92 + rng(7) / 100 },
          { label: 'Người', x: 58 + rng(8), y: 35 + rng(8), width: 7, height: 20, color: '#10b981', confidence: 0.88 + rng(9) / 100 },
          { label: 'Sản phẩm', x: 35 + rng(15), y: 18 + rng(5), width: 5, height: 5, color: '#f59e0b', confidence: 0.73 + rng(12) / 100 },
        );
        if (rng(2) > 0) {
          objects.push({ label: 'Người', x: 5 + rng(8), y: 50 + rng(10), width: 7, height: 20, color: '#10b981', confidence: 0.82 + rng(10) / 100 });
        }
        break;
      case 'warehouse':
        objects.push(
          { label: 'Xe nâng', x: 25 + rng(15), y: 50 + rng(10), width: 14, height: 12, color: '#f59e0b', confidence: 0.96 + rng(3) / 100 },
          { label: 'Công nhân', x: 55 + rng(10), y: 40 + rng(8), width: 6, height: 18, color: '#10b981', confidence: 0.94 + rng(5) / 100 },
        );
        if (rng(3) > 0) {
          objects.push({ label: 'Hộp carton', x: 10 + rng(20), y: 20 + rng(10), width: 8, height: 8, color: '#3b82f6', confidence: 0.85 + rng(10) / 100 });
        }
        break;
      case 'parking':
        objects.push(
          { label: 'Ô tô', x: 40 + rng(15), y: 35 + rng(10), width: 18, height: 10, color: '#f59e0b', confidence: 0.97 + rng(2) / 100 },
          { label: 'Xe máy', x: 15 + rng(8), y: 55 + rng(8), width: 8, height: 6, color: '#10b981', confidence: 0.91 + rng(6) / 100 },
          { label: 'Xe máy', x: 65 + rng(10), y: 50 + rng(10), width: 8, height: 6, color: '#10b981', confidence: 0.87 + rng(8) / 100 },
        );
        break;
      case 'conveyor':
        objects.push(
          { label: 'Hộp carton', x: 30 + rng(10), y: 38 + rng(5), width: 8, height: 8, color: '#10b981', confidence: 0.95 + rng(4) / 100 },
          { label: 'Hộp carton', x: 55 + rng(10), y: 40 + rng(5), width: 8, height: 8, color: '#10b981', confidence: 0.90 + rng(7) / 100 },
          { label: 'Sản phẩm lỗi', x: 70 + rng(8), y: 42 + rng(5), width: 6, height: 6, color: '#ef4444', confidence: 0.78 + rng(12) / 100 },
        );
        break;
    }
    return objects;
  };

  if (!camera) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-slate-400 text-sm">
        Không có camera để hiển thị
      </div>
    );
  }

  return (
    <div className={isCompact ? 'flex flex-col flex-1 w-full min-h-0' : 'grid grid-cols-1 lg:grid-cols-12 gap-6'}>
      <div ref={videoWrapperRef} className={`${isCompact ? 'flex-1 min-h-0' : 'lg:col-span-8'} flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden`}>
        {/* Camera Header */}
        <div className={`bg-slate-900 flex items-center justify-between text-white shrink-0 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold leading-none whitespace-nowrap ${isCompact ? 'text-xs' : 'text-sm'}`}>
                  {camera.name}
                </h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1.5 flex-shrink-0 ${
                  isStreamOnline
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isStreamOnline ? 'bg-emerald-400' : 'bg-slate-400'}`}></div>
                  {isStreamOnline ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              {!isCompact && (
                <p className="text-[11px] text-slate-400 mt-1">{camera.location} • {camera.resolution} • {camera.fps} FPS</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Power Button */}
            <button
              onClick={() => {
                const nextState = !isStreamOnline;
                setIsStreamOnline(nextState);
                addLog(`Camera ${nextState ? 'ONLINE' : 'OFFLINE'}`, nextState ? 'success' : 'error');
              }}
              className={`text-[10px] px-2 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                isStreamOnline
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/25'
                  : 'bg-rose-600/15 text-rose-400 border border-rose-500/20 hover:bg-rose-600/25'
              }`}
              title={isStreamOnline ? 'Tắt Camera' : 'Bật Camera'}
            >
              {isStreamOnline ? 'Bật' : 'Tắt'}
            </button>

            {/* AI & Thermal Segmented Control */}
            <div className="flex items-center bg-slate-800/80 rounded border border-slate-700/50 p-0.5">
              <button
                disabled={!isStreamOnline}
                onClick={() => setIsAIMode(!isAIMode)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${isAIMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                title="Bật/tắt AI"
              >
                <Sparkles size={10} className={isAIMode ? "text-emerald-200" : "text-slate-400"} />
                AI
              </button>
              <button
                disabled={!isStreamOnline}
                onClick={() => setIsHeatmap(!isHeatmap)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isHeatmap ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                title="Bản đồ nhiệt"
              >
                Nhiệt
              </button>
            </div>

            {/* Media Controls */}
            <div className="flex items-center gap-0.5">
              <button
                disabled={!isStreamOnline}
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPlaying ? "Tạm dừng" : "Tiếp tục"}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={isCompact && onExpand ? onExpand : toggleFullscreen}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isCompact ? "Phóng to camera" : (isFullscreen ? "Thu nhỏ" : "Toàn màn hình")}
              >
                {isCompact ? <Maximize2 size={14} /> : (isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />)}
              </button>
            </div>

            {/* More Menu */}
            {(onEditCamera || onDeleteCamera || !isCompact) && (
              <div className="relative ml-0.5">
                {showMenu && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                  />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                >
                  <MoreVertical size={14} />
                </button>
                {showMenu && (
                  <div className="absolute top-full right-0 mt-1 w-44 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-1 z-50">
                    {!isCompact && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleExportClip(); }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                      >
                        Xuất clip
                      </button>
                    )}
                    {onEditCamera && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEditCamera(camera.id); }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                      >
                        <Edit2 size={12} /> Sửa camera
                      </button>
                    )}
                    {onDeleteCamera && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDeleteCamera(camera.id); }}
                        className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-slate-700 hover:text-rose-300 flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Xoá camera
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Camera Feed */}
        <div
          className={`relative w-full ${isCompact ? 'flex-1 min-h-0' : 'aspect-video'} overflow-hidden select-none flex items-center justify-center ${isCompact ? 'cursor-pointer' : isDragging ? 'cursor-grabbing' : 'cursor-grab'} bg-white${isCompact ? '' : ' border-b border-slate-100'}`}
          onClick={isCompact && onExpand ? onExpand : undefined}
          onWheel={isCompact ? undefined : handleWheel}
          onMouseDown={isCompact ? undefined : handleMouseDown}
          onMouseMove={isCompact ? undefined : handleMouseMove}
          onMouseUp={isCompact ? undefined : handleMouseUp}
          onMouseLeave={isCompact ? undefined : handleMouseUp}
        >
          {isCompact && (
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 group-hover:backdrop-brightness-110 transition-all duration-300 z-50 pointer-events-none" />
          )}

          {/* 16:9 Aspect Ratio Wrapper */}
          <div className="relative flex items-center justify-center w-full h-full min-h-0 overflow-hidden">
            <div
              className="relative w-full h-full transition-transform duration-200 ease-out"
              style={{
                aspectRatio: '16/9',
                maxHeight: '100%',
                maxWidth: '100%',
                margin: 'auto',
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
              }}
            >
              {renderBackground()}

            {/* AI Overlay */}
            {isAIMode && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                {/* Counting zone lines/polygons from active pipelines */}
                {activePipelines.flatMap(p => p.countingZones).map(zone => (
                  <div key={zone.id}>
                    {zone.type === 'line' && zone.lineStart && zone.lineEnd && (
                      <>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          <line
                            x1={`${zone.lineStart.x}%`}
                            y1={`${zone.lineStart.y}%`}
                            x2={`${zone.lineEnd.x}%`}
                            y2={`${zone.lineEnd.y}%`}
                            stroke="#f59e0b"
                            strokeWidth="3"
                            strokeDasharray="8 4"
                            opacity="0.8"
                          />
                        </svg>
                        <span
                          className="absolute bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{ left: `${(zone.lineStart.x + zone.lineEnd.x) / 2}%`, top: `${(zone.lineStart.y + zone.lineEnd.y) / 2 - 3}%`, transform: 'translate(-50%, -100%)' }}
                        >
                          {zone.name} | {zone.inCount ?? zone.count} vào · {zone.outCount ?? '-'} ra
                        </span>
                      </>
                    )}
                    {zone.type === 'zone' && zone.points.length >= 3 && (
                      <>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon
                            points={zone.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="rgba(245, 158, 11, 0.08)"
                            stroke="#f59e0b"
                            strokeWidth="0.5"
                            strokeDasharray="2 1"
                          />
                        </svg>
                        <span
                          className="absolute bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{
                            left: `${zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length}%`,
                            top: `${zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {zone.name}: {zone.count}
                        </span>
                      </>
                    )}
                  </div>
                ))}

                {/* Detection bounding boxes — thật từ YOLO/backend */}
                {liveDetections && liveDetections.map((d, i) => {
                  const [x1, y1, x2, y2] = d.bbox_pct;
                  const COLOR: Record<string, string> = {
                    person: '#10b981', car: '#f59e0b', motorcycle: '#8b5cf6',
                    truck: '#ef4444', bus: '#3b82f6', bicycle: '#06b6d4',
                  };
                  const LABEL: Record<string, string> = {
                    person: 'Người', car: 'Ô tô', motorcycle: 'Xe máy',
                    truck: 'Xe tải', bus: 'Xe buýt', bicycle: 'Xe đạp',
                  };
                  const color = COLOR[d.class_name] ?? '#94a3b8';
                  const label = LABEL[d.class_name] ?? d.class_name;
                  return (
                    <div
                      key={`${d.track_id}-${i}`}
                      className="absolute border-2 rounded-sm"
                      style={{
                        left: `${x1}%`, top: `${y1}%`,
                        width: `${x2 - x1}%`, height: `${y2 - y1}%`,
                        borderColor: color,
                        background: `${color}18`,
                      }}
                    >
                      <span
                        className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap"
                        style={{ background: color, color: '#fff' }}
                      >
                        {label} #{d.track_id} {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>

          {!isStreamOnline && (
            <div className="absolute inset-0 bg-slate-950/90 z-30 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <span className="text-4xl animate-pulse">📡</span>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-rose-400 uppercase tracking-wider">Mất kết nối camera</h4>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                  Auto-Reconnect đang hoạt động. Hệ thống thử kết nối lại mỗi 5 giây.
                </p>
              </div>
              <button
                onClick={() => { setIsStreamOnline(true); addLog('Đã khôi phục kết nối camera.', 'success'); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Khôi phục luồng
              </button>
            </div>
          )}

          {isHeatmap && (
            <div className="absolute inset-0 bg-radial-[at_50%_60%] from-orange-500/45 via-yellow-400/25 to-transparent pointer-events-none mix-blend-color-burn">
              <div className="absolute bottom-4 right-1/4 bg-slate-900/95 text-orange-400 text-[10px] font-medium px-2.5 py-1 rounded-md m-2 tracking-wide uppercase flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping"></span>
                Bản đồ nhiệt
              </div>
            </div>
          )}

          {/* Zoom indicator */}
          {!isCompact && zoomLevel !== 1 && (
            <div className="absolute top-3 right-3 bg-slate-900/80 text-white text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5 z-20">
              <ZoomIn size={12} />
              {Math.round(zoomLevel * 100)}%
            </div>
          )}

          {/* Zoom controls */}
          {!isCompact && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 z-20">
              <button
                onClick={() => handleZoom('out')}
                disabled={zoomLevel <= zoomMin}
                className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={resetView}
                className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                title="Đặt lại"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => handleZoom('in')}
                disabled={zoomLevel >= zoomMax}
                className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          )}

          {/* PTZ Controls */}
          {!isCompact && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
              <div className="grid grid-cols-3 gap-0.5 w-24 h-24">
                <div />
                <button
                  onMouseDown={() => handlePan(0, -panStep)}
                  className="bg-slate-900/80 hover:bg-slate-700 text-white rounded-t-lg flex items-center justify-center transition-colors cursor-pointer text-xs"
                  title="Lên"
                >
                  <Move size={14} className="rotate-[-90deg]" />
                </button>
                <div />
                <button
                  onMouseDown={() => handlePan(-panStep, 0)}
                  className="bg-slate-900/80 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer text-xs"
                  title="Trái"
                >
                  <Move size={14} className="rotate-180" />
                </button>
                <button
                  onMouseDown={resetView}
                  className="bg-slate-900/80 hover:bg-slate-700 text-emerald-400 flex items-center justify-center transition-colors cursor-pointer text-[9px] font-bold"
                  title="Reset"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  onMouseDown={() => handlePan(panStep, 0)}
                  className="bg-slate-900/80 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer text-xs"
                  title="Phải"
                >
                  <Move size={14} />
                </button>
                <div />
                <button
                  onMouseDown={() => handlePan(0, panStep)}
                  className="bg-slate-900/80 hover:bg-slate-700 text-white rounded-b-lg flex items-center justify-center transition-colors cursor-pointer text-xs"
                  title="Xuống"
                >
                  <Move size={14} className="rotate-90" />
                </button>
                <div />
              </div>
            </div>
          )}
        </div>

        {isCompact && (
          <div className="bg-white px-3 py-1.5 flex items-center justify-between text-[10px] shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-600">
                <Activity size={12} className={activePipelines.length > 0 ? "text-emerald-500" : "text-slate-400"} />
                {activePipelines.length} Luồng AI
              </span>
              {unreadAlertsCount > 0 ? (
                <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                  <AlertTriangle size={12} />
                  {unreadAlertsCount} Cảnh báo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle size={12} />
                  Bình thường
                </span>
              )}
            </div>
          </div>
        )}

        {!isCompact && (
          <div className="bg-slate-50 border-t border-slate-100">
            <div className="px-5 py-3 border-b border-slate-200/60 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-medium text-slate-600">Chế độ xem</h4>
              </div>
              <div className="flex bg-slate-100 rounded p-0.5">
                <button
                  onClick={() => setIsAIMode(false)}
                  className={`px-3 py-1.5 rounded text-[10px] transition-all ${!isAIMode ? 'bg-white text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Camera Thường
                </button>
                <button
                  onClick={() => setIsAIMode(true)}
                  className={`px-3 py-1.5 rounded text-[10px] transition-all flex items-center gap-1.5 ${isAIMode ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Sparkles size={12} /> AI Phân Tích
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  {getKindIcon(camera.kind)}
                  {camera.kind.toUpperCase()}
                </span>
                <span>•</span>
                <span>Ping: {camera.latency}ms</span>
                <span>•</span>
                <span>FPS: {camera.fps}</span>
                {activePipelines.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">
                      {activePipelines.length} luồng AI đang chạy
                    </span>
                  </>
                )}
              </div>

              {activePipelines.length > 0 && (
                <div className="mt-3 space-y-2">
                  {activePipelines.map(p => (
                    <div key={p.id} className="bg-emerald-50/50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                      <Sparkles size={12} />
                      <span className="font-medium flex-1">{p.name}</span>
                      {onTogglePipeline && (
                        <button
                          onClick={() => onTogglePipeline(p.id)}
                          className={`text-[10px] px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
                            p.isActive
                              ? 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                        >
                          {p.isActive ? 'Bật' : 'Tắt'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Alerts Panel (non-compact) */}
      {!isCompact && (
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl overflow-hidden flex flex-col min-h-0 max-h-[500px] lg:max-h-none">
          <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-sm font-medium">Cảnh báo</span>
            </div>
            <span className="text-[10px] text-slate-400">{cameraAlerts.length} sự kiện</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cameraAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle size={24} className="mx-auto mb-2 text-emerald-400" />
                Không có cảnh báo
              </div>
            ) : (
              cameraAlerts.slice(0, 20).map(alert => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    alert.status === 'new'
                      ? 'bg-rose-50 border-rose-100'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className={`mt-0.5 flex-shrink-0 ${
                      alert.type === 'intrusion' || alert.type === 'safety_hazard' ? 'text-rose-500' : 'text-amber-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-slate-700 leading-relaxed ${alert.status === 'closed' ? 'line-through text-slate-400' : ''}`}>{alert.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString('vi-VN')} • Độ tin cậy: {alert.score}%
                      </p>
                      
                      {alert.assignee && (
                        <div className="mt-2 bg-slate-50/80 rounded p-2 border border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-medium text-slate-600">Người xử lý: {alert.assignee}</span>
                            {alert.handledAt && <span className="text-[9px] text-slate-400">{new Date(alert.handledAt).toLocaleTimeString('vi-VN')}</span>}
                          </div>
                          {alert.note && <p className="text-[10px] text-slate-500 italic">"{alert.note}"</p>}
                        </div>
                      )}

                      {alert.status !== 'closed' && (
                        <div className="flex gap-1.5 mt-2">
                          {alert.status === 'new' && (
                            <button
                              onClick={() => setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'read' } : a))}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              Đã đọc
                            </button>
                          )}
                          <button
                            onClick={() => setAlerts(prev => prev.map(a => a.id === alert.id ? { 
                              ...a, 
                              status: 'closed',
                              assignee: 'Quản trị viên (Admin)',
                              note: 'Đã tiếp nhận và xử lý sự cố.',
                              handledAt: new Date().toISOString()
                            } : a))}
                            className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors cursor-pointer"
                          >
                            Tiếp nhận
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
