import { useState, Dispatch, SetStateAction } from 'react';
import { Camera, AlertRule } from '../types';
import { Check, ShieldAlert, Plus, ToggleLeft, ToggleRight, Search, Activity, Trash2, ArrowLeft } from 'lucide-react';

interface RuleEngineProps {
  cameras: Camera[];
  rules: AlertRule[];
  setRules: Dispatch<SetStateAction<AlertRule[]>>;
  role: 'admin' | 'operator' | 'viewer';
  onComplete?: () => void;
}

export default function RuleEngine({
  cameras,
  rules,
  setRules,
  role
}: RuleEngineProps) {
  const [viewState, setViewState] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [ruleName, setRuleName] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState(cameras[0]?.id || '');
  const [targetObject, setTargetObject] = useState('Nhân viên');
  const [condition, setCondition] = useState('Đi vào Khu vực nguy hiểm');
  const [action, setAction] = useState('Hiển thị cảnh báo màn hình & Còi hú');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'error' | 'critical'>('warning');

  const filteredRules = rules.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.targetObject.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleRule = (ruleId: string) => {
    if (role === 'viewer') {
      alert('🔒 Bạn không có quyền bật/tắt Rule với vai trò Viewer.');
      return;
    }
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
  };

  const deleteRule = (ruleId: string) => {
    if (role === 'viewer') {
      alert('🔒 Bạn không có quyền xóa Rule với vai trò Viewer.');
      return;
    }
    if (confirm('Xác nhận xóa quy tắc cảnh báo này?')) {
      setRules(prev => prev.filter(r => r.id !== ruleId));
    }
  };

  const handleSaveRule = () => {
    if (!ruleName.trim()) {
      alert('Vui lòng nhập tên quy tắc!');
      return;
    }
    
    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: ruleName,
      cameraId: selectedCameraId,
      isActive: true,
      targetObject,
      condition,
      action,
      severity,
      createdAt: new Date().toISOString()
    };

    setRules(prev => [newRule, ...prev]);
    
    // Reset form
    setRuleName('');
    setViewState('list');
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'warning': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'error': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'critical': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'info': return 'Thông tin';
      case 'warning': return 'Cảnh báo';
      case 'error': return 'Nguy hiểm';
      case 'critical': return 'Khẩn cấp';
      default: return 'Khác';
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 overflow-hidden">
      {/* Left Sidebar - Rules List */}
      <div className={`${viewState === 'create' ? 'hidden md:flex w-1/3' : 'w-full md:w-1/3 lg:w-1/4'} bg-white border-r border-slate-200 flex flex-col`}>
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert size={18} className="text-indigo-600" />
                Rule Cảnh Báo
              </h2>
              <p className="text-xs text-slate-500 mt-1">Quản lý các quy tắc phát sinh cảnh báo</p>
            </div>
            {role !== 'viewer' && (
              <button
                onClick={() => setViewState('create')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors"
                title="Tạo quy tắc mới"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Tìm kiếm rule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Không tìm thấy quy tắc nào
            </div>
          ) : (
            filteredRules.map(rule => {
              const cam = cameras.find(c => c.id === rule.cameraId);
              return (
                <div key={rule.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-slate-800 line-clamp-1 pr-2">{rule.name}</h3>
                    <button onClick={() => toggleRule(rule.id)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {rule.isActive ? <ToggleRight size={24} className="text-indigo-600" /> : <ToggleLeft size={24} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                    <Activity size={12} />
                    <span className="truncate">{cam?.name || 'Unknown Camera'}</span>
                  </div>
                  <div className={`text-[10px] px-2 py-1 inline-flex rounded-md border font-semibold ${getSeverityColor(rule.severity)}`}>
                    {getSeverityLabel(rule.severity)}
                  </div>
                  
                  <div className="mt-3 flex justify-between items-center">
                    <div className="text-[10px] text-slate-400">
                      If: <span className="text-slate-600 font-medium">{rule.targetObject}</span>
                    </div>
                    {role !== 'viewer' && (
                      <button 
                        onClick={() => deleteRule(rule.id)}
                        className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area - Rule Builder */}
      <div className={`${viewState === 'list' ? 'hidden md:flex flex-1' : 'w-full md:flex-1'} bg-slate-50/50 flex flex-col`}>
        {viewState === 'list' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">Hệ thống Rule Cảnh Báo</h3>
            <p className="text-sm max-w-md">
              Thiết lập các quy tắc "Nếu - Thì" (If-This-Then-That) để hệ thống tự động phát hiện và gửi cảnh báo khi có sự cố xảy ra.
            </p>
            {role !== 'viewer' && (
              <button 
                onClick={() => setViewState('create')}
                className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/30 cursor-pointer"
              >
                <Plus size={16} />
                Tạo Rule Mới
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
              <button 
                onClick={() => setViewState('list')}
                className="md:hidden mb-4 flex items-center gap-1.5 text-slate-500 text-sm hover:text-slate-800"
              >
                <ArrowLeft size={16} /> Quay lại
              </button>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 text-white">
                  <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                    <Plus className="text-indigo-400" />
                    Thiết lập Rule mới
                  </h2>
                  <p className="text-slate-300 text-sm">Định nghĩa logic cảnh báo tùy chỉnh</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tên quy tắc</label>
                    <input 
                      type="text" 
                      value={ruleName}
                      onChange={e => setRuleName(e.target.value)}
                      placeholder="VD: Báo động người lạ vào kho"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Áp dụng cho Camera</label>
                    <select 
                      value={selectedCameraId}
                      onChange={e => setSelectedCameraId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      {cameras.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.site}</option>
                      ))}
                    </select>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Logic Configuration */}
                  <h3 className="font-bold text-slate-800">Logic Cảnh Báo (If - Then)</h3>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-16 text-right font-bold text-slate-400 text-sm">NẾU</div>
                      <div className="flex-1">
                        <select 
                          value={targetObject}
                          onChange={e => setTargetObject(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                        >
                          <option value="Nhân viên">Phát hiện Nhân viên</option>
                          <option value="Khách hàng">Phát hiện Khách hàng</option>
                          <option value="Xe nâng">Phát hiện Xe nâng</option>
                          <option value="Ô tô">Phát hiện Ô tô / Xe máy</option>
                          <option value="Hộp carton">Phát hiện Hộp / Sản phẩm</option>
                          <option value="Đám cháy">Phát hiện Lửa / Khói</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-4 items-center">
                      <div className="w-16 text-right font-bold text-slate-400 text-sm">MÀ</div>
                      <div className="flex-1">
                        <input 
                          type="text"
                          value={condition}
                          onChange={e => setCondition(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                          placeholder="Nhập điều kiện (vd: đi vào vùng cấm)"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 items-center">
                      <div className="w-16 text-right font-bold text-indigo-500 text-sm">THÌ</div>
                      <div className="flex-1">
                        <select 
                          value={action}
                          onChange={e => setAction(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                        >
                          <option value="Hiển thị cảnh báo màn hình & Còi hú">Hiển thị màn hình & Còi hú</option>
                          <option value="Chỉ ghi log hệ thống">Chỉ ghi Log hệ thống</option>
                          <option value="Dừng băng chuyền & Cảnh báo">Dừng thiết bị (Băng chuyền/Barrier)</option>
                          <option value="Gửi tin nhắn Telegram cho bảo vệ">Gửi tin nhắn Zalo/Telegram</option>
                          <option value="Gửi Email cho Quản lý">Gửi Email báo cáo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Mức độ nghiêm trọng</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'info', label: 'Thông tin' },
                        { id: 'warning', label: 'Cảnh báo' },
                        { id: 'error', label: 'Nguy hiểm' },
                        { id: 'critical', label: 'Khẩn cấp' }
                      ].map(sev => (
                        <button
                          key={sev.id}
                          onClick={() => setSeverity(sev.id as any)}
                          className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                            severity === sev.id 
                              ? getSeverityColor(sev.id) + ' shadow-sm ring-1 ring-offset-1 ' + (sev.id === 'critical' ? 'ring-rose-500' : sev.id === 'error' ? 'ring-orange-500' : sev.id === 'warning' ? 'ring-amber-500' : 'ring-blue-500')
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
                
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                  <button 
                    onClick={() => setViewState('list')}
                    className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleSaveRule}
                    className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Check size={16} /> Lưu Quy Tắc
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
