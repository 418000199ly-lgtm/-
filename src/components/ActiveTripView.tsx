import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ChevronRight, Clock, ShieldCheck, X, PlusCircle, MinusCircle, CheckCircle } from 'lucide-react';
import { TripState, ChauffeurSettings, BillingRules, checkVipActive } from '../types';

interface ActiveTripViewProps {
  trip: TripState;
  settings: ChauffeurSettings;
  billingRules: BillingRules;
  onUpdateTrip: (updated: TripState) => void;
  onEndTrip: (baseFee: number) => void;
}

export default function ActiveTripView({
  trip,
  settings,
  billingRules,
  onUpdateTrip,
  onEndTrip
}: ActiveTripViewProps) {
  // 1. Durations states (driving duration & waiting duration)
  const [drivingSeconds, setDrivingSeconds] = useState(0);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);

  // Refs to avoid stale closures and infinite loop triggers in useEffect
  const tripRef = useRef(trip);
  const billingRulesRef = useRef(billingRules);
  const onUpdateTripRef = useRef(onUpdateTrip);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  useEffect(() => {
    billingRulesRef.current = billingRules;
  }, [billingRules]);

  useEffect(() => {
    onUpdateTripRef.current = onUpdateTrip;
  }, [onUpdateTrip]);

  // Modal / Interaction states
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showDestModal, setShowDestModal] = useState(false);
  const [tempDest, setTempDest] = useState(trip.endLocation || '');
  const [showSystemToast, setShowSystemToast] = useState(false);
  const [toastText, setToastText] = useState('');

  // Slider Drag states (Interactive Swiper simulation)
  const [sliderPos, setSliderPos] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const sliderWidthRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<number>(0);

  // 2. Mathematical cost calculation helper
  const calculateCost = (dist: number, waitMinutes: number, rules: BillingRules) => {
    const nowObj = new Date();
    const activeHour = nowObj.getHours();
    
    // Choose active slot based on hours
    let activeSlot = rules.slots[0];
    for (const slot of rules.slots) {
      const [startH] = slot.startTime.split(':').map(Number);
      const [endH] = slot.endTime.split(':').map(Number);
      
      if (startH > endH) {
        if (activeHour >= startH || activeHour <= endH) {
          activeSlot = slot;
          break;
        }
      } else if (activeHour >= startH && activeHour <= endH) {
        activeSlot = slot;
        break;
      }
    }

    const base = activeSlot.startingPrice;
    const freeKm = activeSlot.includedDistance;
    const interval = activeSlot.distanceInterval || 1;
    const increase = activeSlot.priceIncrease ?? activeSlot.unitPricePerKm ?? 5;

    let distanceCost = 0;
    if (dist > freeKm) {
      distanceCost = (dist - freeKm) * (increase / interval);
    }

    // Return trip surcharge
    let returnFee = 0;
    if (rules.returnFeeStartKm > 0 && dist > rules.returnFeeStartKm) {
      const rInterval = rules.returnFeeIntervalKm || 1;
      const rIncrease = rules.returnFeeIncreaseYuan ?? rules.returnFeePerKm ?? 0;
      returnFee = (dist - rules.returnFeeStartKm) * (rIncrease / rInterval);
    }

    // Waiting surcharge
    let waitingFee = 0;
    if (waitMinutes > rules.freeWaitingTime) {
      const wInterval = rules.waitingIntervalMin || 1;
      const wIncrease = rules.waitingIncreaseYuan ?? rules.waitingChargePerMin ?? 0;
      waitingFee = (waitMinutes - rules.freeWaitingTime) * (wIncrease / wInterval);
    }

    const wMultiplier = trip.weatherMultiplier || 1.0;
    const totalCalculated = (base + distanceCost + returnFee + waitingFee) * wMultiplier;
    return {
      base: Number((base * wMultiplier).toFixed(2)),
      total: Number(totalCalculated.toFixed(2))
    };
  };

  // 3. Keep real-time counter ticking and advancing trip metrics
  useEffect(() => {
    const interval = setInterval(() => {
      if (isWaiting) {
        setWaitingSeconds(prev => prev + 1);
      } else {
        setDrivingSeconds(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isWaiting]);

  // Handle driving ticks
  useEffect(() => {
    if (drivingSeconds > 0 && drivingSeconds % 4 === 0) {
      const addedKm = 0.10;
      const currentTripValue = tripRef.current;
      const nextDist = Number((currentTripValue.currentDistance + addedKm).toFixed(2));
      const cost = calculateCost(nextDist, currentTripValue.currentWaitingTime, billingRulesRef.current);
      onUpdateTripRef.current({
        ...currentTripValue,
        currentDistance: nextDist,
        calculatedBaseFee: cost.base,
        calculatedTotalFee: cost.total
      });
    }
  }, [drivingSeconds]);

  // Handle waiting ticks
  useEffect(() => {
    if (waitingSeconds > 0 && waitingSeconds % 10 === 0) {
      const currentTripValue = tripRef.current;
      const newMins = currentTripValue.currentWaitingTime + 1;
      const cost = calculateCost(currentTripValue.currentDistance, newMins, billingRulesRef.current);
      onUpdateTripRef.current({
        ...currentTripValue,
        currentWaitingTime: newMins,
        calculatedBaseFee: cost.base,
        calculatedTotalFee: cost.total
      });
      triggerToast(`等候计时增加：当前累计等候 ${newMins} 分钟`);
    }
  }, [waitingSeconds]);

  // Toast notifier helper
  const triggerToast = (text: string) => {
    setToastText(text);
    setShowSystemToast(true);
    setTimeout(() => setShowSystemToast(false), 2400);
  };

  // 4. Formatter helper for HH:MM:SS
  const formatHms = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  };

  // Save updated destination location from popup dialog
  const handleSaveDestination = () => {
    onUpdateTrip({
      ...trip,
      endLocation: tempDest.trim() || '未完成安全目的地设定'
    });
    setShowDestModal(false);
    triggerToast('修改目的地成功！实时计费规则自动匹配。');
  };

  // Simulate navigation click trigger
  const handleSimulateNavigation = () => {
    triggerToast(`高配导航启航：正通过高德/百度安全规划至【${trip.endLocation || '目的地'}】`);
  };

  // 5. Swipe/Drag Actions listener for Touch & Mouse
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartRef.current = clientX;
    setIsSliding(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSliding || !sliderWidthRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diffX = clientX - dragStartRef.current;
    const rect = sliderWidthRef.current.getBoundingClientRect();
    const maxDrag = rect.width - 52; // Slider handle diameter (52px)
    
    let pos = Math.max(0, Math.min(diffX, maxDrag));
    setSliderPos(pos);

    // If dragged to the end (over 88%), trigger trip ending!
    if (pos >= maxDrag * 0.88) {
      setIsSliding(false);
      setSliderPos(0);
      onEndTrip(trip.calculatedTotalFee);
    }
  };

  const handleTouchEnd = () => {
    setIsSliding(false);
    setSliderPos(0); // Snap back to start position smoothly
  };

  // Global mousemove/mouseup listener so sliding works for dry mouse on dekstop browsers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isSliding || !sliderWidthRef.current) return;
      const diffX = e.clientX - dragStartRef.current;
      const rect = sliderWidthRef.current.getBoundingClientRect();
      const maxDrag = rect.width - 52;
      let pos = Math.max(0, Math.min(diffX, maxDrag));
      setSliderPos(pos);
      if (pos >= maxDrag * 0.88) {
        setIsSliding(false);
        setSliderPos(0);
        onEndTrip(trip.calculatedTotalFee);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isSliding) {
        setIsSliding(false);
        setSliderPos(0);
      }
    };

    if (isSliding) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSliding, trip.calculatedTotalFee]);

  // Adjust distance manually (deviation helper to adjust on simulated app preview)
  const handleAdjustDistance = (amount: number) => {
    if (!checkVipActive(settings.vipExpiry)) {
      triggerToast('🔒 提示：纠偏功能为VIP会员专属特权！');
      return;
    }
    if (!settings.deviationMitigation) {
      triggerToast('纠偏功能已设定为禁用，请进入设置页开启它');
      return;
    }
    const nextDist = Math.max(0, Number((trip.currentDistance + amount).toFixed(2)));
    const cost = calculateCost(nextDist, trip.currentWaitingTime, billingRules);
    onUpdateTrip({
      ...trip,
      currentDistance: nextDist,
      calculatedBaseFee: cost.base,
      calculatedTotalFee: cost.total
    });
    triggerToast(`微调里程：${amount > 0 ? '+' : ''}${amount}公里，费用自动重新核算`);
  };

  // Adjust waiting time manually (deviation helper to adjust waiting duration)
  const handleAdjustWaitingTime = (amountMins: number) => {
    if (!checkVipActive(settings.vipExpiry)) {
      triggerToast('🔒 提示：纠偏功能为VIP会员专属特权！');
      return;
    }
    if (!settings.deviationMitigation) {
      triggerToast('纠偏功能已设定为禁用，请进入设置页开启它');
      return;
    }
    const amountSecs = amountMins * 60;
    setWaitingSeconds(prev => {
      const nextSec = prev + amountSecs;
      return nextSec < 0 ? 0 : nextSec;
    });

    const nextWaitingTime = Math.max(0, trip.currentWaitingTime + amountMins);
    const cost = calculateCost(trip.currentDistance, nextWaitingTime, billingRules);
    onUpdateTrip({
      ...trip,
      currentWaitingTime: nextWaitingTime,
      calculatedBaseFee: cost.base,
      calculatedTotalFee: cost.total
    });
  };

  // Fast double click correction on active trip page area
  const handleDoubleClickPage = (e: React.MouseEvent<HTMLDivElement>) => {
    // Avoid triggering when double clicking interactive buttons or dialogs
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="dialog"]') || target.closest('header')) {
      return;
    }

    if (!checkVipActive(settings.vipExpiry)) {
      triggerToast('🔒 提示：纠偏功能为VIP会员专属特权！');
      return;
    }

    if (!settings.deviationMitigation) {
      triggerToast('纠偏功能已设定为禁用，请进入设置页开启它');
      return;
    }

    const addedKm = settings.deviationKm ?? 1.0;
    const addedWaitSec = settings.deviationWaitSec ?? 60;
    const addedWaitMin = Math.round(addedWaitSec / 60) || 1;

    setWaitingSeconds(prev => {
      const nextSec = prev + addedWaitSec;
      return nextSec < 0 ? 0 : nextSec;
    });

    const nextDist = Math.max(0, Number((trip.currentDistance + addedKm).toFixed(2)));
    const nextWaitingTime = Math.max(0, trip.currentWaitingTime + addedWaitMin);
    const cost = calculateCost(nextDist, nextWaitingTime, billingRules);

    onUpdateTrip({
      ...trip,
      currentDistance: nextDist,
      currentWaitingTime: nextWaitingTime,
      calculatedBaseFee: cost.base,
      calculatedTotalFee: cost.total
    });

    triggerToast(`极速纠偏：里程 +${addedKm}km，时间 +${addedWaitMin}分钟，费用自动重算`);
  };

  return (
    <div 
      onDoubleClick={handleDoubleClickPage}
      className="flex-1 flex flex-col justify-between h-full w-full bg-[#f8f9fb] text-[#333] select-none relative overflow-hidden font-sans"
    >
      
      {/* SYSTEM TOAST ALERTS */}
      {showSystemToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#3d465e] text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 max-w-[280px] text-center justify-center animate-in fade-in zoom-in duration-150">
          <ShieldCheck className="w-4 h-4 text-[#26a69a]" />
          <span>{toastText}</span>
        </div>
      )}

      {/* BEGIN: MainHeader */}
      <header className="bg-[#3d465e] text-white pt-6 pb-4 px-4 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="w-10"></div>
        <h1 className="text-base font-semibold tracking-wide">实时计费中</h1>
        <button 
          onClick={() => setShowRulesModal(true)}
          className="text-xs opacity-90 hover:opacity-100 transition-opacity bg-white/10 px-2.5 py-1 rounded-full border border-white/5 active:scale-95" 
          data-purpose="header-link"
        >
          计费规则
        </button>
      </header>
      {/* END: MainHeader */}

      {/* BEGIN: MainContent Scroll Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* BEGIN: DestinationCard */}
        <section 
          onClick={() => {
            setTempDest(trip.endLocation || '');
            setShowDestModal(true);
          }}
          className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" 
          data-purpose="destination-selector"
        >
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <MapPin className="h-4.5 w-4.5 text-[#26a69a] shrink-0" />
            <div className="text-left overflow-hidden">
              <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5">目的地</div>
              <span className="text-sm font-bold text-gray-800 truncate block">
                {trip.endLocation && trip.endLocation !== '待指定安全目的地' ? trip.endLocation : '未设置目的地'}
              </span>
            </div>
          </div>
          <div className="flex items-center text-gray-400 shrink-0 select-none">
            {!trip.endLocation || trip.endLocation === '待指定安全目的地' ? (
              <span className="text-xs text-slate-400 mr-1 font-medium">点击设置</span>
            ) : null}
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        </section>
        {/* END: DestinationCard */}

        {/* BEGIN: MainBillingCard */}
        <section 
          className="bg-gradient-to-br from-[#4db6ac] to-[#26a69a] relative rounded-xl p-6 text-white overflow-hidden shadow-lg shadow-teal-100/40" 
          data-purpose="billing-status-display"
        >
          {/* Large watermark-like Yen symbol */}
          <div className="absolute left-[-15px] bottom-[-25px] text-[180px] font-black text-white/10 leading-none pointer-events-none select-none">
            ¥
          </div>

          {/* Navigation Button */}
          <div 
            onClick={handleSimulateNavigation}
            className="absolute top-4 right-4 bg-white rounded-xl p-2 shadow-md flex flex-col items-center justify-center w-11 h-11 cursor-pointer active:scale-95 transition-transform" 
            data-purpose="nav-button"
          >
            <Navigation className="h-4.5 w-4.5 text-[#26a69a] transform rotate-45" />
            <span className="text-[9px] text-[#26a69a] mt-0.5 font-extrabold tracking-wider">导航</span>
          </div>

          {/* Price & Duration Info Display */}
          <div className="text-center relative z-10 py-2">
            <div className="text-5xl font-black tracking-tight mb-1 animate-pulse font-mono">
              {trip.calculatedTotalFee.toFixed(2)}
            </div>
            <div className="text-[11px] opacity-90 mb-5 font-medium tracking-wide">
              实时计费(元)
            </div>
            
            <div className="h-[1px] bg-white opacity-20 w-28 mx-auto mb-4"></div>
            
            <div className="flex items-center justify-center space-x-1.5 text-xs text-white/95">
              <span className="opacity-90 font-medium">开车时长:</span>
              <span className="font-bold tracking-widest font-mono text-sm bg-teal-800/20 px-2 py-0.5 rounded-md">
                {formatHms(drivingSeconds)}
              </span>
            </div>
          </div>
        </section>

        {/* BEGIN: SecondaryStatsRow */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Distance stats col - vertically split in half smoothly with seamless overlay */}
          <div 
            className="bg-white rounded-xl border border-gray-100 shadow-2xs relative overflow-hidden flex min-h-[96px] h-full" 
            data-purpose="stat-distance"
          >
            {/* Left half clickable area: Click to correct +1 km */}
            <button
              onClick={(e) => { e.stopPropagation(); handleAdjustDistance(1.0); }}
              className={`w-1/2 bg-white ${
                settings.deviationMitigation 
                  ? 'hover:bg-emerald-50/5 active:bg-emerald-50/20 cursor-pointer' 
                  : 'cursor-not-allowed opacity-90'
              } transition-colors flex items-center justify-center p-3 relative focus:outline-hidden focus:ring-0 select-none`}
              title={settings.deviationMitigation ? "纠偏里程增加 1 公里" : "纠偏功能已在设置中禁用"}
            >
            </button>

            {/* Right half clickable area: Click to correct -1 km */}
            <button
              onClick={(e) => { e.stopPropagation(); handleAdjustDistance(-1.0); }}
              className={`w-1/2 bg-white ${
                settings.deviationMitigation 
                  ? 'hover:bg-rose-50/5 active:bg-rose-50/20 cursor-pointer' 
                  : 'cursor-not-allowed opacity-90'
              } transition-colors flex items-center justify-center p-3 relative focus:outline-hidden focus:ring-0 select-none`}
              title={settings.deviationMitigation ? "纠偏里程减少 1 公里" : "纠偏功能已在设置中禁用"}
            >
            </button>

            {/* Centered Overlay Badge: Show current distance value and status label */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none z-10 flex flex-col items-center justify-center min-w-[100px] ${!settings.deviationMitigation ? 'opacity-65' : ''}`}>
              <div className="text-2xl font-black text-[#26a69a] font-mono leading-none mb-1">
                {trip.currentDistance.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 font-bold tracking-wider leading-none whitespace-nowrap uppercase">
                已行程(公里)
              </div>
            </div>
          </div>

          {/* Waiting stats col - vertically split in half smoothly with seamless overlay */}
          <div 
            className="bg-white rounded-xl border border-gray-100 shadow-2xs relative overflow-hidden flex min-h-[96px] h-full" 
            data-purpose="stat-waiting"
          >
            {/* Left half clickable area: Click to increase waiting by 1 min */}
            <button
              onClick={(e) => { e.stopPropagation(); handleAdjustWaitingTime(1); }}
              className={`w-1/2 bg-white ${
                settings.deviationMitigation 
                  ? 'hover:bg-emerald-50/5 active:bg-emerald-50/20 cursor-pointer' 
                  : 'cursor-not-allowed opacity-90'
              } transition-colors flex items-center justify-center p-3 relative focus:outline-hidden focus:ring-0 select-none`}
              title={settings.deviationMitigation ? "增加一分钟" : "纠偏功能已在设置中禁用"}
            >
            </button>

            {/* Right half clickable area: Click to decrease waiting by 1 min */}
            <button
              onClick={(e) => { e.stopPropagation(); handleAdjustWaitingTime(-1); }}
              className={`w-1/2 bg-white ${
                settings.deviationMitigation 
                  ? 'hover:bg-rose-50/5 active:bg-rose-50/20 cursor-pointer' 
                  : 'cursor-not-allowed opacity-90'
              } transition-colors flex items-center justify-center p-3 relative focus:outline-hidden focus:ring-0 select-none`}
              title={settings.deviationMitigation ? "减少一分钟" : "纠偏功能已在设置中禁用"}
            >
            </button>

            {/* Centered Overlay Badge: Show current waiting metrics and status labels */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none z-10 flex flex-col items-center justify-center min-w-[124px] ${!settings.deviationMitigation ? 'opacity-65' : ''}`}>
              <div className="text-2xl font-black text-[#26a69a] font-mono leading-none mb-1 text-center">
                {formatHms(waitingSeconds)}
              </div>
              <div className="text-[10px] text-gray-500 font-bold tracking-wider leading-none whitespace-nowrap uppercase">
                等候累积计时
              </div>
              <div className="text-[9px] text-slate-400 font-medium mt-1 font-sans">
                已记费: <span className="font-bold text-teal-600">{trip.currentWaitingTime}</span> 分钟
              </div>
            </div>
          </div>
        </div>
        {/* END: SecondaryStatsRow */}

        {/* BEGIN: ActionButtons */}
        <div className="pt-3 space-y-3.5">
          {/* Waiting State Trigger Button */}
          <button 
            onClick={() => {
              const nextWaiting = !isWaiting;
              setIsWaiting(nextWaiting);
              triggerToast(nextWaiting ? '已为您启动「车停等候」计时体系' : '结束等候，已重新切换为行驶录制阶段');
            }}
            className={`w-full py-3.5 font-bold rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-2 border text-sm ${
              isWaiting 
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100/70' 
                : 'bg-white border-[#26a69a] text-[#26a69a] hover:bg-teal-50/40'
            }`}
            data-purpose="action-wait"
          >
            <Clock className={`w-4 h-4 ${isWaiting ? 'animate-spin' : ''}`} />
            <span>{isWaiting ? '结束等待 恢复驾车' : '开始等待'}</span>
          </button>

          {/* Finish Service Slide Button (Horizontal Gesture Swiper) */}
          <div 
            ref={sliderWidthRef}
            onMouseDown={handleTouchStart}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onMouseMove={isSliding ? handleTouchMove : undefined}
            onTouchEnd={handleTouchEnd}
            onMouseUp={handleTouchEnd}
            className="relative w-full h-[58px] bg-[#26a69a] select-none rounded-xl flex items-center justify-center overflow-hidden active:opacity-95 transition-all cursor-grab active:cursor-grabbing shadow-md shadow-teal-500/10 border border-teal-600/10" 
            data-purpose="action-finish-slider"
          >
            {/* Sliding background fill */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-teal-800/25 pointer-events-none transition-all duration-75"
              style={{ width: `${sliderPos + 48}px` }}
            ></div>

            {/* Slider active trigger handle */}
            <div 
              className="absolute bg-white text-[#26a69a] rounded-xl flex items-center justify-center shadow-lg transition-transform duration-75 select-none pointer-events-none"
              style={{ 
                transform: `translateX(${sliderPos}px)`,
                left: '4px',
                width: '48px',
                height: '48px'
              }}
            >
              {/* Chevron Icons representing right dragging motion */}
              <svg className="h-5 w-5 text-[#26a69a] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 7l5 5-5 5M6 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
              </svg>
            </div>

            {/* Simulated text */}
            <span className="text-white font-bold text-sm tracking-wide select-none pointer-events-none z-10 pl-6">
              {isSliding ? '请一直滑行到右侧结束...' : '右滑 完成服务'}
            </span>
          </div>
        </div>
        {/* END: ActionButtons */}

        {/* BEGIN: FooterNote */}
        <footer className="pt-2 pb-6">
          <p className="text-center text-slate-400 text-[10px] tracking-wide leading-relaxed">
            请确认行驶路线安全无误，结束工作后根据实际费率跟乘客结算费用
          </p>
        </footer>
        {/* END: FooterNote */}

      </main>
      {/* END: MainContent */}

      {/* EDITABLE DESTINATION CARD MODAL */}
      {showDestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[310px] p-5 shadow-2xl border border-slate-100 flex flex-col text-left animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-black text-slate-800">设置行程目的地</span>
              <button 
                onClick={() => setShowDestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 mb-4">我们将根据您输入的真实名称匹配费率，并在出账单时呈现给车主结算。</p>
            
            <input 
              type="text"
              value={tempDest}
              onChange={(e) => setTempDest(e.target.value)}
              className="px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-0 focus:outline-hidden rounded-xl mb-4"
              placeholder="请输入真实的行驶终点"
              autoFocus
            />

            <div className="flex gap-2">
              <button 
                onClick={() => setShowDestModal(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                取消
              </button>
              <button 
                onClick={handleSaveDestination}
                className="flex-1 py-2.5 bg-[#26a69a] hover:bg-[#208a80] text-white rounded-xl text-xs font-bold"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED BILLING RULES OVERVIEW MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[320px] p-5 shadow-2xl border border-slate-100 text-left animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <span className="text-sm font-black text-slate-800">代驾规则与计费模版</span>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3.5 text-xs text-slate-600 mb-5 max-h-[300px] overflow-y-auto pr-1">
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">模版名称</span>
                <p className="bg-teal-50 text-teal-800 rounded-md py-1 px-2.5 inline-block font-semibold">
                  {billingRules.templateName}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-0.5">当前时间段计费</span>
                <ul className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed text-[11px]">
                  {billingRules.slots.map((slot, index) => (
                    <li key={index} className="flex justify-between">
                      <span>{slot.startTime}–{slot.endTime}</span>
                      <span className="font-bold text-slate-705">起步 ¥{slot.startingPrice} (含 {slot.includedDistance}km)</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-0.5">公里运价</span>
                {(() => {
                  const firstSlot = billingRules.slots[0];
                  const displayInterval = firstSlot.distanceInterval || 1;
                  const displayIncrease = firstSlot.priceIncrease ?? firstSlot.unitPricePerKm ?? 5;
                  return (
                    <p className="text-slate-500">
                      超出初始里程后，每增加 <span className="font-semibold text-slate-800">{displayInterval}</span> 公里需支付 <span className="font-bold text-teal-600">¥{displayIncrease} 元</span> 收款运价。
                    </p>
                  );
                })()}
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-0.5">等候计时计费</span>
                <p className="text-slate-500">
                  乘客前 <span className="font-bold text-teal-600">{billingRules.freeWaitingTime} 分钟</span> 免费等待。
                  超出后每过 <span className="font-semibold text-slate-800">{billingRules.waitingIntervalMin ?? 1}</span> 分钟加收 <span className="font-bold text-teal-600">¥{billingRules.waitingIncreaseYuan ?? billingRules.waitingChargePerMin} 元</span>。
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-0.5">返程收费准则</span>
                {billingRules.returnFeeStartKm > 0 ? (
                  <p className="text-slate-500">
                    行程里程超过 <span className="font-bold text-slate-800">{billingRules.returnFeeStartKm} 公里</span> 时，超公里部分每增加 <span className="font-bold text-teal-600">{billingRules.returnFeeIntervalKm || 1} 公里</span> 加收 <span className="font-bold text-teal-600">¥{(billingRules.returnFeeIncreaseYuan ?? billingRules.returnFeePerKm ?? 0)} 元</span>。
                  </p>
                ) : (
                  <p className="text-slate-500">无返程加收费用。</p>
                )}
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 bg-[#3d465e] text-white hover:bg-[#343c51] rounded-xl text-xs font-bold transition-all"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
