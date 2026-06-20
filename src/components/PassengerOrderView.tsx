import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { QrCode, MapPin, Phone, CheckCircle, Navigation, ShieldCheck } from 'lucide-react';

interface PassengerOrderViewProps {
  driverPhone: string;
  onClose?: () => void;
}

export default function PassengerOrderView({ driverPhone, onClose }: PassengerOrderViewProps) {
  const [passengerPhone, setPassengerPhone] = useState('');
  const [startLocation, setStartLocation] = useState('万达广场写字楼A座');
  const [destination, setDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

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
    
    const dbWritePromise = setDoc(doc(db, 'passenger_links', driverPhone), {
      passengerPhone: passengerPhone.trim(),
      startLocation: startLocation.trim(),
      destination: destination.trim(),
      status: 'submitted',
      timestamp: Date.now()
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

  return (
    <div className="w-full h-full min-h-screen bg-[#f3f7f6] text-slate-800 flex flex-col justify-between font-sans">
      {/* Premium Header Banner */}
      <header className="bg-gradient-to-r from-[#0d5c55] to-[#044c45] p-5 border-b border-teal-500/10 relative overflow-hidden shrink-0 shadow-md">
        <div className="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-teal-350 opacity-20 blur-xl"></div>
        <div className="absolute -left-8 -bottom-10 w-24 h-24 rounded-full bg-emerald-400 opacity-10 blur-lg"></div>
        <div className="relative z-10 flex flex-col space-y-1.5 text-left">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm"></span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-teal-200">
              自助呼叫 • 安全专线 (乘客端)
            </span>
          </div>
          <h1 className="text-lg font-extrabold text-white tracking-tight">扫码极速授权自助填单</h1>
          <p className="text-[11px] text-teal-100 leading-normal">
            正在连线至司机 <span className="font-mono font-extrabold text-teal-300 bg-slate-900/40 px-1.5 py-0.5 rounded border border-white/10 ml-0.5">{driverPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span> 的开单服务中
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto px-5 py-6 flex flex-col justify-center max-w-md mx-auto w-full">
        {status === 'idle' ? (
          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            {/* Form Instruction Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex gap-3 text-xs leading-normal text-slate-600">
              <ShieldCheck className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-[#0d5c55] mb-0.5">扫码防丢与链路自动授权</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">请录入您呼叫代驾时的信息。提交完成后，司机端将立即听到开单播报，并一键开启车辆安全计费服务！</p>
              </div>
            </div>

            {/* Input card container */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
              {/* Telephone Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
                  📱 您的手机号码 (必填)
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-teal-600 rounded-xl px-3.5 py-3 transition-all">
                  <Phone className="w-4.5 h-4.5 text-slate-400 mr-2.5 shrink-0" />
                  <input
                    type="tel"
                    required
                    placeholder="请输入乘客本人的11位手机号"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    className="bg-transparent border-none w-full text-slate-900 outline-none font-bold text-base p-0 placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                    style={{ outline: 'none', border: 'none', background: 'none' }}
                  />
                </div>
              </div>

              {/* Start Location Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
                  📍 您的出发地 (必填)
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-teal-600 rounded-xl px-3.5 py-3 transition-all">
                  <MapPin className="w-4.5 h-4.5 text-[#0d5c55] mr-2.5 shrink-0" />
                  <input
                    type="text"
                    required
                    placeholder="搜寻或填写当前上车位置"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    className="bg-transparent border-none w-full text-slate-900 outline-none font-bold text-base p-0 placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                    style={{ outline: 'none', border: 'none', background: 'none' }}
                  />
                </div>
              </div>

              {/* Destination Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
                  🏁 您的目的地 (选填)
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-teal-600 rounded-xl px-3.5 py-3 transition-all">
                  <Navigation className="w-4.5 h-4.5 text-rose-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    placeholder="请输入代驾行驶目的地"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="bg-transparent border-none w-full text-slate-900 outline-none font-bold text-base p-0 placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
                    style={{ outline: 'none', border: 'none', background: 'none' }}
                  />
                </div>
              </div>

              {/* Consent Agreement Box */}
              <div className="pt-2 flex items-start gap-2.5 text-[10.5px] text-slate-500 leading-relaxed">
                <input
                  type="checkbox"
                  required
                  defaultChecked
                  className="mt-1 w-4 h-4 text-teal-600 bg-slate-100 border-slate-300 rounded focus:ring-teal-500 accent-teal-600 cursor-pointer"
                />
                <span className="cursor-pointer select-none">
                  我已授权自动上传当前位置，并同意接收司机的来电确认与服务协议，一键开启安全代开单行程。
                </span>
              </div>

              {/* Submit Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-4 mt-2 rounded-xl text-center font-bold text-base inline-flex items-center justify-center gap-2 active:scale-95 duration-150 cursor-pointer ${
                  submitting
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                    : 'text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-600/15'
                }`}
              >
                {submitting ? '⏳ 正在极速连接数据库开单...' : '🚀 确认授权并通知司机开单'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 py-2">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-bounce">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-wide">🎉 授权成功！系统已播报开单</h2>
                <p className="text-xs text-slate-500 leading-relaxed px-2">
                  您的填单已极速送达！司机的代驾调度台端已<b>同步接受数据并自动开始服务</b>。
                </p>
              </div>
            </div>

            {/* Receipt ticket style card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-4 text-left relative overflow-hidden">
              <div className="absolute -left-2 top-11 w-4 h-4 bg-[#f3f7f6] rounded-full"></div>
              <div className="absolute -right-2 top-11 w-4 h-4 bg-[#f3f7f6] rounded-full"></div>

              <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200">
                <span className="text-xs text-[#065f57] font-bold tracking-wider">📋 尊享行程同步票据</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">实时已触达</span>
              </div>
              <div className="space-y-2.5 pt-1 text-slate-600 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">上车地点：</span>
                  <span className="text-slate-900 font-bold text-right pl-4">{startLocation}</span>
                </div>
                {destination && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">下车目的地：</span>
                    <span className="text-slate-900 font-bold text-right pl-4">{destination}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">乘客手机：</span>
                  <span className="text-teal-600 font-bold font-mono">{passengerPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-slate-400">匹配司机手机：</span>
                  <span className="text-slate-950 font-bold font-mono">{driverPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-normal text-center select-none pt-2 animate-pulse">
              司机端应已收到语音唤起提示，请稍作等待，车辆安全计费服务正自动启动。
            </p>

            {onClose && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-650 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  返回演示
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Small Tech Credit Footer */}
      <footer className="p-4 text-center text-[10px] text-slate-400 font-medium border-t border-slate-200 shrink-0 font-sans">
        SECURE CHAUFFEUR CONNECT SYSTEM • CLOUDFLARE ENCRYPTED PROXIED
      </footer>
    </div>
  );
}
