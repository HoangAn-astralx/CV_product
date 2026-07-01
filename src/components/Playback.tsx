import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertEvent } from '../types';
import { Search, Sparkles, Play, Pause, FastForward, Rewind, Camera as CameraIcon, Download, BookmarkPlus, Clock, ChevronRight, ChevronDown, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { SMART_SEARCH_PRESETS } from '../mockData';

interface SearchResult {
  id: string;
  query: string;
  cameraName: string;
  timestamp: string;
  score: number;
  description: string;
  objectType: string;
  color: string;
  thumbnailEmoji: string;
}

const MOCK_RESULTS: Record<string, SearchResult[]> = {
  'default': [
    {
      id: 'res-1',
      query: 'Người đội mũ bảo hộ màu đỏ',
      cameraName: 'Camera Kho hàng Trung tâm',
      timestamp: '2026-06-23 10:14:32',
      score: 97,
      description: 'Phát hiện nhân viên kỹ thuật đi qua kệ hàng phụ B đeo mũ bảo hộ đạt tiêu chuẩn an toàn.',
      objectType: 'Nhân viên',
      color: '#ef4444',
      thumbnailEmoji: '👷🔴',
    }
  ],
  'xe tải': [
    {
      id: 'res-xt-1',
      query: 'Xe tải màu trắng đi ra',
      cameraName: 'Camera Bãi đỗ xe thông minh',
      timestamp: '1 giờ trước (22:48:12)',
      score: 96,
      description: 'Xe container chở hàng logistics đi ra hướng cổng ranh giới Bắc.',
      objectType: 'Xe chở hàng',
      color: '#3b82f6',
      thumbnailEmoji: '🚛⚪',
    }
  ],
  'mũ': [
    {
      id: 'res-mh-1',
      query: 'Người đội mũ bảo hộ màu đỏ',
      cameraName: 'Camera Kho hàng Trung tâm',
      timestamp: '10 phút trước (23:38:00)',
      score: 99,
      description: 'Kỹ sư trưởng kiểm tra hộp điện phía Tây kho trung tâm.',
      objectType: 'Nhân viên',
      color: '#ef4444',
      thumbnailEmoji: '👷🔴',
    }
  ]
};

interface PlaybackProps {
  cameras: Camera[];
  alerts: AlertEvent[];
}

export default function Playback({ cameras, alerts }: PlaybackProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'search' | 'export'>('events');
  const [selectedCameraId, setSelectedCameraId] = useState<string>(cameras[0]?.id || '');

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progress, setProgress] = useState(35);
  const [streamMode, setStreamMode] = useState('default');

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState('14:35');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleDragStart = (e: React.DragEvent, cameraId: string) => {
    e.dataTransfer.setData('text/plain', cameraId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const cameraId = e.dataTransfer.getData('text/plain');
    if (cameraId && cameras.some(c => c.id === cameraId)) {
      setSelectedCameraId(cameraId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const activeCamera = cameras.find(c => c.id === selectedCameraId) || cameras[0];
  const cameraAlerts = alerts.filter(a => a.cameraName === activeCamera?.name);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(p => (p >= 100 ? 0 : p + 0.1 * playbackSpeed));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const handleSearch = (queryText: string) => {
    if (!queryText.trim()) return;

    setSearchQuery(queryText);
    setIsSearching(true);

    setTimeout(() => {
      setIsSearching(false);
      const queryLower = queryText.toLowerCase();
      if (queryLower.includes('xe tải')) {
        setResults(MOCK_RESULTS['xe tải']);
      } else if (queryLower.includes('mũ')) {
        setResults(MOCK_RESULTS['mũ']);
      } else {
        setResults(MOCK_RESULTS['default']);
      }
    }, 800);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setProgress(Math.max(0, Math.min(100, percentage)));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full" id="playback-section">
      <div className="w-full lg:w-56 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col h-full overflow-hidden hidden lg:flex">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 px-3 pt-3">Danh sách Camera</h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {Object.entries(
            cameras.reduce((acc, cam) => {
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
                    onDragStart={(e) => handleDragStart(e, camera.id)}
                    onClick={() => setSelectedCameraId(camera.id)}
                    className={`p-2 rounded-md border transition-all cursor-grab active:cursor-grabbing ${
                      selectedCameraId === camera.id
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

      <div
        className="flex-1 flex flex-col bg-black overflow-hidden h-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="bg-slate-900 px-4 sm:px-5 py-3 flex items-center justify-between text-white gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-bold text-sm truncate">{activeCamera?.name || 'Kéo thả camera vào đây'}</span>
            {/* Mobile camera selector */}
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="lg:hidden bg-slate-800 text-[10px] text-white rounded-lg px-2 py-1.5 outline-none border border-slate-700 max-w-[140px]"
            >
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id}>{cam.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 text-[10px] text-white rounded-lg px-2 py-1.5 outline-none border border-slate-700 [color-scheme:dark]"
            />
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="bg-slate-800 text-[10px] text-white rounded-lg px-2 py-1.5 outline-none border border-slate-700 [color-scheme:dark]"
            />
            <select
              value={streamMode}
              onChange={(e) => setStreamMode(e.target.value)}
              className="bg-slate-800 text-[10px] text-white rounded-lg px-2 py-1 outline-none border border-slate-700 cursor-pointer"
            >
              <option value="default">Chế độ: Mặc định (HD)</option>
              <option value="sub">Chế độ: Luồng phụ (SD)</option>
              <option value="night">Chế độ: Ban đêm (Hồng ngoại)</option>
              <option value="ai">Chế độ: AI (Kèm viền đối tượng)</option>
            </select>
            <button
              onClick={() => alert('Đã chụp ảnh màn hình lưu vào Download')}
              className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-300 hover:text-white"
              title="Chụp ảnh màn hình"
            >
              <CameraIcon size={16} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-300 hover:text-white"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        <div ref={playerRef} className="relative flex-1 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
           <div className="absolute inset-0 flex items-center justify-center text-slate-800 pointer-events-none opacity-20">
             <CameraIcon size={120} />
           </div>

           <div className="absolute top-4 right-4 bg-black/60 text-white font-mono text-[10px] px-2 py-1 rounded border border-white/10">
             {selectedDate} {selectedTime}
           </div>

           {!isPlaying && (
             <button
               onClick={() => setIsPlaying(true)}
               className="absolute z-10 w-16 h-16 bg-emerald-600/80 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-transform hover:scale-105 shadow-lg shadow-emerald-500/30"
             >
               <Play size={24} className="ml-1" />
             </button>
           )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 p-4">
          <div className="mb-4 relative">
            <div className="flex justify-between text-[9px] text-slate-400 font-bold mb-1 font-mono">
              <span>12:00</span>
              <span>14:00</span>
              <span>16:00</span>
              <span>18:00</span>
            </div>

            <div
              className="h-8 bg-slate-200 rounded-md relative cursor-pointer group overflow-hidden border border-slate-300/50 shadow-inner"
              onClick={handleTimelineClick}
            >
              <div
                className="absolute top-0 bottom-0 left-0 bg-emerald-500/30 border-r-2 border-emerald-600 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white rounded-full border-2 border-emerald-600 shadow-md transform scale-y-110 group-hover:scale-y-125 transition-transform" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
                <Rewind size={16} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
                <FastForward size={16} />
              </button>
            </div>

            <div className="flex bg-slate-200 rounded-lg p-0.5">
              {[0.5, 1, 2, 4].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${playbackSpeed === speed ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 flex flex-col bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden h-full">
        <div className="flex border-b border-slate-100 bg-slate-50">
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'events' ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sự kiện
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'search' ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Tìm nhanh
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'export' ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Xuất file
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">

          {activeTab === 'events' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 mb-2">Sự kiện ghi nhận trên Camera này</h3>
              {cameraAlerts.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-10">Không có sự kiện vi phạm nào.</p>
              ) : (
                cameraAlerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      setIsPlaying(false);
                      setProgress(Math.random() * 100);
                    }}
                    className="bg-white border border-slate-100 p-3 rounded-xl shadow-xs cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {alert.type === 'safety_hazard' || alert.type === 'intrusion' ? (
                          <AlertTriangle size={12} className="text-rose-500" />
                        ) : alert.type === 'overlimit' ? (
                          <AlertTriangle size={12} className="text-amber-500" />
                        ) : (
                          <Sparkles size={12} className="text-emerald-500" />
                        )}
                        <span className="text-[10px] font-bold text-slate-700">{alert.timestamp}</span>
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 transition-opacity">
                        Đến <ChevronRight size={10} />
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-snug line-clamp-2">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[10px] text-emerald-800 font-medium">
                  Tìm kiếm thông minh các vật thể, màu sắc, hoặc hành vi bằng ngôn ngữ tự nhiên.
                </p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  placeholder="VD: người đội mũ đỏ..."
                  className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors"
                >
                  <Search size={12} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SMART_SEARCH_PRESETS.slice(0,3).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(p.text)}
                    className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-full border border-slate-200 transition-colors whitespace-nowrap"
                  >
                    {p.text}
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                {isSearching ? (
                  <div className="flex justify-center py-4"><Search size={16} className="animate-spin text-emerald-400" /></div>
                ) : results.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase">Kết quả ({results.length})</h4>
                    {results.map(res => (
                      <div
                        key={res.id}
                        onClick={() => setProgress(50)}
                        className="bg-white border border-slate-100 p-2 rounded-lg flex items-center gap-3 cursor-pointer hover:border-emerald-300 transition-colors"
                      >
                        <div className="text-xl bg-slate-100 w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0">
                          {res.thumbnailEmoji}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-700 truncate">{res.objectType}</p>
                          <p className="text-[9px] text-slate-500 truncate">{res.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">Không tìm thấy kết quả</p>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
               <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-emerald-300 cursor-pointer transition-colors group" onClick={() => alert('Đã bookmark thành công')}>
                 <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <BookmarkPlus size={18} />
                 </div>
                 <h4 className="text-xs font-bold text-slate-800">Đánh dấu (Bookmark)</h4>
                 <p className="text-[9px] text-slate-500 mt-1">Lưu lại mốc thời gian hiện tại để xem lại sau</p>
               </div>

               <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-emerald-300 cursor-pointer transition-colors group" onClick={() => alert('Đã tải frame hiện tại')}>
                 <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <CameraIcon size={18} />
                 </div>
                 <h4 className="text-xs font-bold text-slate-800">Xuất Frame (Ảnh tĩnh)</h4>
                 <p className="text-[9px] text-slate-500 mt-1">Tải xuống khung hình hiện tại (.jpg / .png)</p>
               </div>

               <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-emerald-300 cursor-pointer transition-colors group" onClick={() => alert('Đang render clip và tải xuống...')}>
                 <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <Download size={18} />
                 </div>
                 <h4 className="text-xs font-bold text-slate-800">Xuất Video Clip</h4>
                 <p className="text-[9px] text-slate-500 mt-1">Trích xuất đoạn clip 15s xung quanh vị trí này (.mp4)</p>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
