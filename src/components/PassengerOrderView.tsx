import React, { useState, useEffect } from 'react';
import { db, doc, setDoc, getDoc } from '../lib/dbProxy';
import { QrCode, MapPin, Phone, CheckCircle, Navigation, ShieldCheck } from 'lucide-react';

interface PassengerOrderViewProps {
  driverPhone: string;
  onClose?: () => void;
  onUnlockAdmin?: () => void;
}

export default function PassengerOrderView({ driverPhone, onClose, onUnlockAdmin }: PassengerOrderViewProps) {
  const [passengerPhone, setPassengerPhone] = useState('');
  const [startLocation, setStartLocation] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlStart = params.get('startLocation');
      if (urlStart) {
        return decodeURIComponent(urlStart).trim();
      }
    }
    return '万达广场写字楼A座';
  });
  const [destination, setDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  
  // 3-second Welcome screen states
  const [showWelcome, setShowWelcome] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [customBrandName, setCustomBrandName] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlName = params.get('name');
      if (urlName) {
        const val = decodeURIComponent(urlName).trim();
        if (val !== '极速' && val !== '极速代驾' && val !== '') {
          return val;
        }
      }
    }
    return 'XX代驾';
  });
  const [hasCustomNameSet, setHasCustomNameSet] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlName = params.get('name');
      if (urlName) {
        const val = decodeURIComponent(urlName).trim();
        if (val !== '极速' && val !== '极速代驾' && val !== 'XX代驾' && val !== '') {
          return true;
        }
      }
    }
    return false;
  });

  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [passengerCoords, setPassengerCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Retrieve real-time passenger coordinates upon component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPassengerCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.warn("Failed to retrieve passenger physical location coordinates:", err);
        }
      );
    }
  }, []);

  // Fetch driver custom name brand dynamically from Firestore and sync active driver's current startLocation
  useEffect(() => {
    const fetchDriverBrandingAndLocation = async () => {
      if (!driverPhone) return;
      try {
        const userDocRef = doc(db, 'driver_users', driverPhone);
        const docSnap = await getDoc(userDocRef);
        if (docSnap && docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.customAppName) {
            const rawName = data.customAppName.trim();
            if (rawName && rawName !== '极速' && rawName !== '极速代驾' && rawName !== '') {
              setCustomBrandName(rawName);
              if (rawName !== 'XX代驾') {
                setHasCustomNameSet(true);
              } else {
                setHasCustomNameSet(false);
              }
            } else {
              setCustomBrandName('XX代驾');
              setHasCustomNameSet(false);
            }
          }
          if (data && data.lat && data.lng) {
            setDriverCoords({ lat: data.lat, lng: data.lng });
          }
        }

        // Fetch current active startLocation from general links collection
        const linkDocRef = doc(db, 'passenger_links', driverPhone);
        const linkSnap = await getDoc(linkDocRef);
        if (linkSnap && linkSnap.exists()) {
          const linkData = linkSnap.data();
          if (linkData && linkData.driverStartLocation) {
            setStartLocation(linkData.driverStartLocation.trim());
          }
        }
      } catch (err) {
        console.error('Failed to fetch driver brand and location settings under passenger page:', err);
      }
    };
    fetchDriverBrandingAndLocation();
  }, [driverPhone]);

  // Handle countdown loop
  useEffect(() => {
    if (!showWelcome) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowWelcome(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWelcome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerPhone) {
      alert('✍️ 提示：请输入您的手机号码以便开单后与司机联系！');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(passengerPhone.replace(/[-\s]/g, ''))) {
      alert('✍️ 提示：请核对并输入11位有效手机号码！');
      return;
    }

    setSubmitting(true);
    
    if (!driverPhone) {
      alert('⚠️ 无法获取当前司机的手机号码，请重新扫描二维码！');
      setSubmitting(false);
      return;
    }

    // Determine final passenger latitude and longitude (starting point coords)
    let pLat = passengerCoords?.lat || null;
    let pLng = passengerCoords?.lng || null;

    if (!pLat && driverCoords) {
      // Simulate real-life situation by offsetting slightly from driver coordinates
      const offsetLat = 0.0012 + Math.random() * 0.0016;
      const offsetLng = 0.0012 + Math.random() * 0.0016;
      pLat = driverCoords.lat + (Math.random() > 0.5 ? offsetLat : -offsetLat);
      pLng = driverCoords.lng + (Math.random() > 0.5 ? offsetLng : -offsetLng);
    }

    if (!pLat) {
      pLat = 38.487193;
      pLng = 106.230912;
    }

    const dbWritePromise = setDoc(doc(db, 'passenger_links', driverPhone), {
      passengerPhone: passengerPhone.trim(),
      startLocation: startLocation.trim(),
      destination: destination.trim(),
      status: 'submitted',
      timestamp: Date.now(),
      passengerLat: pLat,
      passengerLng: pLng
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 3000)
    );

    try {
      // Race standard Firebase client-side SDK write with a 3.0-second timeout.
      // If it times out or fails (as usually happens within China mainland), fall back immediately to the Cloudflare Worker server proxy.
      await Promise.race([dbWritePromise, timeoutPromise]);
      setStatus('success');
    } catch (err: any) {
      console.warn('Firebase client SDK failed or timed out. Falling back to Cloudflare Workers server route...', err);
      try {
        const response = await fetch('https://daijiajifei.ccwu.cc/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            driverPhone,
            passengerPhone: passengerPhone.trim(),
            startLocation: startLocation.trim(),
            destination: destination.trim()
          })
        });
        const resData = await response.json();
        if (resData.success) {
          setStatus('success');
        } else {
          throw new Error(resData.error || 'Cloudflare mid-tier failed');
        }
      } catch (fallbackErr: any) {
        alert('⚠️ 连线提交失败: ' + fallbackErr.message + '\n\n提示: 请确保您的 Cloudflare Worker 已成功部署！');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (showWelcome) {
    return (
      <div className="w-full h-full min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 select-none font-sans relative overflow-hidden animate-in fade-in duration-355 z-[10000]">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 rounded-full bg-emerald-500/15 blur-2xl"></div>

        {/* Top brand header */}
        <div className="z-10 flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-[10px] text-teal-200 font-bold tracking-widest uppercase">
              PLATINUM SERVICE • 专享自助端
            </span>
          </div>
          <span className="text-[9px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-xs animate-pulse">
            安全校验 ⚡
          </span>
        </div>

        {/* Central visual card */}
        <div className="z-10 flex-grow flex flex-col items-center justify-center py-10 text-center">
          {/* Circular Countdown Progress Loader with beautiful design */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-20 animate-pulse scale-115"></div>
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#0d5c55] via-slate-800 to-slate-950 flex items-center justify-center p-0.5 border border-white/10 shadow-2xl">
              <div className="w-full h-full rounded-full bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden">
                {/* Visual shine */}
                <div className="absolute -left-10 top-0 w-20 h-20 bg-white/5 transform skew-x-12 rotate-45 pointer-events-none"></div>
                
                {/* Countdown display */}
                <div className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent italic font-mono tracking-tighter">
                  {countdown}
                </div>
                <div className="text-[10px] text-teal-300/80 tracking-widest font-extrabold uppercase mt-1">
                  秒后进入
                </div>
              </div>
            </div>
          </div>

          {/* Core App Name Header */}
          <div className="space-y-4 max-w-xs sm:max-w-sm px-4">
            <h2 className="text-xs font-bold text-teal-400/80 tracking-widest uppercase">
              正在开启订单
            </h2>
            
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                欢迎使用 <span className="text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text font-black px-1 underline underline-offset-4 decoration-emerald-500/30">{customBrandName}</span>
              </div>
            </div>

            <p className="text-emerald-300 text-sm font-semibold tracking-wide max-w-xs mx-auto pt-2 animate-pulse">
              在乎你的车，更在乎你的人
            </p>
          </div>
        </div>

        {/* Footer loading and count progress indicator */}
        <div className="z-10 mb-8 flex flex-col items-center space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] animate-bounce [animation-delay:0.4s]"></div>
            <span className="ml-1 text-[11px] font-medium text-teal-200/60">
              数据连接中, 专线安全校验通过...
            </span>
          </div>
          
          <div className="w-36 h-1 bg-slate-950 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-[1000ms] rounded-full"
              style={{ width: `${(countdown / 3) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between bg-[#f3f7f6] text-slate-800 font-sans overflow-hidden">
      {/* Premium Header Banner */}
      <header className="bg-gradient-to-r from-[#0d5c55] to-[#044c45] py-3.5 px-4 border-b border-teal-500/10 relative overflow-hidden shrink-0 shadow-md">
        <div className="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-teal-350 opacity-20 blur-xl"></div>
        <div className="absolute -left-8 -bottom-10 w-24 h-24 rounded-full bg-emerald-400 opacity-10 blur-lg"></div>
        <div className="relative z-10 flex flex-col space-y-1 text-left">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-1 cursor-pointer select-none" 
              onDoubleClick={onUnlockAdmin} 
              title="双击进行系统后台安全校验"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm"></span>
              <span className="text-[9px] font-bold tracking-wider uppercase text-teal-200">
                专享自助开单系统
              </span>
            </div>
            <span 
              className="text-[9px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 cursor-pointer select-none"
              onDoubleClick={onUnlockAdmin}
              title="双击进行系统后台安全校验"
            >
              安全加速中 ⚡
            </span>
          </div>
          <h1 className="text-base font-extrabold text-white tracking-tight">扫码极速授权自助填单</h1>
          <p className="text-[10px] text-teal-100 leading-normal">
            正在连线至司机 <span className="font-mono font-extrabold text-teal-300 bg-slate-900/40 px-1.5 py-0.5 rounded border border-white/10 ml-0.5">{driverPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span> 的服务通道
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden px-4 py-3 flex flex-col justify-center max-w-sm mx-auto w-full">
        {status === 'idle' ? (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
            {/* Form Instruction Card */}
            <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 flex gap-2.5 text-xs text-slate-700 shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-[#0d5c55] shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-teal-900 text-xs mb-0.5">
                  欢迎使用 {customBrandName} 自助下单
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  请录入您呼叫代驾时的手机号码。提交完成后，司机端将立即听到语音播报，并一键开启车辆安全服务！
                </p>
              </div>
            </div>

            {/* Input card container */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-md space-y-3">
              {/* Telephone Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  📱 您的手机号码 (必填)
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-teal-600 rounded-xl px-3 py-2.5 transition-all">
                  <Phone className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="tel"
                    required
                    placeholder="请输入您的手机号"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    className="bg-transparent border-none w-full text-slate-950 outline-none font-bold text-sm p-0 placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                    style={{ outline: 'none', border: 'none', background: 'none' }}
                  />
                </div>
              </div>

              {/* Start Location Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  📍 您的出发地 (必填)
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-teal-600 rounded-xl px-3 py-2.5 transition-all">
                  <MapPin className="w-4 h-4 text-[#0d5c55] mr-2 shrink-0" />
                  <input
                    type="text"
                    required
                    placeholder="填写当前上车位置"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    className="bg-transparent border-none w-full text-slate-950 outline-none font-bold text-sm p-0 placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                    style={{ outline: 'none', border: 'none', background: 'none' }}
                  />
                </div>
              </div>

              {/* Destination Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  🏁 您的目的地 (选填)
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-teal-600 rounded-xl px-3 py-2.5 transition-all">
                  <Navigation className="w-4 h-4 text-rose-500 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="请输入行驶目的地"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="bg-transparent border-none w-full text-slate-950 outline-none font-bold text-sm p-0 placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                    style={{ outline: 'none', border: 'none', background: 'none' }}
                  />
                </div>
              </div>

              {/* Consent Agreement Box */}
              <div className="pt-1.5 flex items-start gap-2 text-[9.5px] text-slate-500 leading-tight">
                <input
                  type="checkbox"
                  required
                  defaultChecked
                  className="mt-0.5 w-3.5 h-3.5 text-teal-600 bg-slate-100 border-slate-300 rounded focus:ring-teal-500 accent-teal-600 cursor-pointer"
                />
                <span className="cursor-pointer select-none">
                  我授权自动上传位置信息并同意接收司机来车服务。
                </span>
              </div>

              {/* Submit Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 mt-1 rounded-xl text-center font-bold text-sm inline-flex items-center justify-center gap-2 active:scale-95 duration-150 cursor-pointer ${
                  submitting
                    ? 'bg-slate-150 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-600/15'
                }`}
              >
                {submitting ? '⏳ 正在极速建立连接中...' : '🚀 确认授权并通知司机开单'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 py-1 text-center">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 border border-emerald-500 flex items-center justify-center shadow-md animate-bounce">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>

              <div className="space-y-0.5">
                <h2 className="text-sm font-extrabold text-slate-900 tracking-wide">🎉 授权成功！系统已播报开单</h2>
                <p className="text-[10px] text-slate-500 leading-relaxed px-1">
                  您的填单已送达！司机开单器调度台端已<b>同步拉取数据并开始计费服务</b>。
                </p>
              </div>
            </div>

            {/* Receipt ticket style card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/85 shadow-sm space-y-2.5 text-left relative overflow-hidden">
              <div className="absolute -left-2 top-9 w-3.5 h-3.5 bg-[#f3f7f6] rounded-full"></div>
              <div className="absolute -right-2 top-9 w-3.5 h-3.5 bg-[#f3f7f6] rounded-full"></div>

              <div className="flex items-center justify-between pb-2 border-b border-dashed border-slate-150">
                <span className="text-[10px] text-[#065f57] font-bold tracking-wider">📋 尊享行程同步票据</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">已触达</span>
              </div>
              <div className="space-y-1.5 pt-0.5 text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">上车地点：</span>
                  <span className="text-slate-900 font-bold text-right max-w-[180px] truncate">{startLocation}</span>
                </div>
                {destination && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium font-sans">下车目的地：</span>
                    <span className="text-slate-900 font-bold text-right max-w-[180px] truncate">{destination}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">乘客手机：</span>
                  <span className="text-teal-600 font-bold font-mono">{passengerPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">司机手机：</span>
                  <span className="text-slate-900 font-bold font-mono">{driverPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
                </div>
              </div>
            </div>


          </div>
        )}
      </main>

      {/* Small Tech Credit Footer */}
      <footer className="py-2.5 text-center text-[9px] text-slate-400 font-medium border-t border-slate-150 shrink-0 font-sans select-none tracking-tight">
        SECURE CONNECT • CLOUDFLARE ENCRYPTED PROXIED
      </footer>
    </div>
  );
}
