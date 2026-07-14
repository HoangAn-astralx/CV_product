import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Camera, Pipeline, AlertEvent, LogEntry, AlertRule } from './types';
import { INITIAL_CAMERAS, INITIAL_PIPELINES, INITIAL_ALERTS, INITIAL_LOGS, INITIAL_RULES } from './mockData';
import { fetchCameras, fetchPipelines, fetchEvents, startPipeline, stopPipeline } from './api';
import LiveMonitor from './components/LiveMonitor';
import PipelineBuilder from './components/PipelineBuilder';
import Playback from './components/Playback';
import AnalyticsPanel from './components/AnalyticsPanel';
import AdminPanel from './components/AdminPanel';
import { Plus, BarChart3, Settings, Camera as CameraIcon, AlertTriangle, Search, Eye, ChevronDown, ChevronLeft, ChevronRight, LogOut, LayoutGrid, Menu, X, Maximize, Minimize, User } from 'lucide-react';

type Page = 'monitor' | 'builder' | 'playback' | 'analytics' | 'admin';
type GridLayout = '1x1' | '2x2' | '3x3' | '4x4' | '1+2' | '2+1';

const layoutConfigs: Record<GridLayout, { label: string; cols: number; rows: number; cells: number; templateColumns: string; templateRows: string }> = {
  '1x1': { label: '1x1', cols: 1, rows: 1, cells: 1, templateColumns: 'minmax(0, 1fr)', templateRows: 'minmax(0, 1fr)' },
  '2x2': { label: '2x2', cols: 2, rows: 2, cells: 4, templateColumns: 'repeat(2, minmax(0, 1fr))', templateRows: 'repeat(2, minmax(0, 1fr))' },
  '3x3': { label: '3x3', cols: 3, rows: 3, cells: 9, templateColumns: 'repeat(3, minmax(0, 1fr))', templateRows: 'repeat(3, minmax(0, 1fr))' },
  '4x4': { label: '4x4', cols: 4, rows: 4, cells: 16, templateColumns: 'repeat(4, minmax(0, 1fr))', templateRows: 'repeat(4, minmax(0, 1fr))' },
  '1+2': { label: '1+2', cols: 2, rows: 2, cells: 3, templateColumns: '2fr 1fr', templateRows: 'repeat(2, minmax(0, 1fr))' },
  '2+1': { label: '2+1', cols: 2, rows: 2, cells: 3, templateColumns: '1fr 2fr', templateRows: 'repeat(2, minmax(0, 1fr))' },
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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>(INITIAL_PIPELINES);
  const [alerts, setAlerts] = useState<AlertEvent[]>(INITIAL_ALERTS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [rules, setRules] = useState<AlertRule[]>(INITIAL_RULES);
  const [selectedSite, setSelectedSite] = useState<'Tất cả' | 'Hà Nội' | 'TP.HCM' | 'Bình Dương'>('Tất cả');


  const [cameras, setCameras] = useState<Camera[]>(() => {
    const saved = localStorage.getItem('visionos_cameras_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    if (gridLayout !== '1x1') {
      setGridCameras(filteredCameras.slice(0, cells));
    }
  }, [gridLayout, selectedSite]);

  // Auto-switch grid on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && (gridLayout === '3x3' || gridLayout === '4x4')) {
        setGridLayout('2x2');
        setGridCameras(filteredCameras.slice(0, 4));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // ── Sync từ backend API ──────────────────────────────────────────────────
  useEffect(() => {
    // Load cameras từ API, API cameras xuất hiện đầu list (override mock trùng id)
    fetchCameras().then(apiCams => {
      setCameras(prev => {
        const apiIds = new Set(apiCams.map(c => c.id));
        const merged: Camera[] = [
          ...apiCams,
          ...prev.filter(c => !apiIds.has(c.id)),
        ];
        return merged;
      });
    }).catch(() => { /* backend chưa sẵn sàng, dùng mock */ });

    // Load pipelines từ API
    fetchPipelines().then(apiPipes => {
      setPipelines(prev => {
        const apiIds = new Set(apiPipes.map(p => p.id));
        const merged: Pipeline[] = [
          ...apiPipes,
          ...prev.filter(p => !apiIds.has(p.id)),
        ];
        return merged;
      });
    }).catch(() => {});
  }, []);

  // Poll events/alerts từ API mỗi 5 giây
  useEffect(() => {
    const poll = async () => {
      try {
        const apiEvents = await fetchEvents(20);
        setAlerts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newOnes = apiEvents.filter(e => !existingIds.has(e.id));
          if (newOnes.length === 0) return prev;
          return [...newOnes, ...prev];
        });
      } catch { /* ignore if offline */ }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const toggleFullscreen = () => {
    const el = document.getElementById('monitor-grid-container');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

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

  const IS_BACKEND_UUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const togglePipeline = async (pipelineId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;

    // Gọi API backend trước cho pipeline UUID thật
    if (IS_BACKEND_UUID(pipelineId)) {
      try {
        if (pipeline.isActive) {
          await stopPipeline(pipelineId);
        } else {
          await startPipeline(pipelineId);
        }
      } catch (e) {
        console.error('[togglePipeline] API error:', e);
        // Vẫn update local state để UI không bị kẹt
      }
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
    { id: 'monitor', label: 'Giám sát', icon: <Eye size={20} /> },
    { id: 'builder', label: 'Cấu hình', icon: <CameraIcon size={20} /> },
    { id: 'playback', label: 'Xem lại', icon: <Search size={20} /> },
    { id: 'analytics', label: 'Báo cáo', icon: <BarChart3 size={20} /> },
    { id: 'admin', label: 'Quản trị', icon: <Settings size={20} /> },
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
    <div className="h-screen w-screen bg-slate-900 text-neutral-100 font-sans antialiased flex flex-col overflow-hidden">
      
      {/* Top Header (Desktop App Style) */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20 shrink-0 shadow-sm">
        
        {/* Left: Logo */}
        <div className="flex-1 flex items-center justify-start gap-3 h-full">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-600/20">
            <Eye size={20} />
          </div>
          <h1 className="font-black text-xl text-white hidden sm:block tracking-tight">VisionOS</h1>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center justify-center gap-2 h-full">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2 px-4 h-full text-sm font-bold transition-all cursor-pointer relative border-b-2 ${
                activeSection === item.id
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
              title={item.label}
            >
              <div className="shrink-0">{item.icon}</div>
              <span>{item.label}</span>
              {item.id === 'monitor' && unreadAlertsCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                  {unreadAlertsCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex-1 flex items-center justify-end gap-3 h-full">
          {/* Mobile hamburger for camera list when in monitor mode */}
          {activeSection === 'monitor' && (
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="lg:hidden flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
              title="Danh sách Camera"
            >
              <Menu size={18} className="shrink-0" />
            </button>
          )}
          
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
            className="hidden sm:block bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs font-medium text-slate-300 focus:outline-hidden cursor-pointer"
            title="Khu vực"
          >
            <option value="Tất cả">Tất cả khu vực</option>
            <option value="Hà Nội">Hà Nội</option>
            <option value="TP.HCM">TP.HCM</option>
            <option value="Bình Dương">Bình Dương</option>
          </select>

          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer"
            title="Thông tin cá nhân"
          >
            <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <User size={15} />
            </div>
            <span className="hidden sm:inline text-xs font-bold text-slate-200">{loginUsername || 'admin'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-neutral-50 text-neutral-800">
        <main className={`flex-1 flex flex-col min-h-0 ${
          (activeSection === 'monitor' || activeSection === 'playback' || activeSection === 'builder') 
            ? 'p-0 overflow-hidden' // Zero padding and hide overflow for full edge-to-edge desktop feel
            : 'p-3 sm:p-4 lg:p-6 overflow-y-auto'
        }`}>
          {activeSection === 'monitor' && (
            <div className="flex flex-col lg:flex-row h-full min-h-0">

              {/* Mobile Sidebar Drawer */}
              {showMobileSidebar && (
                <div className="fixed inset-0 z-50 lg:hidden">
                  <div className="absolute inset-0 bg-black/40 mobile-sidebar-overlay" onClick={() => setShowMobileSidebar(false)} />
                  <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl mobile-sidebar-panel flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Camera</h3>
                      <button onClick={() => setShowMobileSidebar(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                        <X size={18} />
                      </button>
                    </div>
                    {/* Mobile site filter */}
                    <div className="px-4 py-2 border-b border-slate-100 sm:hidden">
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
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 focus:outline-hidden cursor-pointer"
                      >
                        <option value="Tất cả">Tất cả địa điểm</option>
                        <option value="Hà Nội">Hà Nội</option>
                        <option value="TP.HCM">TP.HCM</option>
                        <option value="Bình Dương">Bình Dương</option>
                      </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                      {Object.entries(
                        filteredCameras.reduce((acc, cam) => {
                          if (!acc[cam.site]) acc[cam.site] = [];
                          acc[cam.site].push(cam);
                          return acc;
                        }, {} as Record<string, Camera[]>)
                      ).map(([site, cams]: [string, Camera[]]) => (
                        <details key={site} className="group" open>
                          <summary className="cursor-pointer list-none flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{site}</span>
                            <ChevronDown size={14} className="text-slate-400 group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="pl-2 space-y-1 mt-1">
                            {cams.map(camera => (
                              <div
                                key={camera.id}
                                onClick={() => { openCameraDetail(camera.id); setShowMobileSidebar(false); }}
                                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                                  selectedCameraId === camera.id
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-transparent hover:border-emerald-300 hover:shadow-sm bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate">{camera.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{camera.location}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop sidebar */}
              <div className="w-full lg:w-56 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col h-full overflow-hidden hidden lg:flex">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 px-3 pt-3">Danh sách Camera</h3>
                <div className="flex-1 overflow-y-auto space-y-1.5 px-2 pb-2 custom-scrollbar">
                  {Object.entries(
                    filteredCameras.reduce((acc, cam) => {
                      if (!acc[cam.site]) acc[cam.site] = [];
                      acc[cam.site].push(cam);
                      return acc;
                    }, {} as Record<string, Camera[]>)
                  ).map(([site, cams]: [string, Camera[]]) => (
                    <details key={site} className="group" open>
                      <summary className="cursor-pointer list-none flex items-center justify-between p-1.5 hover:bg-slate-200/50 rounded-md">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{site}</span>
                        <ChevronDown size={14} className="text-slate-400 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="pl-1.5 space-y-0.5 mt-0.5">
                        {cams.map(camera => (
                          <div
                            key={camera.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData('text/plain', camera.id); handleDragStart(camera.id); }}
                            onClick={() => openCameraDetail(camera.id)}
                            className={`p-2 rounded-md border transition-all cursor-grab active:cursor-grabbing ${
                              (selectedCameraId === camera.id && gridLayout === '1x1') || gridCameras.some(c => c?.id === camera.id)
                                ? 'border-emerald-500 bg-emerald-50/80 shadow-sm'
                                : 'border-transparent hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-slate-800 truncate">{camera.name}</p>
                                <p className="text-[9px] text-slate-400 truncate">{camera.location}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              {/* Monitor Main Section */}
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-100" id="monitor-grid-container">
              {/* Toolbar */}
              <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                    <button
                      onClick={() => setShowGridMenu(!showGridMenu)}
                      className="px-2 py-1.5 text-[11px] font-medium rounded md:rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <LayoutGrid size={12} />
                      {layoutConfigs[gridLayout].label}
                    </button>
                    {showGridMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowGridMenu(false)} />
                        <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 z-50 min-w-[180px]">
                          <div className="text-[10px] font-medium text-slate-400 mb-2 px-1">Chọn bố cục lưới</div>
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
                                className={`p-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer flex flex-col items-center gap-1 ${
                                  gridLayout === layout.id
                                    ? 'bg-emerald-900/30 ring-1 ring-emerald-500 text-emerald-400'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                <div
                                  className="w-8 h-6 grid gap-px"
                                  style={{
                                    gridTemplateColumns: layoutConfigs[layout.id].templateColumns,
                                    gridTemplateRows: layoutConfigs[layout.id].templateRows,
                                  }}
                                >
                                  {layoutCells[layout.id].map((cell, i) => (
                                    <div
                                      key={i}
                                      style={{ gridColumn: cell.gridColumn, gridRow: cell.gridRow }}
                                      className={`rounded-xs ${gridLayout === layout.id ? 'bg-emerald-500' : 'bg-slate-600'}`}
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
                  onClick={toggleFullscreen}
                  className="px-2 py-1.5 text-[11px] font-medium rounded md:rounded-md bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors cursor-pointer flex items-center gap-1"
                >
                  {isFullscreen ? <><Minimize size={14} /> <span className="hidden sm:inline">Thu nhỏ</span></> : <><Maximize size={14} /> <span className="hidden sm:inline">Toàn màn hình</span></>}
                </button>
              </div>

              {gridLayout === '1x1' ? (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
                  <div className="p-2 border-b border-slate-200 flex-shrink-0 bg-white sticky top-0 z-10">
                    <button
                      onClick={backToCameraGrid}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <ChevronLeft size={14} />
                      Quay lại lưới
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
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
                </div>
              ) : (
                <div
                  className="flex-1 grid gap-3 p-3 bg-slate-100 min-h-0 overflow-hidden"
                  style={{
                    gridTemplateColumns: window.innerWidth < 640 && (gridLayout === '3x3' || gridLayout === '4x4')
                      ? 'repeat(2, minmax(0, 1fr))'
                      : layoutConfigs[gridLayout].templateColumns,
                    gridTemplateRows: window.innerWidth < 640 && (gridLayout === '3x3' || gridLayout === '4x4')
                      ? `repeat(${Math.ceil(layoutConfigs[gridLayout].cells / 2)}, minmax(0, 1fr))`
                      : layoutConfigs[gridLayout].templateRows,
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
                        className={`overflow-hidden rounded-lg transition-all relative min-h-0 flex flex-col ${
                          dragOverIdx === idx ? 'ring-2 ring-emerald-500 z-10 shadow-lg shadow-emerald-500/20' : 'ring-1 ring-slate-200 shadow-sm'
                        } ${cam ? 'bg-white' : 'bg-slate-200/50 flex items-center justify-center min-h-[120px]'}`}
                      >
                        {cam ? (
                          <div className="relative flex-1 min-h-0 flex flex-col w-full">
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
                          <div className="text-slate-700 flex flex-col items-center gap-2">
                            <CameraIcon size={24} className="opacity-20" />
                            <span className="text-[10px] opacity-40 font-medium">Trống</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
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
      {showProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowProfile(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <User size={18} className="text-emerald-600" />
                Thông tin cá nhân
              </h3>
              <button
                onClick={() => setShowProfile(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <User size={40} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">{loginUsername || 'admin'}</h2>
              <p className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full mt-2 border border-emerald-100">Quản trị viên hệ thống</p>
              
              <div className="w-full mt-6 space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3">
                  <span className="text-slate-500">Email</span>
                  <span className="font-medium text-slate-700">{loginUsername || 'admin'}@visionos.vn</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3">
                  <span className="text-slate-500">Vai trò</span>
                  <span className="font-medium text-slate-700">System Admin</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Trạng thái</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Hoạt động
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setShowProfile(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
