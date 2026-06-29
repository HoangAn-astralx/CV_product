import { useState, useEffect } from 'react';
import { Camera, Pipeline, AlertEvent, LogEntry, AlertRule } from './types';
import { INITIAL_CAMERAS, INITIAL_PIPELINES, INITIAL_ALERTS, INITIAL_LOGS, INITIAL_RULES } from './mockData';
import LiveMonitor from './components/LiveMonitor';
import PipelineBuilder from './components/PipelineBuilder';
import Playback from './components/Playback';
import AnalyticsPanel from './components/AnalyticsPanel';
import AdminPanel from './components/AdminPanel';
import { Plus, BarChart3, Settings, ShieldAlert, Shield, Eye, Search, ToggleRight, ToggleLeft, Camera as CameraIcon, AlertTriangle, HelpCircle, Activity, Sparkles, Check, Edit2, Trash2, MoreVertical } from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState<'monitor' | 'builder' | 'playback' | 'analytics' | 'admin'>('monitor');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam-retail');
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('grid');
  const [pipelines, setPipelines] = useState<Pipeline[]>(INITIAL_PIPELINES);
  const [alerts, setAlerts] = useState<AlertEvent[]>(INITIAL_ALERTS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [rules, setRules] = useState<AlertRule[]>(INITIAL_RULES);
  const [gridLayout, setGridLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4'>('2x2');
  const [gridSlots, setGridSlots] = useState<Record<number, string | null>>({});
  const [isCameraListOpen, setIsCameraListOpen] = useState(false);
  const [role, setRole] = useState<'admin' | 'operator' | 'viewer'>('operator');
  const [selectedSite, setSelectedSite] = useState<'Tất cả' | 'Hà Nội' | 'TP.HCM' | 'Bình Dương'>('Tất cả');

  const [cameras, setCameras] = useState<Camera[]>(() => {
    const saved = localStorage.getItem('visionos_cameras');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_CAMERAS;
  });

  useEffect(() => {
    localStorage.setItem('visionos_cameras', JSON.stringify(cameras));
  }, [cameras]);

  useEffect(() => {
    if (Object.keys(gridSlots).length === 0 && cameras.length > 0) {
      const initialSlots: Record<number, string | null> = {};
      cameras.slice(0, 4).forEach((cam, idx) => {
        initialSlots[idx] = cam.id;
      });
      setGridSlots(initialSlots);
    }
  }, [cameras, gridSlots]);

  const getGridClass = () => {
    switch (gridLayout) {
      case '1x1': return 'grid-cols-1';
      case '2x2': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2';
      case '3x3': return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-3';
      case '4x4': return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-4';
      default: return 'grid-cols-2';
    }
  };

  const getSlotCount = () => {
    switch (gridLayout) {
      case '1x1': return 1;
      case '2x2': return 4;
      case '3x3': return 9;
      case '4x4': return 16;
      default: return 4;
    }
  };

  const [showAddCamera, setShowAddCamera] = useState(false);
  const [openCameraMenuId, setOpenCameraMenuId] = useState<string | null>(null);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [newCamera, setNewCamera] = useState<Partial<Camera>>({ type: 'retail', site: 'Hà Nội', name: '', location: '' });

  const filteredCameras = selectedSite === 'Tất cả' ? cameras : cameras.filter(c => c.site === selectedSite);
  const activeCamera = filteredCameras.find(c => c.id === selectedCameraId) || filteredCameras[0] || cameras[0];

  const handleSaveCamera = () => {
    if (role === 'viewer') {
      alert('🔒 Bạn không có quyền thêm/sửa camera.');
      return;
    }
    if (!newCamera.name || !newCamera.location) {
      alert('Vui lòng nhập đầy đủ tên và vị trí camera.');
      return;
    }

    if (editingCameraId) {
      setCameras(prev => prev.map(c => {
        if (c.id === editingCameraId) {
          return {
            ...c,
            name: newCamera.name!,
            location: newCamera.location!,
            type: newCamera.type as any,
            site: newCamera.site as any
          };
        }
        return c;
      }));
    } else {
      const camera: Camera = {
        id: `cam-${Date.now()}`,
        name: newCamera.name,
        location: newCamera.location,
        type: newCamera.type as 'retail' | 'warehouse' | 'parking' | 'conveyor',
        site: newCamera.site as 'Hà Nội' | 'TP.HCM' | 'Bình Dương',
        status: 'online',
        fps: 30,
        resolution: '1920x1080',
        latency: 100,
      };
      setCameras(prev => [...prev, camera]);
      setSelectedCameraId(camera.id);
    }

    setShowAddCamera(false);
    setEditingCameraId(null);
    setNewCamera({ type: 'retail', site: 'Hà Nội', name: '', location: '' });
  };

  const handleDeleteCamera = (id: string) => {
    if (role === 'viewer') {
      alert('🔒 Bạn không có quyền xoá camera.');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xoá camera này? Các luồng AI gắn với camera này cũng sẽ bị ảnh hưởng.')) {
      setCameras(prev => prev.filter(c => c.id !== id));
      if (selectedCameraId === id) {
        const remaining = cameras.filter(c => c.id !== id);
        if (remaining.length > 0) {
          setSelectedCameraId(remaining[0].id);
        }
      }
    }
  };

  const togglePipeline = (pipelineId: string) => {
    if (role === 'viewer') {
      alert('🔒 Bạn không có quyền bật/tắt luồng AI với vai trò Viewer.');
      return;
    }
    setPipelines(prev =>
      prev.map(p => {
        if (p.id === pipelineId) {
          const nextState = !p.isActive;
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          const logMsg: LogEntry = {
            id: `log-sys-${Date.now()}`,
            timestamp: timeStr,
            cameraId: p.cameraId,
            message: `Hệ thống: Luồng AI "${p.name}" đã được ${nextState ? 'BẬT' : 'TẮT'} bởi quản trị viên.`,
            type: nextState ? 'success' : 'warning'
          };
          setLogs(l => [logMsg, ...l]);
          return { ...p, isActive: nextState };
        }
        return p;
      })
    );
  };

  const deletePipeline = (id: string) => {
    if (role === 'viewer') {
      alert('🔒 Bạn không có quyền xóa luồng AI với vai trò Viewer.');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa Luồng AI này?')) {
      setPipelines(prev => prev.filter(p => p.id !== id));
    }
  };

  const markAllAlertsAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, status: 'read' })));
  };

  const unreadAlertsCount = alerts.filter(a => a.status === 'unread').length;

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans antialiased">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-600/20">
            <Eye size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-3xl tracking-tight text-slate-900 leading-none">VisionOS</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1">Nền tảng Giám sát &amp; Đếm thông minh AI</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center bg-slate-100 rounded-2xl p-2 gap-2">
          <button
            onClick={() => setActiveSection('monitor')}
            className={`flex items-center gap-2.5 text-base font-bold px-6 py-3 rounded-xl transition-all cursor-pointer ${activeSection === 'monitor' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
          >
            <Eye size={20} />
            Giám sát trực tiếp
          </button>
          <button
            onClick={() => setActiveSection('builder')}
            className={`flex items-center gap-2.5 text-base font-bold px-6 py-3 rounded-xl transition-all cursor-pointer ${activeSection === 'builder' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
          >
            <CameraIcon size={20} />
            Cấu hình Camera
          </button>
          <button
            onClick={() => setActiveSection('playback')}
            className={`flex items-center gap-2.5 text-base font-bold px-6 py-3 rounded-xl transition-all cursor-pointer ${activeSection === 'playback' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
          >
            <Search size={20} />
            Xem lại camera
          </button>
          <button
            onClick={() => setActiveSection('analytics')}
            className={`flex items-center gap-2.5 text-base font-bold px-6 py-3 rounded-xl transition-all cursor-pointer ${activeSection === 'analytics' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
          >
            <BarChart3 size={20} />
            Báo cáo &amp; Biểu đồ
          </button>
          <button
            onClick={() => setActiveSection('admin')}
            className={`flex items-center gap-2.5 text-base font-bold px-6 py-3 rounded-xl transition-all cursor-pointer ${activeSection === 'admin' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
          >
            <Settings size={20} />
            Quản trị hệ thống
          </button>
        </nav>

        <div className="flex items-center gap-5">
          {unreadAlertsCount > 0 && (
            <button
              onClick={() => {
                setActiveSection('monitor');
                markAllAlertsAsRead();
              }}
              className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-2xl px-5 py-2.5 text-base font-bold flex items-center gap-2 animate-pulse cursor-pointer transition-colors"
            >
              <AlertTriangle size={20} />
              {unreadAlertsCount} Cảnh báo
            </button>
          )}

          <div className="h-12 w-px bg-slate-200" />

          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              {role === 'admin' ? <Shield size={24} /> : role === 'operator' ? <Settings size={24} /> : <Eye size={24} />}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-base font-bold text-slate-800 leading-none">{role === 'admin' ? 'Admin' : role === 'operator' ? 'Operator' : 'User'}</p>
              <p className="text-sm text-slate-500 mt-1.5 capitalize">{role} Account</p>
            </div>
          </div>
        </div>
      </header>

      <div className="md:hidden bg-white border-b border-slate-100 p-2 flex justify-around">
        <button
          onClick={() => setActiveSection('monitor')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold ${activeSection === 'monitor' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Eye size={16} />
          <span>Giám sát</span>
        </button>
        <button
          onClick={() => setActiveSection('builder')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold ${activeSection === 'builder' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <CameraIcon size={16} />
          <span>Cấu hình</span>
        </button>
        <button
          onClick={() => setActiveSection('playback')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold ${activeSection === 'playback' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Search size={16} />
          <span>Xem lại</span>
        </button>
        <button
          onClick={() => setActiveSection('analytics')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold ${activeSection === 'analytics' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <BarChart3 size={16} />
          <span>Báo cáo</span>
        </button>
      </div>

      <section className="bg-indigo-900 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-indigo-300 animate-pulse" />
          <span className="text-sm font-medium text-indigo-100">
            Trạng thái hệ thống: <strong className="text-white font-bold">Hoạt động bình thường</strong> • Đã kết nối 4 camera IP
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span>Tổng luồng AI: <strong className="text-indigo-300 font-bold">{pipelines.length}</strong></span>
          <span>•</span>
          <span>Đang chạy: <strong className="text-indigo-300 font-bold">{pipelines.filter(p => p.isActive).length}</strong></span>
        </div>
      </section>

      <main className="w-full px-4 lg:px-8 py-6 space-y-6">
        
        <section className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded uppercase tracking-wider">Mô phỏng Phân quyền (RBAC) &amp; Multi-site</span>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">● Demo hoạt động</span>
            </div>
            <h3 className="font-extrabold text-base text-slate-800 mt-2">Thử nghiệm Giao diện theo vai trò người dùng</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Hãy chuyển đổi giữa <strong>Admin</strong>, <strong>Operator</strong> và <strong>Viewer</strong> để quan sát sự thay đổi quyền hạn giao diện và giới hạn địa lý thực tế.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="space-y-1.5 flex-1 sm:flex-initial">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Phạm vi Địa điểm (Site):</label>
              <select
                value={selectedSite}
                onChange={(e) => {
                  const siteVal = e.target.value as any;
                  setSelectedSite(siteVal);
                  const filtered = siteVal === 'Tất cả' ? INITIAL_CAMERAS : INITIAL_CAMERAS.filter(c => c.site === siteVal);
                  if (filtered.length > 0 && !filtered.some(c => c.id === selectedCameraId)) {
                    setSelectedCameraId(filtered[0].id);
                  }
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="Tất cả">Tất cả địa điểm</option>
                <option value="Hà Nội">Chi nhánh Hà Nội</option>
                <option value="TP.HCM">Chi nhánh TP.HCM</option>
                <option value="Bình Dương">Kho Bình Dương</option>
              </select>
            </div>

            <div className="space-y-1.5 flex-1 sm:flex-initial">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Vai trò người dùng (Role):</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'admin', label: 'Admin', icon: <Shield size={14} /> },
                  { id: 'operator', label: 'Operator', icon: <Settings size={14} /> },
                  { id: 'viewer', label: 'Viewer', icon: <Eye size={14} /> }
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRole(r.id as any);
                      const now = new Date();
                      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                      const logMsg: LogEntry = {
                        id: `log-role-${Date.now()}`,
                        timestamp: timeStr,
                        cameraId: activeCamera.id,
                        message: `Hệ thống: Tài khoản đã chuyển sang quyền [${r.label.toUpperCase()}]. Giao diện thích ứng ngay lập tức.`,
                        type: 'info'
                      };
                      setLogs(l => [logMsg, ...l]);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${role === r.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {activeSection === 'monitor' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">
                  {viewMode === 'single' ? `Chọn camera giám sát (${filteredCameras.length} trong site này)` : `Lưới giám sát tổng hợp (${filteredCameras.length} camera)`}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddCamera(true)}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200 cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={16} /> Thêm Camera Mới
                  </button>
                  <div className="flex bg-slate-100 rounded-lg p-1.5">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Xem nhiều cam (Lưới)
                    </button>
                    <button
                      onClick={() => setViewMode('single')}
                      className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors cursor-pointer ${viewMode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Xem chi tiết (Đơn)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {viewMode === 'single' ? (
              <LiveMonitor
                camera={activeCamera}
                pipelines={pipelines}
                alerts={alerts}
                setAlerts={setAlerts}
                logs={logs}
                setLogs={setLogs}
                role={role}
                onEditCamera={(id) => {
                  setEditingCameraId(id);
                  const cam = cameras.find(c => c.id === id);
                  if (cam) {
                    setNewCamera({ name: cam.name, location: cam.location, type: cam.type, site: cam.site });
                  }
                  setShowAddCamera(true);
                }}
                onDeleteCamera={handleDeleteCamera}
              />
            ) : (
              <div className="flex flex-col lg:flex-row gap-4 items-start">
                <div className="w-full lg:w-64 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-shrink-0 transition-all">
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center justify-between">
                      <h3 
                        onClick={() => setIsCameraListOpen(!isCameraListOpen)}
                        className="font-bold text-sm text-slate-800 cursor-pointer flex items-center justify-between w-full hover:text-indigo-600 transition-colors"
                      >
                        Danh sách Camera
                        <span className="text-slate-400">{isCameraListOpen ? '▼' : '▶'}</span>
                      </h3>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1 self-start">
                      {['1x1', '2x2', '3x3', '4x4'].map((layout) => (
                        <button
                          key={layout}
                          onClick={() => setGridLayout(layout as any)}
                          className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors cursor-pointer ${gridLayout === layout ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {layout}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {isCameraListOpen && (
                    <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                      <p className="text-xs text-slate-400 mb-3 font-medium">Kéo thả camera vào ô trống bên phải để xem</p>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {filteredCameras.map((cam) => (
                          <div
                            key={cam.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('cameraId', cam.id);
                            }}
                            className="bg-slate-50 border border-slate-200 p-3 rounded-xl cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors flex items-center gap-3"
                          >
                            <div className={`w-2.5 h-2.5 rounded-full ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div>
                              <p className="text-sm font-bold text-slate-800 leading-tight">{cam.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{cam.location}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex-1 w-full grid ${getGridClass()} gap-4`}>
                  {Array.from({ length: getSlotCount() }).map((_, slotIndex) => {
                    const cameraId = gridSlots[slotIndex];
                    const cam = cameraId ? cameras.find(c => c.id === cameraId) : null;

                    return (
                      <div
                        key={slotIndex}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedCamId = e.dataTransfer.getData('cameraId');
                          if (draggedCamId) {
                            setGridSlots(prev => ({ ...prev, [slotIndex]: draggedCamId }));
                          }
                        }}
                        className={`bg-slate-100/50 rounded-2xl border-2 border-dashed ${cam ? 'border-transparent bg-transparent' : 'border-slate-300 flex items-center justify-center min-h-[250px]'}`}
                      >
                        {cam ? (
                          <div className="relative h-full w-full group">
                            <button
                              onClick={() => setGridSlots(prev => ({ ...prev, [slotIndex]: null }))}
                              className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-rose-500/80 hover:bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Gỡ camera khỏi ô này"
                            >
                              <Plus size={14} className="rotate-45" />
                            </button>
                            <LiveMonitor
                              camera={cam}
                              pipelines={pipelines}
                              alerts={alerts}
                              setAlerts={setAlerts}
                              logs={logs}
                              setLogs={setLogs}
                              role={role}
                              isCompact={true}
                              onExpand={() => {
                                setSelectedCameraId(cam.id);
                                setViewMode('single');
                              }}
                              onEditCamera={(id) => {
                                setEditingCameraId(id);
                                const c = cameras.find(c => c.id === id);
                                if (c) {
                                  setNewCamera({ name: c.name, location: c.location, type: c.type, site: c.site });
                                }
                                setShowAddCamera(true);
                              }}
                              onDeleteCamera={handleDeleteCamera}
                            />
                          </div>
                        ) : (
                          <div className="text-slate-400 text-center pointer-events-none">
                            <Plus size={24} className="mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-medium">Kéo thả camera vào đây</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'single' && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Danh sách Luồng AI trên camera này</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Bật hoặc tắt mô hình AI chỉ với 1 click gạt nút</p>
                </div>
                <button
                  onClick={() => setActiveSection('builder')}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <Plus size={13} /> Thiết lập luồng AI mới
                </button>
              </div>

              <div className="space-y-3">
                {pipelines.filter(p => p.cameraId === selectedCameraId).map((pipe) => (
                  <div key={pipe.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm ${pipe.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                        ⚙️
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-xs text-slate-800">{pipe.name}</h4>
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">
                            {pipe.detectorName}
                          </span>
                          {pipe.searchQuery && (
                            <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-100/50 px-1.5 py-0.5 rounded font-medium">
                              Mô tả: "{pipe.searchQuery}"
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Vùng: {pipe.countingZones.map(z => `${z.name} (${z.type === 'line' ? 'Vạch kẻ' : 'Khu vực'})`).join(', ')} • Tạo ngày {new Date(pipe.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-50">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${pipe.isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {pipe.isActive ? 'ĐANG CHẠY' : 'ĐÃ TẮT'}
                        </span>
                        <button
                          onClick={() => togglePipeline(pipe.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          title={pipe.isActive ? "Tạm tắt luồng" : "Bật luồng"}
                        >
                          {pipe.isActive ? (
                            <ToggleRight size={28} className="text-indigo-600" />
                          ) : (
                            <ToggleLeft size={28} className="text-slate-300" />
                          )}
                        </button>
                      </div>

                      <div className="h-4 w-px bg-slate-200 hidden md:block" />

                      <button
                        onClick={() => deletePipeline(pipe.id)}
                        className="text-[10px] text-slate-400 hover:text-rose-600 font-bold px-2.5 py-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        Xóa luồng
                      </button>
                    </div>
                  </div>
                ))}

                {pipelines.filter(p => p.cameraId === selectedCameraId).length === 0 && (
                  <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                    <p className="text-xs">Chưa có luồng giám sát thông minh AI nào cho camera này.</p>
                    <p className="text-[10px] mt-0.5">Click vào nút "Thiết lập luồng AI mới" để tạo tức thì!</p>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {activeSection === 'builder' && (
          role === 'viewer' ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center space-y-4 max-w-lg mx-auto shadow-sm">
              <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-2xl">
                🔒
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Tính năng này bị Khóa</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Giao diện hiện tại đang chạy ở quyền <strong>Viewer (Người chỉ xem)</strong>. Quyền này chỉ cho phép bạn giám sát trực tiếp camera &amp; số đếm thời gian thực.
              </p>
              <p className="text-[11px] text-indigo-600 font-bold bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/30">
                Hãy chuyển vai trò người dùng thành <strong>Operator (Vận hành)</strong> hoặc <strong>Admin</strong> ở đầu trang để tự tay cấu hình luồng AI mới!
              </p>
            </div>
          ) : (
            <PipelineBuilder
              cameras={cameras}
              pipelines={pipelines}
              setPipelines={setPipelines}
              setRules={setRules}
              role={role}
              onComplete={() => {
                setActiveSection('monitor');
                const alertMsg = document.createElement('div');
                alertMsg.className = "fixed bottom-5 right-5 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-bounce";
                alertMsg.innerHTML = `✓ Kích hoạt luồng AI mới thành công!`;
                document.body.appendChild(alertMsg);
                setTimeout(() => alertMsg.remove(), 3000);
              }}
            />
          )
        )}

        {activeSection === 'playback' && (
          <Playback role={role} cameras={filteredCameras} alerts={alerts} />
        )}

        {activeSection === 'analytics' && (
          <AnalyticsPanel alerts={alerts} pipelines={pipelines} />
        )}

        {activeSection === 'admin' && (
          <AdminPanel
            cameras={cameras}
            onEditCamera={(id) => {
              setEditingCameraId(id);
              const cam = cameras.find(c => c.id === id);
              if (cam) {
                setNewCamera({ name: cam.name, location: cam.location, type: cam.type, site: cam.site });
              }
              setShowAddCamera(true);
            }}
            onDeleteCamera={handleDeleteCamera}
          />
        )}

      </main>

      {/* Add Camera Modal */}
      {showAddCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-4 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CameraIcon size={18} className="text-indigo-400" />
                {editingCameraId ? 'Cập nhật Camera' : 'Thêm Camera Mới'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Camera</label>
                <input 
                  type="text" 
                  value={newCamera.name}
                  onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                  placeholder="VD: Camera Kho A"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vị trí lắp đặt</label>
                <input 
                  type="text" 
                  value={newCamera.location}
                  onChange={e => setNewCamera({...newCamera, location: e.target.value})}
                  placeholder="VD: Khu vực Lối ra vào"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại</label>
                  <select 
                    value={newCamera.type}
                    onChange={e => setNewCamera({...newCamera, type: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="retail">Cửa hàng Bán lẻ</option>
                    <option value="warehouse">Kho hàng</option>
                    <option value="parking">Bãi đỗ xe</option>
                    <option value="conveyor">Băng chuyền</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Site</label>
                  <select 
                    value={newCamera.site}
                    onChange={e => setNewCamera({...newCamera, site: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="TP.HCM">TP.HCM</option>
                    <option value="Bình Dương">Bình Dương</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-2">
              <button 
                onClick={() => {
                  setShowAddCamera(false);
                  setEditingCameraId(null);
                  setNewCamera({ type: 'retail', site: 'Hà Nội', name: '', location: '' });
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-200/50 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSaveCamera}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Check size={16} /> {editingCameraId ? 'Lưu thay đổi' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
