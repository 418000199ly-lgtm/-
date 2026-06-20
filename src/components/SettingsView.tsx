import React, { useState, useRef } from 'react';
import { X, ChevronRight, HelpCircle, RotateCcw, PlusSquare, Bookmark, Save, ImagePlus, Trash2, CheckCircle, Loader2, Crown, LogOut } from 'lucide-react';
import { ChauffeurSettings, checkVipActive } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

function cropQRCodeFromImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Downscale matching for efficiency (max 500px to keep it super fast and accurate)
        const maxDim = 500;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Step 1: Divide the image into blocks, and calculate contrast transitions
        const blockSize = 8; // Small block size for high-resolution density map
        const cols = Math.floor(width / blockSize);
        const rows = Math.floor(height / blockSize);
        const density = Array.from({ length: rows }, () => new Float32Array(cols));

        let maxDensity = 0;

        // For each block, count horizontal and vertical gradient changes
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            let transitionCount = 0;
            const startX = c * blockSize;
            const startY = r * blockSize;

            for (let y = startY; y < Math.min(height - 1, startY + blockSize); y++) {
              for (let x = startX; x < Math.min(width - 1, startX + blockSize); x++) {
                const idx1 = (y * width + x) * 4;
                const idxRight = (y * width + (x + 1)) * 4;
                const idxDown = ((y + 1) * width + x) * 4;

                const l1 = 0.299 * data[idx1] + 0.587 * data[idx1 + 1] + 0.114 * data[idx1 + 2];
                const lRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2];
                const lDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2];

                if (Math.abs(l1 - lRight) > 40) transitionCount++;
                if (Math.abs(l1 - lDown) > 40) transitionCount++;
              }
            }
            density[r][c] = transitionCount;
            if (transitionCount > maxDensity) {
              maxDensity = transitionCount;
            }
          }
        }

        // Set threshold to clear solid whitespace boundaries (e.g. 15% of maxDensity)
        const threshold = Math.max(3, maxDensity * 0.15);

        // Find connected components using high-gap bridge tolerance to bypass middle avatar logo
        const components: { cells: [number, number][]; minR: number; maxR: number; minC: number; maxC: number }[] = [];
        const visited = Array.from({ length: rows }, () => new Uint8Array(cols));

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (density[r][c] > threshold && visited[r][c] === 0) {
              const cells: [number, number][] = [];
              const queue: [number, number][] = [[r, c]];
              visited[r][c] = 1;

              let compMinR = r;
              let compMaxR = r;
              let compMinC = c;
              let compMaxC = c;

              while (queue.length > 0) {
                const curr = queue.shift()!;
                const [cr, cc] = curr;
                cells.push([cr, cc]);

                if (cr < compMinR) compMinR = cr;
                if (cr > compMaxR) compMaxR = cr;
                if (cc < compMinC) compMinC = cc;
                if (cc > compMaxC) compMaxC = cc;

                // Grab neighbors up to distance 3 (bridges gaps created by solid middle face/profile views!)
                const dist = 3;
                for (let dr = -dist; dr <= dist; dr++) {
                  for (let dc = -dist; dc <= dist; dc++) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                      if (density[nr][nc] > threshold && visited[nr][nc] === 0) {
                        visited[nr][nc] = 1;
                        queue.push([nr, nc]);
                      }
                    }
                  }
                }
              }

              components.push({
                cells,
                minR: compMinR,
                maxR: compMaxR,
                minC: compMinC,
                maxC: compMaxC,
              });
            }
          }
        }

        if (components.length === 0) {
          resolve(dataUrl);
          return;
        }

        // Sort components by cell count descending to find the main QR code block
        components.sort((a, b) => b.cells.length - a.cells.length);
        const mainComp = components[0];

        let qrMinR = mainComp.minR;
        let qrMaxR = mainComp.maxR;
        let qrMinC = mainComp.minC;
        let qrMaxC = mainComp.maxC;

        let qrX = qrMinC * blockSize;
        let qrY = qrMinR * blockSize;
        let qrW = (qrMaxC - qrMinC + 1) * blockSize;
        let qrH = (qrMaxR - qrMinR + 1) * blockSize;

        // Perfect padding: 6% of QR size for neat quiet-zone margin
        const paddingPx = Math.max(12, Math.round(Math.min(qrW, qrH) * 0.06));
        let cropX = qrX - paddingPx;
        let cropY = qrY - paddingPx;
        let cropW = qrW + paddingPx * 2;
        let cropH = qrH + paddingPx * 2;

        // Force a perfect square
        const size = Math.max(cropW, cropH);
        const cx = cropX + cropW / 2;
        const cy = cropY + cropH / 2;

        cropX = Math.round(cx - size / 2);
        cropY = Math.round(cy - size / 2);
        cropW = Math.round(size);
        cropH = Math.round(size);

        // Boundary safety clamps
        cropX = Math.max(0, cropX);
        cropY = Math.max(0, cropY);
        if (cropX + cropW > width) cropW = width - cropX;
        if (cropY + cropH > height) cropH = height - cropY;

        const finalSize = Math.min(cropW, cropH);

        // IMPORTANT DECISION: If the detected QR component already spans virtually the entire image (e.g. >= 85%),
        // then the uploaded image is ALREADY a pure, clean QR code file!
        // Running another crop on this would only slice off margins or finder patterns.
        // In this case, we simply return the pristine original image dataUrl!
        if (finalSize >= width * 0.85 && finalSize >= height * 0.85) {
          resolve(dataUrl);
          return;
        }

        // Render high-res cropped output
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = 360;
        outputCanvas.height = 360;
        const outputCtx = outputCanvas.getContext('2d');
        if (outputCtx) {
          outputCtx.imageSmoothingEnabled = true;
          outputCtx.imageSmoothingQuality = 'high';
          outputCtx.drawImage(
            img,
            (cropX / width) * img.width,
            (cropY / height) * img.height,
            (finalSize / width) * img.width,
            (finalSize / height) * img.height,
            0,
            0,
            360,
            360
          );
          resolve(outputCanvas.toDataURL('image/png'));
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        console.error('QR Crop failed, using original', err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
}

interface SettingsViewProps {
  settings: ChauffeurSettings;
  onUpdateSettings: (updated: ChauffeurSettings) => void;
  onClose: () => void;
  onNavigateToBilling: () => void;
  onLogout?: () => void;
}

export default function SettingsView({
  settings,
  onUpdateSettings,
  onClose,
  onNavigateToBilling,
  onLogout
}: SettingsViewProps) {
  // Local state for interactive settings overlays
  const [activeModal, setActiveModal] = useState<'none' | 'recharge' | 'sms_edit' | 'qr_upload' | 'deviation_slider' | 'deviation_wait_slider'>('none');
  const [rechargeInput, setRechargeInput] = useState('100');
  const [tempSmsContent, setTempSmsContent] = useState(settings.smsContent);

  const [isProcessingWechat, setIsProcessingWechat] = useState(false);
  const [isProcessingAlipay, setIsProcessingAlipay] = useState(false);

  // VIP Promo code states and logic
  const [promoCode, setPromoCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeemCode = async () => {
    const trimmed = promoCode.trim().toUpperCase();
    if (!trimmed) {
      alert('请输入有效的VIP卡本兑换码后再提交！');
      return;
    }
    setRedeeming(true);
    try {
      const docRef = doc(db, 'vip_codes', trimmed);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert('❌ 兑换失败：该兑换码不存在或已作废。\n请在右侧管理后台检查或复制并粘帖在左侧输入框内！');
        setRedeeming(false);
        return;
      }

      const codeData = docSnap.data();
      if (codeData.isRedeemed) {
        alert('❌ 兑换失败：该兑换码已被其他人或设备兑换过！');
        setRedeeming(false);
        return;
      }

      const durationDays = codeData.duration || 30;
      
      // Calculate extended expiration date
      let baseDate = new Date();
      if (settings.vipExpiry) {
        // If still valid, extend starting from current expiry
        const currentExp = new Date(settings.vipExpiry);
        if (currentExp.getTime() > baseDate.getTime()) {
          baseDate = currentExp;
        }
      }
      
      baseDate.setDate(baseDate.getDate() + durationDays);
      const yyyy = baseDate.getFullYear();
      const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
      const dd = String(baseDate.getDate()).padStart(2, '0');
      const newExpiry = `${yyyy}-${mm}-${dd}`;

      // Mark the code as redeemed in Firestore first
      await updateDoc(docRef, {
        isRedeemed: true,
        redeemedAt: new Date().toISOString(),
        redeemedBy: settings.customAppName?.trim() || '司端一体化用户'
      });

      // Update client settings
      onUpdateSettings({
        ...settings,
        vipExpiry: newExpiry
      });

      setPromoCode('');
      alert(`🎉 恭喜您！兑换成功！已为您成功激活并延长 ${durationDays} 天会员特权。\n当前VIP有效期至：${newExpiry}`);
    } catch (e: any) {
      console.error(e);
      alert('兑换库发生不可预知的连接故障: ' + e.message);
    } finally {
      setRedeeming(false);
    }
  };

  const wechatInputRef = useRef<HTMLInputElement>(null);
  const alipayInputRef = useRef<HTMLInputElement>(null);

  const handleWechatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingWechat(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const croppedBase64 = await cropQRCodeFromImage(reader.result as string);
        onUpdateSettings({ ...settings, wechatQrCode: croppedBase64 });
        setIsProcessingWechat(false);
      };
      reader.onerror = () => setIsProcessingWechat(false);
      reader.readAsDataURL(file);
    }
  };

  const handleAlipayFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingAlipay(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const croppedBase64 = await cropQRCodeFromImage(reader.result as string);
        onUpdateSettings({ ...settings, alipayQrCode: croppedBase64 });
        setIsProcessingAlipay(false);
      };
      reader.onerror = () => setIsProcessingAlipay(false);
      reader.readAsDataURL(file);
    }
  };

  const toggleVoiceBroadcast = () => {
    const next = settings.voiceBroadcast === '开单语音播报' ? '静音播报' : '开单语音播报';
    onUpdateSettings({ ...settings, voiceBroadcast: next });
  };

  const handleRechargeSubmit = () => {
    const amount = Number(rechargeInput) || 0;
    if (amount <= 0) {
      alert('请输入有效的充值金额！');
      return;
    }
    onUpdateSettings({ 
      ...settings, 
      accountBalance: Number((settings.accountBalance + amount).toFixed(2)) 
    });
    setActiveModal('none');
    alert(`成功充值 ¥${amount.toFixed(2)} 元！您的代驾账户可用余额已更新。`);
  };

  const handleSmsSave = () => {
    onUpdateSettings({ ...settings, smsContent: tempSmsContent });
    setActiveModal('none');
  };

  const cycleHomepageColor = () => {
    const colors: ('green' | 'blue' | 'slate')[] = ['green', 'blue', 'slate'];
    const currentIdx = colors.indexOf(settings.homepageColorway);
    const nextIdx = (currentIdx + 1) % colors.length;
    onUpdateSettings({ ...settings, homepageColorway: colors[nextIdx] });
  };

  const cycleDeviationKm = () => {
    const options = [0.5, 1.0, 1.5, 2.0];
    const currentIdx = options.indexOf(settings.deviationKm);
    const nextIdx = (currentIdx + 1) % options.length;
    onUpdateSettings({ ...settings, deviationKm: options[nextIdx] });
  };

  const cycleDeviationWaitSec = () => {
    const options = [10, 30, 45, 60, 120];
    const currentIdx = options.indexOf(settings.deviationWaitSec);
    const nextIdx = (currentIdx + 1) % options.length;
    onUpdateSettings({ ...settings, deviationWaitSec: options[nextIdx] });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 select-none overflow-hidden relative">
      
      {/* 1. Top navigation */}
      <div className="bg-[#273046] h-14 min-h-14 flex items-center justify-between px-4 text-white shadow-md z-10">
        <button 
          onClick={onClose}
          className="p-1 px-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
        >
          <X className="w-5 h-5 text-gray-100" />
        </button>
        <span className="font-semibold text-base tracking-wide text-center flex-1 pr-6 text-gray-100">代驾设置</span>
        <button 
          onClick={() => setActiveModal('qr_upload')}
          className="text-xs text-teal-300 font-semibold hover:text-teal-400 active:scale-95 transition-all text-emerald-400 font-bold"
        >
          上传收款码
        </button>
      </div>

      {/* Settings list scrolling area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Card 1: Billing and broadcast (Screenshot 5 first block) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
          
          {/* Rules block */}
          <button 
            onClick={onNavigateToBilling}
            className="w-full py-4 px-4 flex items-center justify-between hover:bg-gray-50 bg-white transition-colors text-left"
          >
            <span className="text-sm font-semibold text-gray-700">计费规则</span>
            <div className="flex items-center space-x-1 text-gray-400">
              <span className="text-xs text-gray-500 font-mono font-bold mr-0.5">{settings.billingTemplateName}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </button>

          {/* Voice broadcast changer */}
          <button 
            onClick={toggleVoiceBroadcast}
            className="w-full py-4 px-4 flex items-center justify-between hover:bg-gray-50 bg-white transition-colors text-left"
          >
            <span className="text-sm font-semibold text-gray-700">语音播报</span>
            <div className="flex items-center space-x-1 text-teal-600 font-semibold">
              <span className="text-xs">{settings.voiceBroadcast}</span>
              <ChevronRight className="w-4 h-4 text-teal-400" />
            </div>
          </button>

        </div>

        {/* Card 2: Account details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
          
          {/* Funds Balance */}
          <button 
            disabled
            className="w-full py-4 px-4 flex items-center justify-between bg-white text-left cursor-default"
          >
            <span className="text-sm font-semibold text-gray-700">账户余额</span>
            <div className="flex items-center space-x-1 text-emerald-600 font-mono font-bold">
              <span>¥888.00</span>
            </div>
          </button>

          {/* VIP Membership Status */}
          <div className="py-4 px-4 flex items-center justify-between bg-white">
            <span className="text-sm font-semibold text-gray-700">VIP会员状态</span>
            {settings.vipExpiry ? (
              <div className="flex items-center space-x-1.5 text-amber-600 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <Crown className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>已激活VIP {settings.vipExpiry && `(${settings.vipExpiry})`}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-slate-400 font-medium text-xs bg-slate-50 px-2.5 py-1 rounded-lg">
                <span>未激活 VIP</span>
              </div>
            )}
          </div>

          {/* VIP Exchange/Promo Code Entry */}
          <div className="py-4.5 px-4 bg-slate-50/70 flex flex-col gap-2.5">
            <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 tracking-wider leading-none">
              🔐 会员卡卡密兑换通道
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="请输入VIP卡密/兑换码"
                disabled={redeeming}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-black focus:outline-hidden focus:border-[#1da39b] bg-white text-gray-800 disabled:bg-slate-50 placeholder:text-gray-400 font-mono tracking-wider shrink-0"
              />
              <button
                type="button"
                onClick={handleRedeemCode}
                disabled={redeeming}
                className="px-4 bg-[#1da39b] hover:bg-[#188e87] active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shrink-0 flex items-center justify-center min-w-[76px] cursor-pointer"
              >
                {redeeming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '立即激活'
                )}
              </button>
            </div>
            <p className="text-[9px] text-gray-400 leading-normal font-sans font-medium">
              说明：在右方管理后台中可以直接“生成卡码”，将其复制并在此输入，即可秒级安全互通激活您的VIP！
            </p>
          </div>

        </div>

        {/* Card 3: Calibration */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
          
          {/* Toggle physical calibration mode */}
          <div className="py-4 px-4 flex items-center justify-between bg-white">
            <div className="space-y-0.5 max-w-[210px]">
              <div className="text-sm font-semibold text-gray-700">纠偏功能</div>
              <div className="text-[10px] text-gray-400 leading-normal">双击行驶中行程界面任意区域可极速纠偏公里和等候耗时</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.deviationMitigation && checkVipActive(settings.vipExpiry)}
                onChange={(e) => {
                  if (!checkVipActive(settings.vipExpiry)) {
                    alert('🔒 提示：纠偏功能为VIP会员专属特权！请先激活VIP。');
                    return;
                  }
                  onUpdateSettings({ ...settings, deviationMitigation: e.target.checked });
                }}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1da39b]"></div>
            </label>
          </div>

          {/* Deviation added per calibrator */}
          {settings.deviationMitigation && (
            <button 
              onClick={() => setActiveModal('deviation_slider')}
              className="w-full py-4 px-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-sm font-semibold text-gray-700">每次纠偏的公里数</span>
              <div className="flex items-center space-x-1 text-gray-500 font-semibold text-xs font-mono">
                <span>每次{settings.deviationKm}公里</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          )}

          {/* Waiting added per calibrator */}
          {settings.deviationMitigation && (
            <button 
              onClick={() => setActiveModal('deviation_wait_slider')}
              className="w-full py-4 px-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700">每次纠偏的等候时间</span>
                <span className="text-[11px] text-amber-500 font-medium mt-0.5">温馨提示：建议设置0-3秒</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-500 font-semibold text-xs font-mono">
                <span>每次{settings.deviationWaitSec}秒</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          )}

        </div>

        {/* Card 4: Session Security (Logout) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <button
            onClick={() => {
              if (window.confirm('您确定要退出当前手机终端会话，并返回短信验证登录页面吗？')) {
                onLogout?.();
              }
            }}
            className="w-full py-4 px-4 flex items-center justify-center space-x-2 hover:bg-rose-50 hover:text-rose-600 bg-white text-rose-500 font-bold text-sm transition-all text-center"
          >
            <LogOut className="w-4 h-4" />
            <span>安全退出手机登录会话</span>
          </button>
        </div>

      </div>

      {/* SUB-DIALOG: Recharge overlay (Pure interactive element) */}
      {activeModal === 'recharge' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50">
          <div className="bg-white rounded-3xl w-full max-w-[320px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#273046] text-white py-4 px-5 flex items-center justify-between">
              <span className="font-bold text-sm">司机账户钱包充值</span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setActiveModal('none')} />
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400">目前模拟充值资金，充值后可供抵扣日常信息垫付费用支出。</p>
              
              <div className="flex items-center bg-slate-50 border border-gray-200 rounded-xl p-3 shadow-inner">
                <span className="text-md font-bold text-[#1da39b] mr-2">¥</span>
                <input
                  type="number"
                  placeholder="金额"
                  value={rechargeInput}
                  onChange={(e) => setRechargeInput(e.target.value)}
                  className="w-full bg-transparent font-mono text-lg font-bold text-gray-800 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['50', '100', '300'].map(val => (
                  <button
                    key={val}
                    onClick={() => setRechargeInput(val)}
                    className={`py-2 rounded-xl text-xs font-semibold border ${
                      rechargeInput === val ? 'bg-teal-50 border-[#1da39b] text-teal-600' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    ¥{val} 元
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 flex gap-3 border-t border-gray-100">
              <button 
                onClick={() => setActiveModal('none')}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-semibold"
              >
                取消
              </button>
              <button 
                onClick={handleRechargeSubmit}
                className="flex-1 py-2.5 bg-[#1da39b] text-white rounded-xl text-xs font-semibold shadow-md"
              >
                确认充值
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-DIALOG: SMS Text Template Editor (Pure interactive element) */}
      {activeModal === 'sms_edit' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[340px] shadow-2xl overflow-hidden">
            <div className="bg-[#273046] text-white py-4 px-5 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center space-x-1">
                <Bookmark className="w-4 h-4" />
                <span>自动客服短信内容</span>
              </span>
              <X className="w-4 h-4 cursor-pointer" onClick={() => setActiveModal('none')} />
            </div>
            <div className="p-5 space-y-3">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">编辑提醒短信模版</label>
              <textarea
                value={tempSmsContent}
                onChange={(e) => setTempSmsContent(e.target.value)}
                rows={5}
                className="w-full p-3 border border-gray-200 focus:border-teal-500 text-xs rounded-xl focus:outline-hidden leading-relaxed text-gray-700 bg-slate-50 font-sans"
              />
              <span className="text-[10px] text-gray-400 leading-normal block">
                自动发送场景：代驾司机点单后（开始服务）或收款后（行程结账），将配合网关秒级投递至乘客登记手机上。
              </span>
            </div>
            
            <div className="p-4 bg-slate-50 flex gap-3 border-t border-gray-100">
              <button 
                onClick={() => setActiveModal('none')}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-semibold"
              >
                取消
              </button>
              <button 
                onClick={handleSmsSave}
                className="flex-1 py-2.5 bg-[#1da39b] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 shadow-md hover:bg-teal-600 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>保存模板</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-DIALOG: QR CODE UPLOAD MODAL */}
      {activeModal === 'qr_upload' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[340px] shadow-2xl overflow-hidden text-left">
            <div className="bg-[#273046] text-white py-4 px-5 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center space-x-1.5">
                <ImagePlus className="w-4 h-4 text-teal-300" />
                <span>授权微信/支付宝收款码</span>
              </span>
              <X className="w-4 h-4 cursor-pointer text-gray-300 hover:text-white" onClick={() => setActiveModal('none')} />
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-gray-400 leading-normal">
                上传您的个人收款二维码。绑定成功后，乘客行程结账时扫码将直接展示您绑定的本专属渠道收款码。
              </p>

              {/* Hidden File Inputs */}
              <input 
                type="file" 
                ref={wechatInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleWechatFileChange} 
              />
              <input 
                type="file" 
                ref={alipayInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleAlipayFileChange} 
              />

              {/* WeChat QR Row */}
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-3.5 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                      微
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 font-sans">微信收款码</h4>
                      <p className="text-[10px] text-gray-400 font-sans">
                        {isProcessingWechat ? '正在自动智能识别并裁剪...' : settings.wechatQrCode ? '已绑定/智能自动裁剪' : '未绑定'}
                      </p>
                    </div>
                  </div>
                  {isProcessingWechat ? (
                    <div className="flex items-center justify-center w-8 h-8">
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    </div>
                  ) : settings.wechatQrCode ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-md overflow-hidden border border-emerald-250 bg-white shadow-xs">
                        <img src={settings.wechatQrCode} alt="Wechat QR" className="w-full h-full object-cover" />
                      </div>
                      <button 
                        onClick={() => onUpdateSettings({ ...settings, wechatQrCode: '' })}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100/60 px-2 py-0.5 rounded-full font-sans">未上传</span>
                  )}
                </div>

                <button
                  disabled={isProcessingWechat}
                  onClick={() => wechatInputRef.current?.click()}
                  className="w-full py-2 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingWechat ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                      <span className="font-sans">AI 裁剪中...</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-sans">{settings.wechatQrCode ? '重新上传(自动智能裁剪)' : '上传收款码(自动智能裁剪)'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Alipay QR Row */}
              <div className="bg-sky-50/30 border border-sky-100 rounded-2xl p-3.5 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                      支
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 font-sans">支付宝收款码</h4>
                      <p className="text-[10px] text-gray-400 font-sans">
                        {isProcessingAlipay ? '正在自动智能识别并裁剪...' : settings.alipayQrCode ? '已绑定/智能自动裁剪' : '未绑定'}
                      </p>
                    </div>
                  </div>
                  {isProcessingAlipay ? (
                    <div className="flex items-center justify-center w-8 h-8">
                      <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
                    </div>
                  ) : settings.alipayQrCode ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-md overflow-hidden border border-sky-250 bg-white shadow-xs">
                        <img src={settings.alipayQrCode} alt="Alipay QR" className="w-full h-full object-cover" />
                      </div>
                      <button 
                        onClick={() => onUpdateSettings({ ...settings, alipayQrCode: '' })}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-sky-600 font-bold bg-sky-100/60 px-2 py-0.5 rounded-full font-sans">未上传</span>
                  )}
                </div>

                <button
                  disabled={isProcessingAlipay}
                  onClick={() => alipayInputRef.current?.click()}
                  className="w-full py-2 bg-white hover:bg-sky-50 border border-sky-200 text-sky-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAlipay ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                      <span className="font-sans">AI 裁剪中...</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-sans">{settings.alipayQrCode ? '重新上传(自动智能裁剪)' : '上传收款码(自动智能裁剪)'}</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            <div className="p-4 bg-slate-50 flex gap-2 border-t border-gray-100">
              <button 
                onClick={() => setActiveModal('none')}
                className="w-full py-2.5 bg-[#273046] hover:bg-[#1f2638] text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-md"
              >
                保存设置并返回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-DIALOG: DEVIATION SLIDER */}
      {activeModal === 'deviation_slider' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[320px] shadow-2xl overflow-hidden text-left">
            <div className="bg-[#273046] text-white py-4 px-5 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center space-x-1.5">
                <Bookmark className="w-4 h-4 text-teal-300" />
                <span>纠偏每次加减的公里数</span>
              </span>
              <X className="w-4 h-4 cursor-pointer text-gray-300 hover:text-white" onClick={() => setActiveModal('none')} />
            </div>
            
            <div className="p-6 space-y-6">
              <div className="text-center">
                <span className="text-sm text-gray-400 block mb-1">偏差值设定 (0 - 10 公里)</span>
                <span className="text-4xl font-extrabold text-[#1da39b] font-mono">
                  {settings.deviationKm.toFixed(1)} <span className="text-base font-medium text-gray-500 font-sans">公里</span>
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={settings.deviationKm}
                  onChange={(e) => onUpdateSettings({ ...settings, deviationKm: parseFloat(e.target.value) })}
                  className="w-full accent-[#1da39b] h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer border border-gray-200"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>0.0 km</span>
                  <span>2.5 km</span>
                  <span>5.0 km</span>
                  <span>7.5 km</span>
                  <span>10.0 km</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-normal text-center bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                调整时将以该公里数为单位进行每次增减，并在双击极速纠偏中直接追加。费用将根据此变动自动重算。
              </p>
            </div>

            <div className="p-4 bg-slate-50 flex gap-2 border-t border-gray-100">
              <button 
                onClick={() => setActiveModal('none')}
                className="w-full py-2.5 bg-[#1da39b] hover:bg-teal-600 text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-md flex items-center justify-center space-x-1"
              >
                <CheckCircle className="w-4 h-4" />
                <span>确认设置</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-DIALOG: DEVIATION WAIT SLIDER */}
      {activeModal === 'deviation_wait_slider' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[320px] shadow-2xl overflow-hidden text-left">
            <div className="bg-[#273046] text-white py-4 px-5 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center space-x-1.5">
                <Bookmark className="w-4 h-4 text-teal-300" />
                <span>纠偏每次加减的的等候时间</span>
              </span>
              <X className="w-4 h-4 cursor-pointer text-gray-300 hover:text-white" onClick={() => setActiveModal('none')} />
            </div>
            
            <div className="p-6 space-y-6">
              <div className="text-center">
                <span className="text-sm text-gray-400 block mb-1">等候耗时设定 (0 - 60 秒)</span>
                <span className="text-4xl font-extrabold text-[#1da39b] font-mono">
                  {settings.deviationWaitSec} <span className="text-base font-medium text-gray-500 font-sans">秒</span>
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={settings.deviationWaitSec}
                  onChange={(e) => onUpdateSettings({ ...settings, deviationWaitSec: parseInt(e.target.value, 10) || 0 })}
                  className="w-full accent-[#1da39b] h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer border border-gray-200"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>0 秒</span>
                  <span>15 秒</span>
                  <span>30 秒</span>
                  <span>45 秒</span>
                  <span>60 秒</span>
                </div>
                <div className="text-center pt-2">
                  <span className="text-[11px] text-amber-500 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 inline-block animate-pulse">
                    温馨提示：建议设置 0-3 秒
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-normal text-center bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                调整时将以该秒数为单位进行每次增减。费用将根据此等候变动自动重算。
              </p>
            </div>

            <div className="p-4 bg-slate-50 flex gap-2 border-t border-gray-100">
              <button 
                onClick={() => setActiveModal('none')}
                className="w-full py-2.5 bg-[#1da39b] hover:bg-teal-600 text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-md flex items-center justify-center space-x-1"
              >
                <CheckCircle className="w-4 h-4" />
                <span>确认设置</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
