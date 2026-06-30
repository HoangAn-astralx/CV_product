import { useState } from 'react';
import { Camera as CameraType } from '../types';
import { 
  Camera, Users, HardDrive, Plus, Edit2, Trash2, 
  Shield, Settings, Eye, CheckCircle2, AlertCircle, 
  Wifi, Search, Download, Bell
} from 'lucide-react';

interface AdminPanelProps {
  cameras: CameraType[];
  onEditCamera: (id: string) => void;
  onDeleteCamera: (id: string) => void;
}

export default function AdminPanel({ cameras, onEditCamera, onDeleteCamera }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'cameras' | 'users' | 'storage' | 'notifications'>('cameras');

  return (
    <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[700px]">
      <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 px-3">Quản trị</h2>
        
        <button
          onClick={() => setActiveTab('cameras')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
            activeTab === 'cameras' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-600 hover:bg-slate-200/50'
          }`}
        >
          <Camera size={18} /> Quản lý Camera
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
            activeTab === 'users' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-600 hover:bg-slate-200/50'
          }`}
        >
          <Users size={18} /> Quản lý Người dùng
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
            activeTab === 'storage' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-600 hover:bg-slate-200/50'
          }`}
        >
          <HardDrive size={18} /> Quản lý Lưu trữ
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
            activeTab === 'notifications' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-600 hover:bg-slate-200/50'
          }`}
        >
          <Bell size={18} /> Quản lý Thông báo
        </button>
      </div>

      <div className="flex-1 p-6 lg:p-8 bg-white overflow-y-auto">
        
        {activeTab === 'cameras' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-widest">Danh sách Camera</h3>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4">Camera</th>
                    <th className="p-4">Địa điểm</th>
                    <th className="p-4">Thông số</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cameras.map(cam => (
                    <tr key={cam.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{cam.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 font-mono">{cam.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-md text-xs font-semibold">{cam.site}</span>
                        <p className="text-xs text-slate-500 mt-1.5">{cam.location}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-xs text-slate-700 font-medium">{cam.resolution} • {cam.fps} FPS</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ping: {cam.latency}ms</p>
                      </td>
                      <td className="p-4">
                        {cam.status === 'online' ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 w-fit">
                            <CheckCircle2 size={14} /> Đã kết nối
                          </span>
                        ) : (
                          <span className="text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 w-fit">
                            <AlertCircle size={14} /> Mất tín hiệu
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Kiểm tra tín hiệu"
                            onClick={() => alert(`Đang ping đến ${cam.name}... (Ping: ${cam.latency}ms)`)}
                          >
                            <Wifi size={18} />
                          </button>
                          <button 
                            onClick={() => onEditCamera(cam.id)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => onDeleteCamera(cam.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xoá"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Quản lý Tài khoản</h3>
              </div>
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer">
                <Plus size={18} /> Tạo Tài khoản
              </button>
            </div>

            <div className="flex gap-3 items-center bg-slate-50 border border-slate-200 p-2 rounded-xl">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm người dùng..." 
                  className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <button className="bg-white border border-slate-200 px-5 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                Lọc
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4">Người dùng</th>
                    <th className="p-4">Vai trò (Role)</th>
                    <th className="p-4">Lần đăng nhập cuối</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-lg">A</div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Admin</p>
                          <p className="text-xs text-slate-500 mt-0.5">admin@visionos.vn</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><Shield size={14}/> Admin</span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">2026-06-29 08:30</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1.5 rounded-md text-xs font-bold w-fit bg-emerald-50 text-emerald-600">Đang hoạt động</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Sửa quyền">
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-black text-slate-800">Quản lý Lưu trữ</h3>
              </div>

            <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <HardDrive size={120} />
              </div>
              <div className="relative z-10">
                <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-4">Dung lượng</h4>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-black">3245</span>
                  <span className="text-xl font-medium text-slate-400 mb-1">/ 5000 GB</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">Đã sử dụng 65% tổng dung lượng khả dụng.</p>
                <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-purple-500 rounded-full transition-all duration-1000" style={{ width: '65%' }} />
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>0 GB</span>
                  <span>5000 GB</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Settings size={20} className="text-emerald-600" /> Thời gian lưu trữ
              </h4>
              
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white border border-slate-200 rounded-xl">
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">Chính sách chung</h5>
                    <p className="text-xs text-slate-500 mt-1.5">Áp dụng cho tất cả camera</p>
                  </div>
                  <div className="flex items-center gap-3 mt-4 sm:mt-0">
                    <select className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 outline-none cursor-pointer">
                      <option value={30}>Lưu 30 ngày</option>
                      <option value={7}>Lưu 7 ngày</option>
                      <option value={14}>Lưu 14 ngày</option>
                      <option value={60}>Lưu 60 ngày</option>
                      <option value={90}>Lưu 90 ngày</option>
                    </select>
                    <button className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors cursor-pointer">
                      Cập nhật
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-black text-slate-800">Kênh Thông báo</h3>
              </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Bell size={20} className="text-emerald-600" /> Cấu hình tích hợp
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-bold text-sm text-slate-800">Zalo OA</h5>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Đã kết nối</span>
                  </div>
                  <input type="text" defaultValue="Zalo App ID: 123456789" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mb-2" />
                  <input type="password" defaultValue="secret_token" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mb-3" />
                  <button className="w-full bg-emerald-50 text-emerald-600 font-bold text-xs py-2 rounded-lg cursor-pointer">Cập nhật Token</button>
                </div>
                
                <div className="bg-white border border-slate-200 p-5 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-bold text-sm text-slate-800">Email SMTP</h5>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Đã kết nối</span>
                  </div>
                  <input type="text" defaultValue="smtp.gmail.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mb-2" />
                  <input type="text" defaultValue="alert@visionos.vn" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mb-3" />
                  <button className="w-full bg-emerald-50 text-emerald-600 font-bold text-xs py-2 rounded-lg cursor-pointer">Kiểm tra kết nối</button>
                </div>
                
                <div className="bg-white border border-slate-200 p-5 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-bold text-sm text-slate-800">Telegram Bot</h5>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Chưa cấu hình</span>
                  </div>
                  <input type="text" placeholder="Bot Token" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mb-2" />
                  <input type="text" placeholder="Chat ID" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mb-3" />
                  <button className="w-full bg-slate-800 text-white font-bold text-xs py-2 rounded-lg cursor-pointer">Thiết lập kết nối</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
