import { useState } from 'react';
import { VISITOR_CHART_DATA, ALERT_CHART_DATA, OBJECT_CHART_DATA, OBJECT_PROPORTION_DATA, WAREHOUSE_CHART_DATA, WAREHOUSE_PROPORTION, VISITOR_RATIO } from '../mockData';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, FileDown, Users, Package, Car, Sparkles, Send } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-slate-200/60 p-3.5 rounded-xl shadow-xl z-50">
        {label && <p className="font-bold text-slate-800 text-xs mb-2 border-b border-slate-100 pb-1.5">{label}</p>}
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </div>
              <span className="font-black text-slate-700">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsPanel() {
  const [selectedRange, setSelectedRange] = useState<'today' | 'week'>('today');
  const [activeMetric, setActiveMetric] = useState<'visitors' | 'warehouse' | 'parking'>('visitors');
  const [aiPrompt, setAiPrompt] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAiSend = (prompt: string) => {
    if (!prompt.trim()) return;
    const lower = prompt.toLowerCase();
    let target: 'visitors' | 'warehouse' | 'parking' = 'visitors';
    if (lower.includes('kho') || lower.includes('hộp') || lower.includes('xe nâng') || lower.includes('kiểm kê') || lower.includes('an toàn') || lower.includes('bảo hộ')) {
      target = 'warehouse';
    } else if (lower.includes('bãi') || lower.includes('xe') || lower.includes('ô tô') || lower.includes('đỗ') || lower.includes('biển số') || lower.includes('phương tiện')) {
      target = 'parking';
    }
    const labels = { visitors: 'Cửa hàng Bán lẻ', warehouse: 'Kho hàng & Nhà máy', parking: 'Bãi đỗ xe' };
    setActiveMetric(target);
    setAiPrompt('');
    showToast(`✓ Đã chuyển sang biểu đồ: ${labels[target]}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="analytics-panel-section">
      {/* Sidebar: Filters & Alert Inbox */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Date / Filter Selector */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Calendar size={16} className="text-emerald-600" />
            Bộ lọc thời gian
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedRange('today')}
              className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${selectedRange === 'today' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/10' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setSelectedRange('week')}
              className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${selectedRange === 'week' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              7 ngày qua
            </button>
          </div>
        </div>

        {/* Category Cards */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2.5">
          <h3 className="font-bold text-sm text-slate-800 mb-2">Phân khu giám sát</h3>
          
          <div
            onClick={() => setActiveMetric('visitors')}
            className={`border rounded-xl p-3 cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${activeMetric === 'visitors' ? 'border-emerald-600 bg-emerald-50/20 shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'}`}
          >
            <Users size={16} className={activeMetric === 'visitors' ? 'text-emerald-600' : 'text-slate-400'} />
            <div>
              <h4 className="font-bold text-xs text-slate-800">Cửa hàng Bán lẻ</h4>
              <p className="text-[9px] text-slate-500">Phân tích hành vi & đếm người</p>
            </div>
          </div>

          <div
            onClick={() => setActiveMetric('warehouse')}
            className={`border rounded-xl p-3 cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${activeMetric === 'warehouse' ? 'border-emerald-600 bg-emerald-50/20 shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'}`}
          >
            <Package size={16} className={activeMetric === 'warehouse' ? 'text-emerald-600' : 'text-slate-400'} />
            <div>
              <h4 className="font-bold text-xs text-slate-800">Kho hàng & Nhà máy</h4>
              <p className="text-[9px] text-slate-500">Giám sát xe nâng, đếm hộp</p>
            </div>
          </div>

          <div
            onClick={() => setActiveMetric('parking')}
            className={`border rounded-xl p-3 cursor-pointer transition-all hover:-translate-y-0.5 flex items-center gap-3 ${activeMetric === 'parking' ? 'border-emerald-600 bg-emerald-50/20 shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'}`}
          >
            <Car size={16} className={activeMetric === 'parking' ? 'text-emerald-600' : 'text-slate-400'} />
            <div>
              <h4 className="font-bold text-xs text-slate-800">Bãi đỗ xe thông minh</h4>
              <p className="text-[9px] text-slate-500">Phân loại xe & đỗ sai quy định</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Workspace (Right Panel) */}
      <div className="lg:col-span-9 flex flex-col bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Section Header with Export buttons */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${activeMetric === 'visitors' ? 'bg-blue-100 text-blue-600' : activeMetric === 'warehouse' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {activeMetric === 'visitors' ? <Users size={20} /> : activeMetric === 'warehouse' ? <Package size={20} /> : <Car size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                Báo cáo: {activeMetric === 'visitors' ? 'Lưu lượng Cửa hàng' : activeMetric === 'warehouse' ? 'Kiểm kê Kho hàng' : 'Phương tiện Bãi đỗ'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Hệ thống báo cáo đa chiều từ dữ liệu Camera AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Đang tạo tệp Excel báo cáo số liệu camera...')}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            >
              <FileDown size={14} /> Xuất Excel
            </button>
          </div>
        </div>

        {/* AI Prompt Bar */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex flex-col gap-3 w-full">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <Sparkles size={16} className="text-emerald-600" />
              Tạo biểu đồ bằng AI
            </h4>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSend(aiPrompt)}
                placeholder="Ví dụ: Vẽ biểu đồ tròn thể hiện tỷ lệ xe máy và ô tô hôm qua..." 
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
              />
              <button
                onClick={() => handleAiSend(aiPrompt)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-colors shadow-md cursor-pointer flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAiSend('Lưu lượng khách tuần này')}
                className="text-[11px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-100"
              >
                Lưu lượng khách tuần này
              </button>
              <button
                onClick={() => handleAiSend('So sánh vi phạm an toàn')}
                className="text-[11px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-100"
              >
                So sánh vi phạm an toàn
              </button>
              <button
                onClick={() => handleAiSend('Hiệu suất nhận diện biển số')}
                className="text-[11px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-100"
              >
                Hiệu suất nhận diện biển số
              </button>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. CHART: Số lượng theo thời gian (Area/Bar) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="mb-4">
                <h4 className="font-bold text-sm text-slate-800">
                  {activeMetric === 'visitors' ? 'Số lượng Khách theo giờ' : activeMetric === 'warehouse' ? 'Kiểm kê hộp vàng theo ngày' : 'Lưu lượng xe cộ theo giờ'}
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Biểu đồ tổng hợp lưu lượng theo thời gian thực</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  {activeMetric === 'visitors' ? (
                    <AreaChart data={VISITOR_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Area type="monotone" dataKey="Vào" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIn)" />
                      <Area type="monotone" dataKey="Ra" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOut)" />
                    </AreaChart>
                  ) : activeMetric === 'warehouse' ? (
                    <BarChart data={WAREHOUSE_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Bar dataKey="Hộp vàng" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={OBJECT_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Area type="monotone" dataKey="Ô tô" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCar)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. CHART: Phân loại theo Object (Line) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="mb-4">
                <h4 className="font-bold text-sm text-slate-800">
                  {activeMetric === 'visitors' ? 'Phân loại Hành vi' : activeMetric === 'warehouse' ? 'Hoạt động Nhân sự & Xe nâng' : 'Số lượng Phương tiện theo thời gian'}
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">So sánh chi tiết các loại đối tượng (Line Chart)</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  {activeMetric === 'visitors' ? (
                    <LineChart data={VISITOR_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Line type="monotone" dataKey="Trong vùng" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} name="Khách lưu lại vùng" />
                    </LineChart>
                  ) : activeMetric === 'warehouse' ? (
                    <LineChart data={WAREHOUSE_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Line type="monotone" dataKey="Nhân viên" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Xe nâng" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  ) : (
                    <LineChart data={OBJECT_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Line type="monotone" dataKey="Xe máy" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Xe tải" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. CHART: Alert theo thời gian (Bar Chart) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="mb-4">
                <h4 className="font-bold text-sm text-slate-800">Số lượng Cảnh báo (Alerts) theo ngày</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Phân bổ cảnh báo theo cấp độ (Bar Chart)</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ALERT_CHART_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Bar dataKey="Danger" fill="#ef4444" radius={[4, 4, 0, 0]} name="Nghiêm trọng (Danger)" />
                    <Bar dataKey="Warning" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Cảnh báo (Warning)" />
                    <Bar dataKey="Info" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Thông tin (Info)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. CHART: Tỷ trọng đối tượng (Pie Chart) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
              <div className="mb-4">
                <h4 className="font-bold text-sm text-slate-800">
                  {activeMetric === 'visitors' ? 'Tỷ lệ Vào / Ra' : activeMetric === 'warehouse' ? 'Cơ cấu nhận diện trong kho' : 'Tỷ trọng các loại phương tiện'}
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Phân bổ tỷ lệ % nhận diện (Pie Chart)</p>
              </div>
              <div className="h-56 flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={activeMetric === 'visitors' ? VISITOR_RATIO : activeMetric === 'warehouse' ? WAREHOUSE_PROPORTION : OBJECT_PROPORTION_DATA} 
                      cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none"
                    >
                      {(activeMetric === 'visitors' ? VISITOR_RATIO : activeMetric === 'warehouse' ? WAREHOUSE_PROPORTION : OBJECT_PROPORTION_DATA).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
