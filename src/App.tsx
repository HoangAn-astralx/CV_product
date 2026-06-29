import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Camera, Pipeline, AlertEvent, LogEntry, AlertRule } from './types';
import { INITIAL_CAMERAS, INITIAL_PIPELINES, INITIAL_ALERTS, INITIAL_LOGS, INITIAL_RULES } from './mockData';
import LiveMonitor from './components/LiveMonitor';
import PipelineBuilder from './components/PipelineBuilder';
import Playback from './components/Playback';
import AnalyticsPanel from './components/AnalyticsPanel';
import AdminPanel from './components/AdminPanel';
import { Plus, BarChart3, Settings, Camera as CameraIcon, AlertTriangle, Search, Eye, ChevronDown, ChevronLeft, ChevronRight, LogOut, LayoutGrid } from 'lucide-react';

type Page = 'monitor' | 'builder' | 'playback' | 'analytics' | 'admin';
type GridLayout = '1x1' | '2x2' | '3x3' | '4x4' | '1+2' | '2+1';

const layoutConfigs: Record<GridLayout, { label: string; cols: number; rows: number; cells: number; templateColumns: string; templateRows: string }> = {
  '1x1': { label: '1x1', cols: 1, rows: 1, cells: 1, templateColumns: '1fr', templateRows: '1fr' },
  '2x2': { label: '2x2', cols: 2, rows: 2, cells: 4, templateColumns: '1fr 1fr', templateRows: '1fr 1fr' },
  '3x3': { label: '3x3', cols: 3, rows: 3, cells: 9, templateColumns: 'repeat(3, 1fr)', templateRows: 'repeat(3, 1fr)' },
  '4x4': { label: '4x4', cols: 4, rows: 4, cells: 16, templateColumns: 'repeat(4, 1fr)', templateRows: 'repeat(4, 1fr)' },
  '1+2': { label: '1+2', cols: 2, rows: 2, cells: 3, templateColumns: '2fr 1fr', templateRows: '1fr 1fr' },
  '2+1': { label: '2+1', cols: 2, rows: 2, cells: 3, templateColumns: '1fr 2fr', templateRows: '1fr 1fr' },
};

