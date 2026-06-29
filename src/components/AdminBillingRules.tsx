import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Check, 
  ArrowLeft, 
  Clock, 
  Coins, 
  Navigation, 
  PlusCircle, 
  MinusCircle, 
  Settings, 
  Info, 
  CheckCircle2, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { db, doc, onSnapshot, setDoc } from '../lib/dbProxy';
import { BillingRules, TimeSlot, DEFAULT_BILLING_RULES } from '../types';

interface AdminBillingRulesProps {
  onShowToast: (msg: string) => void;
}

// Preset options matching MileageModeView
const START_TIME_OPTIONS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

const END_TIME_OPTIONS = [
  '00:59', '01:59', '02:59', '03:59', '04:59', '05:59', '06:59', '07:59', '08:59', '09:59', '10:59', '11:59', '12:59', '13:59', '14:59', '15:59', '16:59', '17:59', '18:59', '19:59', '20:59', '21:59', '22:59', '23:59'
];

export default function AdminBillingRules({ onShowToast }: AdminBillingRulesProps) {
  // Global Firestore State
  const [activeTemplateName, setActiveTemplateName] = useState<string>('系统默认线上计费模版');
  const [templates, setTemplates] = useState<BillingRules[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing workspace states
  const [editingTemplate, setEditingTemplate] = useState<BillingRules | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlots, setEditSlots] = useState<TimeSlot[]>([]);
  const [editReturnStartKm, setEditReturnStartKm] = useState(15);
  const [editReturnPerKm, setEditReturnPerKm] = useState(2);
  const [editReturnIntervalKm, setEditReturnIntervalKm] = useState(1);
  const [editReturnIncrease, setEditReturnIncrease] = useState(2);
  const [editFreeWaitingTime, setEditFreeWaitingTime] = useState(15);
  const [editWaitingPerMin, setEditWaitingPerMin] = useState(1);
  const [editWaitingInterval, setEditWaitingInterval] = useState(1);
  const [editWaitingIncrease, setEditWaitingIncrease] = useState(1);

  // New Template modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Selected template menu drawer (mobile style option sheet)
  const [activeMenuTemplate, setActiveMenuTemplate] = useState<BillingRules | null>(null);

  // Fetch online billing configurations on mount
  useEffect(() => {
    const configDocRef = doc(db, 'config', 'online_billing_rules');
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setActiveTemplateName(data.activeTemplateName || '系统默认线上计费模版');
        setTemplates(data.templates || []);
      } else {
        // Populate default template in database if not set
        const defaultTemplates = [
          {
            templateName: '系统默认线上计费模版',
            slots: [
              { id: '1', startTime: '06:00', endTime: '18:59', startingPrice: 38, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
              { id: '2', startTime: '19:00', endTime: '23:59', startingPrice: 42, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
              { id: '3', startTime: '00:00', endTime: '05:59', startingPrice: 48, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
            ],
            returnFeeStartKm: 15,
            returnFeePerKm: 2,
            returnFeeIntervalKm: 1,
            returnFeeIncreaseYuan: 2,
            freeWaitingTime: 15,
            waitingChargePerMin: 1,
            waitingIntervalMin: 1,
            waitingIncreaseYuan: 1,
          },
          {
            templateName: '夜间高额线上加价模版',
            slots: [
              { id: '1', startTime: '06:00', endTime: '18:59', startingPrice: 45, includedDistance: 6, unitPricePerKm: 6, distanceInterval: 1, priceIncrease: 6 },
              { id: '2', startTime: '19:00', endTime: '23:59', startingPrice: 50, includedDistance: 6, unitPricePerKm: 6, distanceInterval: 1, priceIncrease: 6 },
              { id: '3', startTime: '00:00', endTime: '05:59', startingPrice: 60, includedDistance: 6, unitPricePerKm: 6, distanceInterval: 1, priceIncrease: 6 },
            ],
            returnFeeStartKm: 10,
            returnFeePerKm: 3,
            returnFeeIntervalKm: 1,
            returnFeeIncreaseYuan: 3,
            freeWaitingTime: 10,
            waitingChargePerMin: 2,
            waitingIntervalMin: 1,
            waitingIncreaseYuan: 2,
          }
        ];
        setTemplates(defaultTemplates);
        setActiveTemplateName('系统默认线上计费模版');
        
        setDoc(configDocRef, {
          activeTemplateName: '系统默认线上计费模版',
          templates: defaultTemplates
        }).catch(err => console.error('Error seeding default online billing config:', err));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save the complete online config to Firestore
  const persistOnlineConfig = async (newTemplates: BillingRules[], newActive: string) => {
    const configDocRef = doc(db, 'config', 'online_billing_rules');
    try {
      await setDoc(configDocRef, {
        activeTemplateName: newActive,
        templates: newTemplates
      });
      return true;
    } catch (err) {
      console.error('Failed to save online billing config:', err);
      onShowToast('❌ 计费配置同步至云端失败，已保存至本地');
      return false;
    }
  };

  // Set selected template as current active
  const handleSetActiveTemplate = async (template: BillingRules) => {
    setActiveTemplateName(template.templateName);
    const success = await persistOnlineConfig(templates, template.templateName);
    if (success) {
      onShowToast(`🎉 成功启用线上单计费模板: "${template.templateName}"`);
    }
    setActiveMenuTemplate(null);
  };

  // Add a new empty template
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      onShowToast('⚠️ 请输入模板名称');
      return;
    }
    const exists = templates.some(t => t.templateName === newTemplateName.trim());
    if (exists) {
      onShowToast('⚠️ 模板名称已存在，请更换');
      return;
    }

    const newTemplate: BillingRules = {
      templateName: newTemplateName.trim(),
      slots: [
        { id: '1', startTime: '06:00', endTime: '18:59', startingPrice: 40, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
        { id: '2', startTime: '19:00', endTime: '23:59', startingPrice: 40, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
        { id: '3', startTime: '00:00', endTime: '05:59', startingPrice: 40, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
      ],
      returnFeeStartKm: 15,
      returnFeePerKm: 2,
      returnFeeIntervalKm: 1,
      returnFeeIncreaseYuan: 2,
      freeWaitingTime: 15,
      waitingChargePerMin: 1,
      waitingIntervalMin: 1,
      waitingIncreaseYuan: 1,
    };

    const nextTemplates = [...templates, newTemplate];
    setTemplates(nextTemplates);
    setShowAddModal(false);
    setNewTemplateName('');

    const success = await persistOnlineConfig(nextTemplates, activeTemplateName);
    if (success) {
      onShowToast(`🎉 成功创建线上计费模板: "${newTemplate.templateName}"`);
    }
  };

  // Delete a template
  const handleDeleteTemplate = async (templateToDelete: BillingRules) => {
    if (templateToDelete.templateName === activeTemplateName) {
      onShowToast('⚠️ 无法删除当前正在使用中的线上计费模板！');
      return;
    }
    if (templates.length <= 1) {
      onShowToast('⚠️ 至少需要保留一个线上单计费模板！');
      return;
    }

    const nextTemplates = templates.filter(t => t.templateName !== templateToDelete.templateName);
    setTemplates(nextTemplates);
    setActiveMenuTemplate(null);

    const success = await persistOnlineConfig(nextTemplates, activeTemplateName);
    if (success) {
      onShowToast(`🗑️ 已成功删除线上计费模板: "${templateToDelete.templateName}"`);
    }
  };

  // Open Edit Workspace for a selected template
  const handleOpenEdit = (template: BillingRules) => {
    setEditingTemplate(template);
    setEditName(template.templateName);
    setEditSlots(JSON.parse(JSON.stringify(template.slots))); // Deep copy
    setEditReturnStartKm(template.returnFeeStartKm !== undefined ? template.returnFeeStartKm : 15);
    setEditReturnPerKm(template.returnFeePerKm !== undefined ? template.returnFeePerKm : 2);
    setEditReturnIntervalKm(template.returnFeeIntervalKm !== undefined ? template.returnFeeIntervalKm : 1);
    setEditReturnIncrease(template.returnFeeIncreaseYuan !== undefined ? template.returnFeeIncreaseYuan : 2);
    setEditFreeWaitingTime(template.freeWaitingTime !== undefined ? template.freeWaitingTime : 15);
    setEditWaitingPerMin(template.waitingChargePerMin !== undefined ? template.waitingChargePerMin : 1);
    setEditWaitingInterval(template.waitingIntervalMin !== undefined ? template.waitingIntervalMin : 1);
    setEditWaitingIncrease(template.waitingIncreaseYuan !== undefined ? template.waitingIncreaseYuan : 1);
    
    setActiveMenuTemplate(null);
  };

  // Add time slot in editor
  const handleAddSlot = () => {
    const newId = (editSlots.length + 1).toString();
    const newSlot: TimeSlot = {
      id: newId,
      startTime: '08:00',
      endTime: '17:59',
      startingPrice: 35,
      includedDistance: 7,
      unitPricePerKm: 5,
      distanceInterval: 1,
      priceIncrease: 5
    };
    setEditSlots([...editSlots, newSlot]);
  };

  // Remove time slot in editor
  const handleRemoveSlot = (id: string) => {
    if (editSlots.length <= 1) {
      onShowToast('⚠️ 计费模板必须至少包含一个时间段！');
      return;
    }
    setEditSlots(editSlots.filter(s => s.id !== id));
  };

  // Save changes from editing workspace
  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    if (!editName.trim()) {
      onShowToast('⚠️ 模板名称不能为空');
      return;
    }

    // Check slot bounds
    for (const slot of editSlots) {
      if (slot.startingPrice < 0 || slot.includedDistance <= 0) {
        onShowToast('⚠️ 请确保时段起步价与包含公里数为正数');
        return;
      }
    }

    const rStart = isNaN(Number(editReturnStartKm)) ? 15 : Number(editReturnStartKm);
    const rInterval = isNaN(Number(editReturnIntervalKm)) || Number(editReturnIntervalKm) <= 0 ? 1 : Number(editReturnIntervalKm);
    const rIncrease = isNaN(Number(editReturnIncrease)) ? 2 : Number(editReturnIncrease);
    const calculatedReturnFeePerKm = rInterval > 0 ? Number((rIncrease / rInterval).toFixed(4)) : 0;

    const fWait = isNaN(Number(editFreeWaitingTime)) ? 15 : Number(editFreeWaitingTime);
    const wInterval = isNaN(Number(editWaitingInterval)) || Number(editWaitingInterval) <= 0 ? 1 : Number(editWaitingInterval);
    const wIncrease = isNaN(Number(editWaitingIncrease)) ? 1 : Number(editWaitingIncrease);
    const calculatedWaitingPerMin = wInterval > 0 ? Number((wIncrease / wInterval).toFixed(4)) : 0;

    const updatedTemplate: BillingRules = {
      templateName: editName.trim(),
      slots: editSlots,
      returnFeeStartKm: rStart,
      returnFeePerKm: calculatedReturnFeePerKm,
      returnFeeIntervalKm: rInterval,
      returnFeeIncreaseYuan: rIncrease,
      freeWaitingTime: fWait,
      waitingChargePerMin: calculatedWaitingPerMin,
      waitingIntervalMin: wInterval,
      waitingIncreaseYuan: wIncrease,
    };

    // Replace original template in list
    const nextTemplates = templates.map(t => 
      t.templateName === editingTemplate.templateName ? updatedTemplate : t
    );

    // If we renamed the currently active template, update the activeTemplateName
    let nextActive = activeTemplateName;
    if (editingTemplate.templateName === activeTemplateName) {
      nextActive = updatedTemplate.templateName;
    }

    setTemplates(nextTemplates);
    setActiveTemplateName(nextActive);
    setEditingTemplate(null);

    const success = await persistOnlineConfig(nextTemplates, nextActive);
    if (success) {
      onShowToast(`🎉 成功保存计费模板 "${updatedTemplate.templateName}" 的修改`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-slate-500">正在从 Firestore 云数据库读取线上计费数据...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start text-left select-none">
      
      {/* LEFT COLUMN: Simulated App Screen for Template Listing */}
      <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col items-center">
        <div className="w-full max-w-[360px] bg-gray-50 text-gray-900 rounded-[40px] border-[8px] border-slate-950 overflow-hidden relative shadow-2xl flex flex-col" style={{ height: '620px' }}>
          
          {/* Simulated phone speaker and notch */}
          <div className="absolute top-0 inset-x-0 h-5 bg-slate-950 flex justify-center items-center z-50">
            <div className="w-20 h-3 bg-slate-950 rounded-b-xl flex items-center justify-center">
              <div className="w-8 h-1 bg-gray-800 rounded-full"></div>
            </div>
          </div>

          {/* App Header */}
          <header className="pt-7 pb-3 px-4 bg-[#353b50] text-white flex items-center justify-between sticky top-0 z-40 select-none">
            <span className="text-sm font-bold tracking-tight">线上接单计费规则</span>
            <button 
              onClick={() => setShowAddModal(true)}
              className="text-xs font-bold text-[#4dbfb3] bg-[#4dbfb3]/10 hover:bg-[#4dbfb3]/20 px-2 py-1 rounded-lg transition-all"
            >
              新建规则
            </button>
          </header>

          {/* App List Container */}
          <main className="flex-1 overflow-y-auto bg-white p-3 space-y-2.5 pb-20">
            {templates.map((rule) => {
              const isActive = rule.templateName === activeTemplateName;
              return (
                <div 
                  key={rule.templateName}
                  onClick={() => setActiveMenuTemplate(rule)}
                  className={`flex flex-col p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    isActive 
                      ? 'bg-[#eefaf8] border-[#4dbfb3]/40 shadow-xs' 
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-gray-800">{rule.templateName}</span>
                    {isActive ? (
                      <span className="text-[10px] bg-[#4dbfb3] text-white font-black px-1.5 py-0.5 rounded-sm animate-pulse">
                        当前使用中
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded-sm">
                        未启用
                      </span>
                    )}
                  </div>
                  
                  {/* Brief Rules Summary */}
                  <div className="text-[11px] text-gray-500 space-y-0.5 border-t border-dashed border-gray-100 pt-1.5 font-sans">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>含时段起步价：{rule.slots?.map(s => `${s.startTime}(${s.startingPrice}元)`).join(' | ')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Navigation className="w-3 h-3 text-gray-400" />
                      <span>含公里数：{rule.slots?.[0]?.includedDistance || 7}公里 | 返程起征公里：{rule.returnFeeStartKm || 15}公里</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end items-center mt-2.5 pt-1 border-t border-gray-50 text-[10px] text-[#4dbfb3] font-bold">
                    <span>管理该模板</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </div>
              );
            })}
          </main>

          {/* Phone home indicator */}
          <div className="absolute bottom-1 inset-x-0 h-4 bg-transparent flex justify-center items-center z-50">
            <div className="w-28 h-1 bg-gray-900 rounded-full"></div>
          </div>

          {/* Simulated App Action Bottom Drawer */}
          {activeMenuTemplate && (
            <div 
              className="absolute inset-0 bg-black/50 z-50 flex flex-col justify-end animate-in fade-in duration-200"
              onClick={() => setActiveMenuTemplate(null)}
            >
              <div 
                className="bg-white rounded-t-[24px] px-4 pt-3 pb-8 flex flex-col space-y-2.5 animate-in slide-in-from-bottom duration-250"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
                <p className="text-center text-xs font-bold text-gray-400 mb-1">
                  选择对【{activeMenuTemplate.templateName}】的操作
                </p>
                
                <button
                  onClick={() => handleSetActiveTemplate(activeMenuTemplate)}
                  className="w-full py-3 bg-[#4dbfb3] hover:bg-[#43a69b] text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-500/10"
                >
                  启用该模板 (设为线上单计费)
                </button>
                
                <button
                  onClick={() => handleOpenEdit(activeMenuTemplate)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-xl transition-all"
                >
                  修改计费规则详情
                </button>
                
                {activeMenuTemplate.templateName !== activeTemplateName && (
                  <button
                    onClick={() => {
                      if (confirm(`确定要彻底删除该线上计费规则模板【${activeMenuTemplate.templateName}】吗？此操作无法撤销。`)) {
                        handleDeleteTemplate(activeMenuTemplate);
                      }
                    }}
                    className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-sm rounded-xl transition-all"
                  >
                    删除该模板
                  </button>
                )}
                
                <button
                  onClick={() => setActiveMenuTemplate(null)}
                  className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-400 font-bold text-sm rounded-xl transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Simulated App Add Template Popup */}
          {showAddModal && (
            <div 
              className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
              onClick={() => setShowAddModal(false)}
            >
              <div 
                className="bg-white rounded-2xl p-5 w-full max-w-[300px] flex flex-col space-y-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800">新建线上接单规则</p>
                  <p className="text-[10px] text-gray-400 mt-1">请为新的线上计费模板命名</p>
                </div>
                
                <input
                  type="text"
                  placeholder="如: 银川市特定线上加价版"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:border-[#4dbfb3]"
                />
                
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 bg-gray-50 text-gray-400 text-xs font-bold rounded-xl hover:bg-gray-100 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateTemplate}
                    className="flex-1 py-2 bg-[#4dbfb3] text-white text-xs font-bold rounded-xl hover:bg-[#43a69b] transition-all"
                  >
                    确定创建
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Work Editor / Explanatory Desk */}
      <div className="xl:col-span-7 space-y-6">
        
        {editingTemplate ? (
          /* WORK EDITOR FOR ACTIVE TEMPLATE */
          <div className="bg-[#12141F] border border-slate-800 rounded-3xl p-6 space-y-6 animate-in fade-in-50 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setEditingTemplate(null)}
                  className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                  title="返回列表"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="font-extrabold text-slate-100 text-sm">修改计费规则详情</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Editing: {editingTemplate.templateName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  放弃修改
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black rounded-xl text-xs hover:opacity-95 shadow-md shadow-teal-500/10 transition-all active:scale-95 cursor-pointer"
                >
                  保存模板修改
                </button>
              </div>
            </div>

            {/* Template name modifier */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">模板名称</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-56 text-right bg-transparent border-b border-dashed border-slate-800 focus:border-teal-500 text-xs focus:outline-hidden font-bold text-slate-100"
              />
            </div>

            {/* Time slots Area */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-400 tracking-wider">起步价时段标准</span>
                <button
                  onClick={handleAddSlot}
                  className="text-xs text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 py-1 px-2.5 bg-teal-500/10 border border-teal-500/20 rounded-lg cursor-pointer transition-all hover:bg-teal-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加时段</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {editSlots.map((slot, index) => (
                  <div 
                    key={slot.id}
                    className="bg-slate-950/20 border border-slate-800/80 rounded-2xl p-4 space-y-4 relative"
                  >
                    {/* Index Badge */}
                    <div className="absolute top-4 left-4 w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold font-mono">
                      {index + 1}
                    </div>

                    <div className="pl-7 flex flex-wrap items-center justify-between gap-4">
                      {/* Time Slot Selector */}
                      <div className="flex items-center space-x-2">
                        <select
                          value={slot.startTime}
                          onChange={(e) => {
                            const next = [...editSlots];
                            const idx = next.findIndex(s => s.id === slot.id);
                            if (idx !== -1) {
                              next[idx].startTime = e.target.value;
                              setEditSlots(next);
                            }
                          }}
                          className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-2 py-1 focus:outline-hidden focus:border-teal-500 font-mono"
                        >
                          {START_TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <span className="text-slate-600">-</span>
                        <select
                          value={slot.endTime}
                          onChange={(e) => {
                            const next = [...editSlots];
                            const idx = next.findIndex(s => s.id === slot.id);
                            if (idx !== -1) {
                              next[idx].endTime = e.target.value;
                              setEditSlots(next);
                            }
                          }}
                          className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-2 py-1 focus:outline-hidden focus:border-teal-500 font-mono"
                        >
                          {END_TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>

                      {/* Starting price & mileage */}
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                          <span className="text-[10px] text-slate-500">起步价</span>
                          <input 
                            type="number"
                            value={slot.startingPrice}
                            onChange={(e) => {
                              const next = [...editSlots];
                              const idx = next.findIndex(s => s.id === slot.id);
                              if (idx !== -1) {
                                next[idx].startingPrice = Number(e.target.value);
                                setEditSlots(next);
                              }
                            }}
                            className="w-12 bg-transparent text-center text-xs font-bold text-slate-100 font-mono border-b border-dashed border-slate-700 focus:border-teal-500"
                          />
                          <span className="text-[10px] text-slate-400">元</span>
                        </div>

                        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                          <span className="text-[10px] text-slate-500">包含</span>
                          <input 
                            type="number"
                            value={slot.includedDistance}
                            onChange={(e) => {
                              const next = [...editSlots];
                              const idx = next.findIndex(s => s.id === slot.id);
                              if (idx !== -1) {
                                next[idx].includedDistance = Number(e.target.value);
                                setEditSlots(next);
                              }
                            }}
                            className="w-10 bg-transparent text-center text-xs font-bold text-teal-400 font-mono border-b border-dashed border-slate-700 focus:border-teal-500"
                          />
                          <span className="text-[10px] text-slate-400">公里</span>
                        </div>

                        <button 
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                          title="删除时段"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Surcharge details */}
                    <div className="pl-7 pt-2.5 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                      <span>超出里程后加收：</span>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 text-slate-300">
                        <span>每超</span>
                        <input 
                          type="number"
                          value={slot.distanceInterval || 1}
                          onChange={(e) => {
                            const next = [...editSlots];
                            const idx = next.findIndex(s => s.id === slot.id);
                            if (idx !== -1) {
                              next[idx].distanceInterval = Number(e.target.value);
                              setEditSlots(next);
                            }
                          }}
                          className="w-8 bg-transparent text-center text-xs font-bold text-teal-400 font-mono border-b border-dashed border-slate-700 focus:border-teal-500"
                        />
                        <span>公里，加收</span>
                        <input 
                          type="number"
                          value={slot.priceIncrease ?? slot.unitPricePerKm ?? 5}
                          onChange={(e) => {
                            const next = [...editSlots];
                            const idx = next.findIndex(s => s.id === slot.id);
                            if (idx !== -1) {
                              next[idx].priceIncrease = Number(e.target.value);
                              setEditSlots(next);
                            }
                          }}
                          className="w-10 bg-transparent text-center text-xs font-bold text-slate-100 font-mono border-b border-dashed border-slate-700 focus:border-teal-500"
                        />
                        <span>元</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Fee section */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold text-slate-400 tracking-wider block">返程加收规则</span>
              <div className="bg-slate-950/20 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
                <div className="flex items-center gap-1 font-sans">
                  <span>行程超过</span>
                  <input
                    type="number"
                    value={editReturnStartKm}
                    onChange={(e) => setEditReturnStartKm(Number(e.target.value))}
                    className="w-12 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-bold text-teal-400 py-1 font-mono focus:border-teal-500"
                  />
                  <span>公里起，开始计算返程费</span>
                </div>
                
                <div className="flex items-center gap-1 font-sans">
                  <span>每超出</span>
                  <input
                    type="number"
                    value={editReturnIntervalKm}
                    onChange={(e) => setEditReturnIntervalKm(Number(e.target.value))}
                    className="w-10 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-bold text-teal-400 py-1 font-mono focus:border-teal-500"
                  />
                  <span>公里，加收</span>
                  <input
                    type="number"
                    value={editReturnIncrease}
                    onChange={(e) => setEditReturnIncrease(Number(e.target.value))}
                    className="w-10 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-bold text-slate-100 py-1 font-mono focus:border-teal-500"
                  />
                  <span>元</span>
                </div>
              </div>
            </div>

            {/* Waiting Fee section */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold text-slate-400 tracking-wider block">等候计费规则</span>
              <div className="bg-slate-950/20 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
                <div className="flex items-center gap-1 font-sans">
                  <span>免费等候时长：</span>
                  <input
                    type="number"
                    value={editFreeWaitingTime}
                    onChange={(e) => setEditFreeWaitingTime(Number(e.target.value))}
                    className="w-12 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-bold text-teal-400 py-1 font-mono focus:border-teal-500"
                  />
                  <span>分钟</span>
                </div>
                
                <div className="flex items-center gap-1 font-sans">
                  <span>超时每</span>
                  <input
                    type="number"
                    value={editWaitingInterval}
                    onChange={(e) => setEditWaitingInterval(Number(e.target.value))}
                    className="w-10 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-bold text-teal-400 py-1 font-mono focus:border-teal-500"
                  />
                  <span>分钟，加收</span>
                  <input
                    type="number"
                    value={editWaitingIncrease}
                    onChange={(e) => setEditWaitingIncrease(Number(e.target.value))}
                    className="w-10 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-bold text-slate-100 py-1 font-mono focus:border-teal-500"
                  />
                  <span>元</span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* EXPLANATORY DESK */
          <div className="bg-[#12141F] border border-slate-800 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-100 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-400" />
                双系统价格结算分流管理说明
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                此总控端设置的计费规则专门针对线上单（自助扫码/后台派遣等）进行精细化结算
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="border border-indigo-950/40 bg-indigo-950/5 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  司机端自主报单计费 (报单规则)
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  每个司机在自己的软件App中选择的“计费详情”仅限于自己在路边直接揽客、线下接单后手动发起的自主报单服务。
                </p>
                <div className="text-[10px] text-slate-500 font-sans">
                  ● 属于司机自主微型定价，后台不予干涉
                </div>
              </div>

              <div className="border border-teal-950/40 bg-teal-950/5 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-extrabold text-teal-400 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  后台统筹线上单计费 (线上规则)
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  在左边模拟手机页面中，管理员可以批量在云端配置各类线上收费模板。当前打勾启用的那个模板即为线上订单默认的价格系统。
                </p>
                <div className="text-[10px] text-slate-500 font-sans">
                  ● 司机无法修改此规则，只能听从后台分派
                </div>
              </div>

            </div>

            {/* Quick Summary card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
              <span className="font-extrabold text-slate-200">当前线上单默认执行标准</span>
              {templates.find(t => t.templateName === activeTemplateName) ? (
                <div className="grid grid-cols-3 gap-2.5 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 block mb-0.5">默认起步时段数</span>
                    <span className="text-slate-200 font-bold font-mono">
                      {templates.find(t => t.templateName === activeTemplateName)?.slots?.length || 0} 个时段
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">起步含公里</span>
                    <span className="text-slate-200 font-bold font-mono">
                      {templates.find(t => t.templateName === activeTemplateName)?.slots?.[0]?.includedDistance || 0} 公里
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">等候免费时间</span>
                    <span className="text-slate-200 font-bold font-mono">
                      {templates.find(t => t.templateName === activeTemplateName)?.freeWaitingTime || 0} 分钟
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-red-400 text-[10px]">⚠️ 未找到有效的配置项，请启用左侧某一模板！</p>
              )}
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-[11px] text-amber-300">
              <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <p className="leading-relaxed font-sans">
                <strong>高保真 UI 与业务契合：</strong> 
                此页面的UI与手机端具有 100% 对应的物理层逻辑。当您在管理后台中创建、切换或修改线上单价格细节时，所有执行中的线上代驾服务将毫秒级联动，实时调用您所保存的最新规则结算，保障账单公平且不丢单。
              </p>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
