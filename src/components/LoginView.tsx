import React, { useState, useEffect } from 'react';
import { Smartphone, ShieldCheck, Loader2, KeyRound, MessageSquare, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (phoneNumber: string) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [simulatedSMS, setSimulatedSMS] = useState<string | null>(null);

  // Countdown timer handler for SMS backoff
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Handle Send SMS Click
  const handleGetSMSCode = () => {
    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed) {
      setErrorMsg('请输入您的手机号码');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phoneTrimmed)) {
      setErrorMsg('请输入正确的11位中国大陆手机号');
      return;
    }

    setErrorMsg('');
    setIsSending(true);

    // 经典极速模拟通道：延迟模拟
    setTimeout(() => {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      setGeneratedCode(code);
      setTimer(60);
      setIsSending(false);
      setSimulatedSMS(`【尊呼叫出行】您的验证码为：${code}。仅用作代驾司机端登录验证，请在5分钟内输入。`);
      setTimeout(() => {
         setSimulatedSMS(null);
      }, 15000); // 留出足够多的时间给客户点击填入
    }, 800);
  };

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed || !/^1[3-9]\d{9}$/.test(phoneTrimmed)) {
      setErrorMsg('请输入正确的手机号码');
      return;
    }

    if (!smsCode) {
      setErrorMsg('请输入验证码');
      return;
    }

    setIsLoggingIn(true);

    // 校验模拟验证码
    if (!generatedCode) {
      setErrorMsg('请先获取验证码');
      setIsLoggingIn(false);
      return;
    }

    if (smsCode.trim() !== generatedCode) {
      setErrorMsg('❌ 验证码错误，请输入上面浮窗推送中的正确验证码！');
      setIsLoggingIn(false);
      return;
    }

    setTimeout(() => {
      setIsLoggingIn(false);
      onLoginSuccess(phoneTrimmed);
    }, 1000);
  };

  return (
    <div className="w-full h-full bg-[#0a0b10] flex flex-col relative select-text overflow-hidden" id="login-module">
      
      {/* Mock Phone System Bar Spacer */}
      <div className="h-6 bg-black shrink-0"></div>

      {/* Dynamic Simulated Message Push Notification Overlay */}
      {simulatedSMS && (
        <div id="sms-notification-overlay" className="absolute top-8 left-3 right-3 z-50 bg-[#1e2230]/95 border border-amber-500/20 text-slate-100 p-3 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.5)] flex items-start gap-2.5 animate-in slide-in-from-top-4 duration-300">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
            <MessageSquare className="w-4 h-4 fill-amber-500/10" />
          </div>
          <div className="flex-1 space-y-1 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-500 tracking-wide">收到新验证码短信 (真机模拟)</span>
              <span className="text-[9px] text-slate-500">刚刚</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300 select-all font-medium">
              {simulatedSMS}
            </p>
            <div className="pt-1.5 flex gap-1.5">
              <button 
                id="autofill-sms-btn"
                onClick={() => {
                  setSmsCode(generatedCode);
                  setSimulatedSMS(null);
                }}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-black tracking-wide leading-none transition-colors cursor-pointer"
              >
                一键填入验证码
              </button>
              <button 
                id="dismiss-sms-btn"
                onClick={() => setSimulatedSMS(null)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] font-bold leading-none transition-colors cursor-pointer"
              >
                忽略
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Scrollbox */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-between">
        
        {/* Brand Area */}
        <div className="space-y-6 pt-4 shrink-0 text-center">
          <div className="inline-flex py-1.5 px-3 bg-[#189F95]/10 border border-[#189F95]/20 text-[#189F95] rounded-full text-[10px] font-black uppercase tracking-wider mx-auto">
            安全双向身份验证
          </div>

          <div className="w-14 h-14 bg-gradient-to-tr from-[#189F95] to-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-[#189F95]/15 border border-teal-300/10">
            <Smartphone className="w-7 h-7 text-slate-950 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-100 tracking-tight">手机短信极速校验登录</h2>
            <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto leading-relaxed">
              输入并校验通过短信验证码激活本次司机终端安全会话。
            </p>
          </div>
        </div>

        {/* Input fields */}
        <form onSubmit={handleLoginSubmit} className="my-6 space-y-4 flex-1 flex flex-col justify-center">
          
          {/* Box segment for fields */}
          <div className="space-y-3.5">
            
            {/* Phone Number Field */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">
                手机号码
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center space-x-1 border-r border-slate-800 pr-2">
                  <span className="text-[11px] font-black text-[#189F95]">+86</span>
                </div>
                <input
                  type="tel"
                  id="driver-auth-phone-field"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/\D/g, '');
                    setPhone(cleanVal);
                    setErrorMsg('');
                  }}
                  placeholder="请输入您的11位手机号码"
                  className="w-full pl-[56px] pr-4 py-3 bg-[#0e1017] border border-slate-900 rounded-2xl text-xs font-black focus:outline-hidden focus:border-[#189F95] text-slate-200 placeholder:text-slate-600 font-mono tracking-wider"
                />
              </div>
            </div>

            {/* Verification Code Field with inline action button */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">
                短信验证码
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    id="driver-sms-code-input"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => {
                      setSmsCode(e.target.value.trim());
                      setErrorMsg('');
                    }}
                    placeholder="格式为4位或6位数字"
                    className="w-full pl-10 pr-4 py-3 bg-[#0e1017] border border-slate-900 rounded-2xl text-xs font-black focus:outline-hidden focus:border-[#189F95] text-slate-200 placeholder:text-slate-600 font-mono tracking-widest text-center"
                  />
                </div>
                
                {/* Send button with countdown */}
                <button
                  type="button"
                  id="sms-sender-trigger-btn"
                  onClick={handleGetSMSCode}
                  disabled={timer > 0 || isSending}
                  className="px-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-[#189F95] hover:text-[#22bcae] rounded-2xl text-xs font-black transition-colors min-w-[96px] shrink-0 border border-slate-800 flex items-center justify-center cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#189F95]" />
                  ) : timer > 0 ? (
                    `${timer}s`
                  ) : (
                    '获取验证码'
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Feedback error line if any */}
          {errorMsg && (
            <div id="login-error-toast" className="py-2.5 px-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl flex items-center gap-1.5 text-left font-bold animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            id="driver-login-trigger"
            disabled={isLoggingIn}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs tracking-wider rounded-2xl shadow-lg flex items-center justify-center gap-1.5 hover:scale-102 transition-transform cursor-pointer mt-2"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在校验本次设备签发码...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                立即验证并登录系统
              </>
            )}
          </button>

        </form>

        {/* Footer info tip */}
        <div className="shrink-0 flex items-center justify-center gap-1 text-[9.5px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>中国联通 / 移动 / 电信 物理链路全通道秒极保障</span>
        </div>

      </div>

    </div>
  );
}