const layoutCells: Record<GridLayout, { gridColumn: string; gridRow: string }[]> = {
  '1x1': [{ gridColumn: '1', gridRow: '1' }],
  '2x2': [
    { gridColumn: '1', gridRow: '1' }, { gridColumn: '2', gridRow: '1' },
    { gridColumn: '1', gridRow: '2' }, { gridColumn: '2', gridRow: '2' },
  ],
  '3x3': [
    { gridColumn: '1', gridRow: '1' }, { gridColumn: '2', gridRow: '1' }, { gridColumn: '3', gridRow: '1' },
    { gridColumn: '1', gridRow: '2' }, { gridColumn: '2', gridRow: '2' }, { gridColumn: '3', gridRow: '2' },
    { gridColumn: '1', gridRow: '3' }, { gridColumn: '2', gridRow: '3' }, { gridColumn: '3', gridRow: '3' },
  ],
  '4x4': [
    { gridColumn: '1', gridRow: '1' }, { gridColumn: '2', gridRow: '1' }, { gridColumn: '3', gridRow: '1' }, { gridColumn: '4', gridRow: '1' },
    { gridColumn: '1', gridRow: '2' }, { gridColumn: '2', gridRow: '2' }, { gridColumn: '3', gridRow: '2' }, { gridColumn: '4', gridRow: '2' },
    { gridColumn: '1', gridRow: '3' }, { gridColumn: '2', gridRow: '3' }, { gridColumn: '3', gridRow: '3' }, { gridColumn: '4', gridRow: '3' },
    { gridColumn: '1', gridRow: '4' }, { gridColumn: '2', gridRow: '4' }, { gridColumn: '3', gridRow: '4' }, { gridColumn: '4', gridRow: '4' },
  ],
  '1+2': [
    { gridColumn: '1 / 2', gridRow: '1 / 3' },
    { gridColumn: '2 / 3', gridRow: '1 / 2' },
    { gridColumn: '2 / 3', gridRow: '2 / 3' },
  ],
  '2+1': [
    { gridColumn: '1 / 2', gridRow: '1 / 2' },
    { gridColumn: '1 / 2', gridRow: '2 / 3' },
    { gridColumn: '2 / 3', gridRow: '1 / 3' },
  ],
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [activeSection, setActiveSection] = useState<Page>('monitor');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam-retail');
  const [gridLayout, setGridLayout] = useState<GridLayout>('4x4');
  const [previousGridLayout, setPreviousGridLayout] = useState<GridLayout>('4x4');
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>(INITIAL_PIPELINES);
  const [alerts, setAlerts] = useState<AlertEvent[]>(INITIAL_ALERTS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [rules, setRules] = useState<AlertRule[]>(INITIAL_RULES);
  const [selectedSite, setSelectedSite] = useState<'Tất cả' | 'Hà Nội' | 'TP.HCM' | 'Bình Dương'>('Tất cả');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [camListOpen, setCamListOpen] = useState(false);

  const [cameras, setCameras] = useState<Camera[]>(() => {
    const saved = localStorage.getItem('visionos_cameras_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 10) return parsed;
      } catch (e) {}
    }
    localStorage.removeItem('visionos_cameras');
    return INITIAL_CAMERAS;
  });

  useEffect(() => {
    localStorage.setItem('visionos_cameras_v2', JSON.stringify(cameras));
  }, [cameras]);

  useEffect(() => {
    if (cameras.length > 0 && !cameras.some(c => c.id === selectedCameraId)) {
      setSelectedCameraId(cameras[0].id);
    }
  }, [cameras, selectedCameraId]);

  const [showAddCamera, setShowAddCamera] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [newCamera, setNewCamera] = useState<Partial<Camera>>({
    type: 'retail', kind: 'ip', site: 'Hà Nội', name: '', location: '',
    username: 'admin', password: 'admin123'
  });

  const [gridCameras, setGridCameras] = useState<Camera[]>([]);
  const [draggedCamId, setDraggedCamId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const filteredCameras = selectedSite === 'Tất cả' ? cameras : cameras.filter(c => c.site === selectedSite);
  const activeCamera = filteredCameras.find(c => c.id === selectedCameraId) || filteredCameras[0] || cameras[0];
  const unreadAlertsCount = alerts.filter(a => a.status === 'new').length;

  useEffect(() => {
    const cells = layoutConfigs[gridLayout].cells;
    if (gridLayout !== '1x1' && gridCameras.length === 0 && filteredCameras.length > 0) {
      setGridCameras(filteredCameras.slice(0, cells));
    }
  }, [gridLayout, filteredCameras]);

  const handleLogin = () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      alert('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleSaveCamera = () => {
    if (!newCamera.name || !newCamera.location || !newCamera.username || !newCamera.password) {
      alert('Vui lòng nhập đầy đủ thông tin camera.');
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
            kind: newCamera.kind as any,
            site: newCamera.site as any,
            username: newCamera.username!,
            password: newCamera.password!,
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
        kind: newCamera.kind as 'ip' | 'onvif' | 'usb',
        site: newCamera.site as 'Hà Nội' | 'TP.HCM' | 'Bình Dương',
        status: 'online',
        fps: 30,
        resolution: '1920x1080',
        latency: 100,
        username: newCamera.username || 'admin',
        password: newCamera.password || 'admin123',
      };
      setCameras(prev => [...prev, camera]);
      setSelectedCameraId(camera.id);
    }

    setShowAddCamera(false);
    setEditingCameraId(null);
    setNewCamera({ type: 'retail', kind: 'ip', site: 'Hà Nội', name: '', location: '', username: 'admin', password: 'admin123' });
  };

  const handleDeleteCamera = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xoá camera này?')) {
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
            message: `Hệ thống: Luồng AI "${p.name}" đã được ${nextState ? 'BẬT' : 'TẮT'}.`,
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
    if (confirm('Bạn có chắc chắn muốn xóa Luồng AI này?')) {
      setPipelines(prev => prev.filter(p => p.id !== id));
    }
  };

  const markAllAlertsAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, status: 'read' })));
  };

  const camerasBySite = useMemo(() => {
    const grouped: Record<string, Camera[]> = {};
    cameras.forEach(c => {
      if (!grouped[c.site]) grouped[c.site] = [];
      grouped[c.site].push(c);
    });
    return grouped;
  }, [cameras]);

  const handleDragStart = (camId: string) => {
    setDraggedCamId(camId);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (!draggedCamId) return;
    const fromIdx = gridCameras.findIndex(c => c.id === draggedCamId);
    const draggedCam = cameras.find(c => c.id === draggedCamId);
    if (!draggedCam) return;
    const newOrder = [...gridCameras];
    if (fromIdx !== -1) {
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(idx, 0, moved);
    } else {
      newOrder.splice(idx, 0, draggedCam);
    }
    setGridCameras(newOrder);
    setDraggedCamId(null);
    setDragOverIdx(null);
  };

  const openCameraDetail = (cameraId: string) => {
    if (gridLayout !== '1x1') {
      setPreviousGridLayout(gridLayout);
    }
    setSelectedCameraId(cameraId);
    setActiveSection('monitor');
    setGridLayout('1x1');
  };

  const backToCameraGrid = () => {
    const layout = previousGridLayout === '1x1' ? '4x4' : previousGridLayout;
    setGridLayout(layout);
    if (gridCameras.length === 0) {
      setGridCameras(filteredCameras.slice(0, layoutConfigs[layout].cells));
    }
  };

  const allLayouts: { id: GridLayout }[] = [
    { id: '1x1' }, { id: '2x2' }, { id: '3x3' }, { id: '4x4' },
    { id: '1+2' }, { id: '2+1' },
  ];

  const navItems: { id: Page; label: string; icon: any }[] = [
    { id: 'monitor', label: 'Giám sát', icon: <Eye size={18} /> },
    { id: 'builder', label: 'Cấu hình', icon: <CameraIcon size={18} /> },
    { id: 'playback', label: 'Xem lại', icon: <Search size={18} /> },
    { id: 'analytics', label: 'Báo cáo', icon: <BarChart3 size={18} /> },
    { id: 'admin', label: 'Quản trị', icon: <Settings size={18} /> },
  ];

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border border-neutral-200">
          <div className="bg-neutral-900 p-6 text-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mx-auto mb-3">
              <Eye size={28} />
            </div>
            <h1 className="text-xl font-bold text-white">VisionOS</h1>
            <p className="text-sm text-neutral-400 mt-1">Nền tảng Giám sát & Đếm thông minh AI</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Tên đăng nhập</label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Mật khẩu</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors cursor-pointer text-sm"
            >
              Đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800 font-sans antialiased flex">
      {/* Sidebar */}
      <aside className={`bg-neutral-950 text-white flex flex-col border-r border-neutral-900 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-neutral-900 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0">
            <Eye size={16} />
          </div>
          <h1 className="font-bold text-sm flex-1">VisionOS</h1>
          <button
            onClick={handleLogout}
            className="text-neutral-600 hover:text-white p-1.5 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </div>

        {(activeSection === 'monitor' || activeSection === 'playback') && (
        /* Camera Tree */
        <div className="flex-1 overflow-y-auto border-t border-neutral-900 mt-2">
          <div className="p-3">
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2 px-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCamListOpen(!camListOpen)}
                  className="p-0.5 rounded-sm text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <ChevronDown size={11} className={camListOpen ? '' : '-rotate-90'} />
                </button>
                <span>Camera ({filteredCameras.length})</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSection('monitor');
                  const count = filteredCameras.length;
                  let layout: GridLayout = '4x4';
                  if (count <= 1) layout = '1x1';
                  else if (count <= 4) layout = '2x2';
                  else if (count <= 9) layout = '3x3';
                  setGridLayout(layout);
                  setGridCameras(filteredCameras.slice(0, layoutConfigs[layout].cells));
                }}
                className="p-0.5 rounded-sm text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Xem tất cả trên lưới"
              >
                <Eye size={11} />
              </button>
            </div>
            {camListOpen && (
            <div className="space-y-0.5">
              {filteredCameras.map(cam => (
                <button
                  key={cam.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', cam.id); handleDragStart(cam.id); }}
                  onClick={() => openCameraDetail(cam.id)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                    selectedCameraId === cam.id && activeSection === 'monitor' && gridLayout === '1x1'
                      ? 'text-emerald-400'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="truncate">{cam.name}</span>
                </button>
              ))}
            </div>
            )}
          </div>
        </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-neutral-100 px-4 lg:px-6 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer justify-self-start"
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>

          <nav className="flex items-center justify-center gap-1 min-w-0 overflow-x-auto">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeSection === item.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === 'monitor' && unreadAlertsCount > 0 && (
                  <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 justify-self-end">
            <select
              value={selectedSite}
              onChange={(e) => {
                const siteVal = e.target.value as any;
                setSelectedSite(siteVal);
                const filtered = siteVal === 'Tất cả' ? cameras : cameras.filter(c => c.site === siteVal);
                if (filtered.length > 0 && !filtered.some(c => c.id === selectedCameraId)) {
                  setSelectedCameraId(filtered[0].id);
                }
              }}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-700 focus:outline-hidden cursor-pointer"
            >
              <option value="Tất cả">Tất cả địa điểm</option>
              <option value="Hà Nội">Hà Nội</option>
              <option value="TP.HCM">TP.HCM</option>
              <option value="Bình Dương">Bình Dương</option>
            </select>
          </div>
        </header>



        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {activeSection === 'monitor' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setShowGridMenu(!showGridMenu)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <LayoutGrid size={12} />
                      {layoutConfigs[gridLayout].label}
                    </button>
                    {showGridMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowGridMenu(false)} />
                        <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg p-3 z-50 min-w-[220px]">
                          <div className="text-xs font-medium text-neutral-500 mb-2 px-1">Chọn bố cục lưới</div>
                          <div className="grid grid-cols-3 gap-2">
                            {allLayouts.map(layout => (
                              <button
                                key={layout.id}
                                onClick={() => {
                                  setGridLayout(layout.id);
                                  setShowGridMenu(false);
                                  if (layout.id !== '1x1') {
                                    const cells = layoutConfigs[layout.id].cells;
                                    setGridCameras(filteredCameras.slice(0, cells));
                                  }
                                }}
                                className={`p-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer flex flex-col items-center gap-1.5 ${
                                  gridLayout === layout.id
                                    ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700'
                                    : 'bg-neutral-50 border border-neutral-100 text-neutral-600 hover:border-neutral-200'
                                }`}
                              >
                                <div
                                  className="w-10 h-8 grid gap-px"
                                  style={{
                                    gridTemplateColumns: layoutConfigs[layout.id].templateColumns,
                                    gridTemplateRows: layoutConfigs[layout.id].templateRows,
                                  }}
                                >
                                  {layoutCells[layout.id].map((cell, i) => (
                                    <div
                                      key={i}
                                      style={{ gridColumn: cell.gridColumn, gridRow: cell.gridRow }}
                                      className={`rounded-sm ${gridLayout === layout.id ? 'bg-emerald-300' : 'bg-neutral-300'}`}
                                    />
                                  ))}
                                </div>
                                <span>{layoutConfigs[layout.id].label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddCamera(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={14} /> Thêm Camera
                </button>
              </div>

              {gridLayout === '1x1' ? (
                <div className="space-y-3">
                  <button
                    onClick={backToCameraGrid}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ChevronLeft size={14} />
                    Quay lại
                  </button>
                  <LiveMonitor
                    camera={activeCamera}
                    pipelines={pipelines}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    logs={logs}
                    setLogs={setLogs}
                    onEditCamera={(id) => {
                      setEditingCameraId(id);
                      const cam = cameras.find(c => c.id === id);
                      if (cam) {
                        setNewCamera({
                          name: cam.name, location: cam.location, type: cam.type,
                          kind: cam.kind, site: cam.site, username: cam.username, password: cam.password
                        });
                      }
                      setShowAddCamera(true);
                    }}
                    onDeleteCamera={handleDeleteCamera}
                    onTogglePipeline={togglePipeline}
                  />
                </div>
              ) : (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: layoutConfigs[gridLayout].templateColumns,
                    gridTemplateRows: layoutConfigs[gridLayout].templateRows,
                  }}
                >
                  {layoutCells[gridLayout].map((cell, idx) => {
                    const cam = gridCameras[idx];
                    return (
                      <div
                        key={idx}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={() => handleDrop(idx)}
                        style={{ gridColumn: cell.gridColumn, gridRow: cell.gridRow }}
                        className={`border rounded-xl overflow-hidden transition-all ${
                          dragOverIdx === idx ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-neutral-100'
                        } ${cam ? 'bg-white' : 'bg-neutral-50 border-dashed flex items-center justify-center min-h-[200px]'}`}
                      >
                        {cam ? (
                          <div className="relative h-full">
                            <LiveMonitor
                              camera={cam}
                              pipelines={pipelines}
                              alerts={alerts}
                              setAlerts={setAlerts}
                              logs={logs}
                              setLogs={setLogs}
                              isCompact={true}
                              onExpand={() => openCameraDetail(cam.id)}
                              onEditCamera={(id) => {
                                setEditingCameraId(id);
                                const c = cameras.find(c => c.id === id);
                                if (c) {
                                  setNewCamera({
                                    name: c.name, location: c.location, type: c.type,
                                    kind: c.kind, site: c.site, username: c.username, password: c.password
                                  });
                                }
                                setShowAddCamera(true);
                              }}
                              onDeleteCamera={handleDeleteCamera}
                              onTogglePipeline={togglePipeline}
                            />
                          </div>
                        ) : (
                          <div className="text-neutral-400 text-xs text-center p-4">
                            <Plus size={24} className="mx-auto mb-1 opacity-50" />
                            Kéo thả camera từ thanh bên trái vào đây
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSection === 'builder' && (
            <PipelineBuilder
              cameras={cameras}
              pipelines={pipelines}
              setPipelines={setPipelines}
              setRules={setRules}
              onSelectCamera={(id) => setSelectedCameraId(id)}
              onComplete={() => {
                setActiveSection('monitor');
                const alertMsg = document.createElement('div');
                alertMsg.className = "fixed bottom-5 right-5 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-bounce";
                alertMsg.innerHTML = '✓ Kích hoạt luồng AI mới thành công!';
                document.body.appendChild(alertMsg);
                setTimeout(() => alertMsg.remove(), 3000);
              }}
            />
          )}

          {activeSection === 'playback' && (
            <Playback cameras={filteredCameras} alerts={alerts} />
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
                  setNewCamera({
                    name: cam.name, location: cam.location, type: cam.type,
                    kind: cam.kind, site: cam.site, username: cam.username, password: cam.password
                  });
                }
                setShowAddCamera(true);
              }}
              onDeleteCamera={handleDeleteCamera}
            />
          )}
        </main>
      </div>

      {/* Add Camera Modal */}
      {showAddCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-neutral-900 p-4 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CameraIcon size={18} className="text-emerald-400" />
                {editingCameraId ? 'Cập nhật Camera' : 'Thêm Camera Mới'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Tên Camera</label>
                <input
                  type="text"
                  value={newCamera.name || ''}
                  onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                  placeholder="VD: Camera Kho A"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Vị trí lắp đặt</label>
                <input
                  type="text"
                  value={newCamera.location || ''}
                  onChange={e => setNewCamera({...newCamera, location: e.target.value})}
                  placeholder="VD: Khu vực Lối ra vào"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Phân loại</label>
                  <select
                    value={newCamera.type}
                    onChange={e => setNewCamera({...newCamera, type: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="retail">Cửa hàng Bán lẻ</option>
                    <option value="warehouse">Kho hàng</option>
                    <option value="parking">Bãi đỗ xe</option>
                    <option value="conveyor">Băng chuyền</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Kết nối</label>
                  <select
                    value={newCamera.kind}
                    onChange={e => setNewCamera({...newCamera, kind: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="ip">IP Camera</option>
                    <option value="onvif">ONVIF</option>
                    <option value="usb">USB Camera</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    value={newCamera.username || ''}
                    onChange={e => setNewCamera({...newCamera, username: e.target.value})}
                    placeholder="admin"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    value={newCamera.password || ''}
                    onChange={e => setNewCamera({...newCamera, password: e.target.value})}
                    placeholder="admin123"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Site</label>
                <select
                  value={newCamera.site}
                  onChange={e => setNewCamera({...newCamera, site: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="TP.HCM">TP.HCM</option>
                  <option value="Bình Dương">Bình Dương</option>
                </select>
              </div>
            </div>
            <div className="bg-neutral-50 border-t border-neutral-100 p-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddCamera(false);
                  setEditingCameraId(null);
                  setNewCamera({ type: 'retail', kind: 'ip', site: 'Hà Nội', name: '', location: '', username: 'admin', password: 'admin123' });
                }}
                className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-200/50 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveCamera}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                + {editingCameraId ? 'Lưu thay đổi' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
