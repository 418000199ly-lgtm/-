import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Clock, RotateCw, CheckCircle2 } from 'lucide-react';
import { BillingRules, TripState, ChauffeurSettings } from '../types';
import { db } from '../lib/firebase';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import PassengerOrderView from './PassengerOrderView';

const MULTIPLIER_OPTIONS = Array.from({ length: 11 }, (_, i) => Number((1.0 + i * 0.1).toFixed(1))); // [1.0, 1.1, ..., 2.0]

// Beautiful dynamically generated QR code SVG based on seed/counter
const SvgQrCode = ({ seed, url }: { seed: number; url?: string }) => {
  // If we have a real url, use the public secure API to render a 100% scannable image!
  if (url) {
    return (
      <div className="w-40 h-40 bg-white p-2 rounded-2xl border border-gray-100 shadow-xs overflow-hidden flex items-center justify-center">
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}&color=0d9488&qzone=1`} 
          alt="扫码呼车二维码"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  const blocks = [];
  const size = 15; // 15x15 grid
  const randomizer = (x: number, y: number) => {
    // simple deterministic pseudo-random logic based on x, y and seed
    const val = Math.sin(x * 12.9898 + y * 78.233 + seed * 153.1) * 43758.5453;
    return (val - Math.floor(val)) > 0.5;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isTopLeft = r < 4 && c < 4;
      const isTopRight = r < 4 && c >= size - 4;
      const isBottomLeft = r >= size - 4 && c < 4;

      if (isTopLeft) {
        const isOuter = r === 0 || r === 3 || c === 0 || c === 3;
        blocks.push({ r, c, fill: isOuter || (r === 1.5 && c === 1.5) });
      } else if (isTopRight) {
        const isOuter = r === 0 || r === 3 || c === size - 1 || c === size - 4;
        blocks.push({ r, c, fill: isOuter });
      } else if (isBottomLeft) {
        const isOuter = r === size - 1 || r === size - 4 || c === 0 || c === 3;
        blocks.push({ r, c, fill: isOuter });
      } else {
        blocks.push({ r, c, fill: randomizer(r, c) });
      }
    }
  }

  return (
    <svg className="w-40 h-40 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm" viewBox={`0 0 ${size} ${size}`}>
      {blocks.map((b, i) => b.fill ? (
        <rect 
          key={i} 
          x={b.c} 
          y={b.r} 
          width="1.0" 
          height="1.0" 
          fill="#0d9488" 
          shapeRendering="crispEdges"
        />
      ) : null)}
      <rect x="1" y="1" width="2" height="2" fill="#0d9488" />
      <rect x={size - 3} y="1" width="2" height="2" fill="#0d9488" />
      <rect x="1" y={size - 3} width="2" height="2" fill="#0d9488" />
    </svg>
  );
};

interface CreateOrderViewProps {
  billingRules: BillingRules;
  settings: ChauffeurSettings;
  userPhone: string | null;
  onStartTrip: (trip: TripState) => void;
  onNavigateBack: () => void;
}

export default function CreateOrderView({
  billingRules,
  settings,
  userPhone,
  onStartTrip,
  onNavigateBack
}: CreateOrderViewProps) {
  const registeredCity = settings?.city || '';
  const [startLocation, setStartLocation] = useState(() => {
    return registeredCity ? `${registeredCity}万达广场住宅区` : '兴庆区政府住宅区';
  });
  const [destination, setDestination] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isEditingStart, setIsEditingStart] = useState(false);

  // QR Code creation modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(180); // 3 minutes = 180s
  const [qrUpdateCount, setQrUpdateCount] = useState(1);
  const [scanSuccessMsg, setScanSuccessMsg] = useState(false);
  const [showSimulatedScanner, setShowSimulatedScanner] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    if (!showQrModal) return;
    
    setQrCountdown(180);
    const interval = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          setQrUpdateCount(c => c + 1);
          return 180;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showQrModal]);

  // Real-time synchronization for passenger self-service QR code scans
  useEffect(() => {
    const driverPhoneNum = userPhone || '18609518888';

    const docRef = doc(db, 'passenger_links', driverPhoneNum);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Check if the submission occurred within the last 5 minutes to avoid stale entries
        if (data.status === 'submitted' && data.timestamp > Date.now() - 300000) {
          if (data.passengerPhone) setPhoneNumber(data.passengerPhone);
          if (data.destination) setDestination(data.destination);
          if (data.startLocation) setStartLocation(data.startLocation);

          setScanSuccessMsg(true);
          setShowQrModal(false);

          // Audio vocal broadcast announcement
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              const utter = new SpeechSynthesisUtterance('系统提示：乘客已扫码授权，填单内容自动同步成功。');
              utter.lang = 'zh-CN';
              window.speechSynthesis.speak(utter);
            } catch (e) {}
          }
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([100, 50, 100]); } catch(e){}
          }

          // Clear the processed link to prevent infinite populating loops
          deleteDoc(docRef).catch(err => console.error('Error clearing passenger link document:', err));
        }
      }
    });

    return () => unsubscribe();
  }, [userPhone]);

  const passengerScanUrl = `https://daijiajifei.ccwu.cc/?driver=${encodeURIComponent(userPhone || '18609518888')}`;

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Weather multiplier states
  const [weatherMultiplier, setWeatherMultiplier] = useState(1.0);
  const [showMultiplierPicker, setShowMultiplierPicker] = useState(false);
  const [tempMultiplier, setTempMultiplier] = useState(1.0);
  const multiplierScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showMultiplierPicker) {
      const timer = setTimeout(() => {
        if (multiplierScrollRef.current) {
          const idx = MULTIPLIER_OPTIONS.indexOf(tempMultiplier);
          if (idx !== -1) {
            multiplierScrollRef.current.scrollTop = idx * 40;
          }
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showMultiplierPicker]);

  const handleMultiplierScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollTop / 40);
    if (index >= 0 && index < MULTIPLIER_OPTIONS.length) {
      const selected = MULTIPLIER_OPTIONS[index];
      if (tempMultiplier !== selected) {
        setTempMultiplier(selected);
      }
    }
  };

  // Get active starting price from current billing rules (default to first slot or 40)
  const baseStartingPrice = billingRules.slots[0]?.startingPrice ?? 40;
  
  // Calculate estimation fee
  const isEstimated = destination.trim().length > 0;
  const estimatedPrice = isEstimated ? (baseStartingPrice * weatherMultiplier) : 0;

  const handleCreateOrder = () => {
    if (settings && settings.isBanned) {
      alert("⚠️ 无法接单！因账户违规，您的账号已被管理员封停。封停期间无法接取任何线上/线下订单，请联系后台解封！");
      return;
    }

    // Generate new robust trip state
    const targetDestination = destination.trim() || '待指定安全目的地';
    const targetPhone = phoneNumber.trim() || '13900000000';
    const startingFeeApplied = Number((baseStartingPrice * weatherMultiplier).toFixed(2));
    
    if (registeredCity && !startLocation.includes(registeredCity)) {
      alert(`⚠️ 无法接单！因合规原因，您线上认证的听单开通城市为【${registeredCity}】。线上派单或自助接单，您的出发地（当前输入：${startLocation}）都必须在【${registeredCity}】范围内，否则无法接单！`);
      return;
    }
    
    const newTrip: TripState = {
      id: 'Z' + Math.floor(Math.random() * 900000 + 100000),
      orderNumber: 'DD' + Date.now().toString().slice(-8),
      passengerName: '线下自助代驾客户',
      passengerPhone: targetPhone,
      startLocation: startLocation,
      endLocation: targetDestination,
      startTimestamp: Date.now(),
      currentDistance: 0.0, // starts at 0 for recording distance
      currentWaitingTime: 0,
      currentStatus: 'serving',
      extraBridgeFee: 0,
      extraParkingFee: 0,
      extraOtherFee: 0,
      calculatedBaseFee: startingFeeApplied,
      calculatedTotalFee: startingFeeApplied,
      weatherMultiplier: weatherMultiplier
    };

    onStartTrip(newTrip);
  };

  return (
    <div className="relative flex-grow flex flex-col justify-between w-full h-full select-none overflow-hidden text-gray-900 bg-gray-100 font-sans">
      
      {/* BEGIN: MapBackground (Beautiful Offline Vector Map SVG) */}
      <div className="absolute inset-0 z-0 bg-[#e4eae4] overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
          {/* Roads/Grids representation */}
          <path d="M-100,50 L500,50 M-100,200 L500,200 M-100,350 L500,350 M-100,500 L500,500" stroke="#fcfcfc" strokeWidth="16" />
          <path d="M50,-100 L50,600 M200,-100 L200,600 M350,-100 L350,600" stroke="#fcfcfc" strokeWidth="16" />
          {/* Diagonals / Highways */}
          <path d="M-100,-100 L500,500" stroke="#f0f5f0" strokeWidth="24" />
          <path d="M500,-100 L-100,500" stroke="#e0ece0" strokeWidth="12" />
          {/* Green zones/parks */}
          <rect x="80" y="80" width="100" height="90" rx="12" fill="#d0ebd0" />
          <rect x="230" y="230" width="90" height="100" rx="12" fill="#d0ebd0" />
          {/* River */}
          <path d="M-50,420 Q120,380 220,460 T480,430" fill="none" stroke="#add8e6" strokeWidth="24" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/30" />
        
        {/* Animated GPS Pulsing Pin Indicator */}
        <div className="absolute top-[35%] left-[45%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <span className="relative flex h-8 w-8">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-8 w-8 bg-teal-500 border-2 border-white shadow-md items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-white"></span>
            </span>
          </span>
          <div className="mt-1 px-2.5 py-1 bg-teal-600 text-white font-semibold text-[10px] rounded-lg shadow-md leading-none whitespace-nowrap">
            当前位置
          </div>
        </div>
      </div>
      {/* END: MapBackground */}

      {/* BEGIN: NavigationHeader (Floating top panel bar) */}
      <header className="relative p-4 flex justify-between items-start z-10">
        <button 
          onClick={onNavigateBack}
          className="bg-white rounded-full p-2.5 shadow-lg active:scale-90 transition-transform" 
          data-purpose="back-button"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
          </svg>
        </button>
        <div 
          onClick={() => setShowQrModal(true)}
          className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform border border-teal-500/10 hover:bg-teal-50/50" 
          data-purpose="qr-order-trigger"
        >
          <QrCode className="w-3.5 h-3.5 text-[#189F95]" />
          <span className="text-xs font-bold text-gray-700">二维码创单</span>
        </div>
      </header>
      {/* END: NavigationHeader */}

      {/* BEGIN: MapMarkerSection */}
      <main className="flex-grow relative z-10 flex flex-col justify-between">
        
        {/* Center Map Marker (Static pin indicator in center) */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center" data-purpose="pickup-location-marker">
          <div className="bg-white px-3.5 py-1.5 rounded-lg shadow-xl border border-gray-100 mb-1 whitespace-nowrap flex items-center gap-1.5 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-[#189F95]"></span>
            {isEditingStart ? (
              <input
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                onBlur={() => setIsEditingStart(false)}
                autoFocus
                className="text-xs font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:outline-hidden p-0 max-w-[140px]"
              />
            ) : (
              <span 
                onClick={() => setIsEditingStart(true)}
                className="text-xs font-black text-gray-800 cursor-pointer hover:underline"
              >
                {startLocation}
              </span>
            )}
          </div>
          <div className="w-0.5 h-6 bg-black shadow-lg"></div>
          <div className="w-2 h-2 bg-black rounded-full -mt-1 shadow-md"></div>
        </div>

        {/* Spacer for filling up remaining section */}
        <div className="flex-grow"></div>

        {/* Map Action Buttons (Floating above the bottom sheet) */}
        <div className="w-full px-4 mb-4 flex justify-between items-end gap-2" data-purpose="map-tools">
          <div className="flex gap-2">
            <button 
              onClick={() => alert(`当前代驾规则模板：${billingRules.templateName}`)}
              className="bg-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1 active:scale-95 transition-transform text-gray-800"
            >
              <span>{billingRules.templateName}</span>
              <svg className="h-3 w-3 text-[#4dbfb3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>
            <button 
              id="weather-multiplier-trigger-button"
              type="button"
              onClick={() => {
                setTempMultiplier(weatherMultiplier);
                setShowMultiplierPicker(true);
              }}
              className="bg-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1 active:scale-95 transition-transform text-gray-800"
            >
              <span>恶劣天气 {weatherMultiplier.toFixed(1)}倍</span>
              <svg className="h-3 w-3 text-[#4dbfb3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>
          </div>
          <button 
            onClick={() => setStartLocation('兴庆区政府住宅区')}
            className="bg-white p-2.5 rounded-xl shadow-md active:scale-95 transition-transform" 
            data-purpose="re-center"
          >
            <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>
      </main>
      {/* END: MapMarkerSection */}

      {/* BEGIN: OrderDetailsCard */}
      <div className="bg-white rounded-t-3xl shadow-2xl z-20 px-6 pt-5 pb-6 shrink-0 border-t border-gray-100" data-purpose="order-form-container">
        {scanSuccessMsg && (
          <div className="mb-4 bg-teal-50 border border-teal-200 rounded-2xl p-3.5 flex items-center justify-between animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-black text-teal-900 leading-normal">
                  扫码成功并安全连线！
                </span>
                <span className="text-[10px] text-teal-600 font-sans leading-tight">
                  已接收乘客下单地址，点击下方「创建订单」即开启行驶计费
                </span>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setScanSuccessMsg(false)}
              className="text-teal-500 hover:text-teal-700 text-xs font-bold font-sans px-2.5 py-1 bg-white rounded-lg border border-teal-100 shadow-xs"
            >
              知道了
            </button>
          </div>
        )}
        
        {/* Pickup and Destination Inputs */}
        <div className="space-y-3">
          
          {/* Pickup Point Row */}
          <div className="flex items-center gap-3 py-2 border-b border-gray-100">
            <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full shrink-0"></div>
            <div className="flex-grow flex items-center justify-between overflow-hidden">
              <span className="text-gray-400 text-xs shrink-0">出发地</span>
              <div className="flex items-center text-cyan-700 font-bold ml-2 text-sm overflow-hidden select-text">
                <span className="truncate">{startLocation}</span>
                <svg className="h-4 w-4 ml-1 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Destination Input Row */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-2.5 border border-transparent focus-within:border-teal-500/30 focus-within:bg-white transition-all">
            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0"></div>
            <input 
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-gray-800 flex-grow placeholder:text-gray-400 placeholder:font-normal focus:outline-hidden" 
              placeholder="请填写目的地（选填）" 
            />
          </div>

          {/* Phone Number Input Row */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-2.5 border border-transparent focus-within:border-teal-500/30 focus-within:bg-white transition-all">
            <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <input 
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-gray-800 flex-grow placeholder:text-gray-400 placeholder:font-normal focus:outline-hidden" 
              placeholder="客户手机号（选填）" 
            />
          </div>

        </div>

        {/* Price and Submit Action Row */}
        <div className="mt-5 flex items-center justify-between">
          <div data-purpose="price-estimation" className="text-left">
            <div className="flex items-baseline leading-none">
              <span className="text-gray-500 text-[11px] font-semibold mr-1.5">预估费用</span>
              <span className="text-orange-500 font-bold text-sm">¥</span>
              <span className="text-orange-500 font-black text-3xl ml-0.5 tracking-tight">
                {estimatedPrice.toFixed(2)}
              </span>
            </div>
            <p className="text-gray-400 text-[10px] scale-95 origin-left mt-1 font-medium">
              {isEstimated ? `(起步价包含 ${billingRules.slots[0]?.includedDistance ?? 7} 公里)` : '(选择终点后，可预估起步价)'}
            </p>
          </div>
          
          <button 
            onClick={handleCreateOrder}
            className="bg-[#189F95] hover:bg-[#158C83] text-white px-8 py-3.5 rounded-xl font-bold text-base active:scale-95 shadow-md shadow-[#189F95]/25 transition-all" 
            data-purpose="submit-order"
          >
            创建订单
          </button>
        </div>

      </div>
      {/* END: OrderDetailsCard */}

      {/* Custom Weather Multiplier Picker Dialog */}
      {showMultiplierPicker && (
        <div 
          id="weather-multiplier-picker-backdrop"
          className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end animate-in fade-in duration-200 animate-duration-200"
          onClick={() => {
            setShowMultiplierPicker(false);
          }}
        >
          <div 
            id="weather-multiplier-picker-card"
            className="bg-white rounded-t-[24px] px-6 pt-3 pb-8 flex flex-col space-y-4 animate-in slide-in-from-bottom duration-250 cursor-default relative text-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS style drag handle indicator */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-1" />
            
            <div className="text-center">
              <p className="text-[17px] font-bold text-gray-800 font-sans">请选择恶劣天气加价倍数</p>
              <p className="text-xs text-gray-400 mt-1 font-sans">请上下滑动选择天气加价系数（1.0倍 ~ 2.0倍）</p>
            </div>

            {/* Scrolling picker wheel section */}
            <div className="relative h-[200px] overflow-hidden my-2 flex justify-center items-center bg-gray-50/50 rounded-2xl border border-gray-100">
              {/* Highlight Overlay representing chosen item */}
              <div className="absolute inset-x-0 top-[80px] h-[40px] bg-[#eefaf8]/60 border-y border-[#189F95]/30 pointer-events-none z-10 mx-6 rounded-xl" />
              
              <div 
                ref={multiplierScrollRef}
                onScroll={handleMultiplierScroll}
                className="h-full w-full overflow-y-auto scrollbar-none scroll-smooth snap-y snap-mandatory relative"
                style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
              >
                <div className="h-[80px] pointer-events-none" />

                {MULTIPLIER_OPTIONS.map((val, idx) => {
                  const isSelected = tempMultiplier === val;
                  return (
                    <div
                      key={`mul-${val}`}
                      onClick={() => {
                        if (multiplierScrollRef.current) {
                          multiplierScrollRef.current.scrollTo({
                            top: idx * 40,
                            behavior: 'smooth'
                          });
                        }
                      }}
                      className={`h-[40px] flex items-center justify-center text-sm font-semibold transition-all duration-150 cursor-pointer snap-center ${
                        isSelected 
                          ? 'text-[#189F95] font-black text-base scale-110' 
                          : 'text-gray-400 opacity-60 scale-95 hover:text-gray-600'
                      }`}
                    >
                      {val.toFixed(1)} 倍
                    </div>
                  );
                })}

                <div className="h-[80px] pointer-events-none" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                id="weather-multiplier-cancel-button"
                type="button"
                onClick={() => {
                  setShowMultiplierPicker(false);
                }}
                className="flex-1 py-3 text-center text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-sans"
              >
                取消
              </button>
              <button
                id="weather-multiplier-confirm-button"
                type="button"
                onClick={() => {
                  setWeatherMultiplier(tempMultiplier);
                  setShowMultiplierPicker(false);
                }}
                className="flex-1 py-3 text-center text-sm font-bold text-white bg-[#189F95] rounded-xl hover:bg-[#158C83] transition-colors shadow-xs font-sans"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEGIN: Live-Updating QR Code Order Modal Dialogue */}
      {showQrModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-[325px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col items-center p-6 space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Modal Title Header Banner */}
            <div className="text-center space-y-1 w-full pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900 flex items-center justify-center gap-1.5">
                <QrCode className="w-5 h-5 text-[#189F95]" />
                乘客扫码自助创单
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                请向乘客出示下方二维码扫码呼叫
              </p>
            </div>

            {/* Dynamic Generating QR Code representation */}
            <div className="relative flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-gray-150">
              <SvgQrCode seed={qrUpdateCount} url={passengerScanUrl} />
              
              <div className="mt-3.5 flex items-center gap-2 text-xs text-slate-500 font-sans font-semibold">
                <Clock className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                <span>二维码有效时间：</span>
                <span className="font-mono text-orange-500 font-black text-xs bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                  {formatCountdown(qrCountdown)}
                </span>
              </div>
            </div>

            {/* Guideline text blocks */}
            <div className="text-left text-[11px] bg-slate-50/70 border border-slate-100/80 p-3.5 rounded-xl space-y-2 text-slate-500 leading-relaxed font-sans font-medium">
              <div className="flex items-start gap-1.5">
                <span className="text-[#189F95] font-black">•</span>
                <span>乘客使用微信或支付宝扫描上方二维码自动授权与填单。</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#189F95] font-black">•</span>
                <span>每过 <span className="font-bold text-orange-500">3分钟</span> 二维码将自动更新，安全防作弊，请及时核查。</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#189F95] font-black">•</span>
                <span>扫码匹配连线完成后，即可点击下方按钮快速一键代下单。</span>
              </div>
            </div>



            {/* Actions Panel */}
            <div className="w-full flex flex-col gap-2 pt-1 font-sans">
              <button
                type="button"
                onClick={() => {
                  setShowSimulatedScanner(true);
                }}
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-black text-sm tracking-wide shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
              >
                📱 模拟手机端扫码 (中国大陆免翻墙)
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhoneNumber('186-0951-8888');
                  setDestination('新百大楼(解放东街-2号门)');
                  setScanSuccessMsg(true);
                  setShowQrModal(false);
                }}
                className="w-full py-2 bg-[#189F95]/10 hover:bg-[#189F95]/20 text-[#189F95] rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-1 active:scale-[0.98] transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                仅快速一键填入模拟数据
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowQrModal(false);
                }}
                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-semibold text-xs tracking-wide active:scale-[0.98] transition-transform cursor-pointer"
              >
                关闭返回
              </button>
            </div>

          </div>
         </div>
       )}

       {/* IN-APP REAL-TIME SIMULATION PANEL (Exposes Passenger view inside a Phone Frame for Mainland China Devs) */}
       {showSimulatedScanner && (
         <div className="absolute inset-0 bg-[#07080b]/95 z-[60] flex flex-col items-center justify-center p-2 animate-in fade-in duration-300">
           <div className="w-full max-w-[360px] h-[92vh] bg-[#07080b] rounded-[32px] border-4 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
             
             {/* Simulated Notch / Speaker bar for aesthetics */}
             <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 flex items-center justify-center z-50">
               <div className="w-24 h-4 bg-black rounded-b-xl flex items-center justify-center">
                 <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
               </div>
             </div>

             <div className="flex-1 pt-6 overflow-y-auto">
               <PassengerOrderView
                 driverPhone={userPhone || '18609518888'}
                 onClose={() => {
                   setShowSimulatedScanner(false);
                 }}
               />
             </div>

             {/* Close Button overlay */}
             <button
               type="button"
               onClick={() => setShowSimulatedScanner(false)}
               className="absolute top-8 right-4 z-50 bg-slate-900/80 hover:bg-slate-950 text-slate-400 p-2 rounded-full border border-slate-800 flex items-center justify-center w-8 h-8 cursor-pointer"
             >
               ✕
             </button>
             
           </div>
         </div>
       )}

    </div>
  );
}
