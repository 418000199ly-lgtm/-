import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Users, 
  ClipboardCheck, 
  ClipboardList, 
  Settings, 
  QrCode, 
  MessageSquare, 
  MapPin, 
  Bell, 
  AlertCircle,
  Play,
  X,
  ChevronRight,
  Gift,
  Crown,
  Edit2,
  LogOut,
  User,
  Globe,
  UploadCloud,
  FileCheck2,
  Lock,
  Stamp,
  UserCheck2,
  CheckCircle2,
  Flame,
  Camera,
  Clock
} from 'lucide-react';
import { ChauffeurSettings, DriverStats, TripState, BillingRules, checkVipActive } from '../types';
import DriverIllustration from './DriverIllustration';
import { db, doc, getDoc, updateDoc, collection, onSnapshot, setDoc, getDocs } from '../lib/dbProxy';
import { CITY_GROUPS, ALL_CITIES_FLAT } from '../constants/cities';
import { resolveAndSyncDuplicateNames } from '../utils/nameResolver';

interface HomeViewProps {
  settings: ChauffeurSettings;
  stats: DriverStats;
  currentTrip: TripState | null;
  billingRules: BillingRules;
  onNavigate: (view: string) => void;
  onStartTrip: (trip: TripState) => void;
  onUpdateStats: (update: Partial<DriverStats>) => void;
  onToggleOnline: (isOnline: boolean) => void;
  isOnline: boolean;
  onUpdateSettings: (updated: ChauffeurSettings) => void;
  userPhone?: string | null;
  onLogout?: () => void;
}

export default function HomeView({
  settings,
  stats,
  currentTrip,
  billingRules,
  onNavigate,
  onStartTrip,
  onUpdateStats,
  onToggleOnline,
  isOnline,
  onUpdateSettings,
  userPhone,
  onLogout
}: HomeViewProps) {
  const [sliderPos, setSliderPos] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [onlineTime, setOnlineTime] = useState(0);
  const touchStartRef = useRef<number>(0);
  const sliderWidthRef = useRef<HTMLDivElement>(null);

  // User Profile dialog state
  const [showUserModal, setShowUserModal] = useState(false);

  // Redemption code states
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Custom App Name states
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // System messages and unread management
  const [dbMessages, setDbMessages] = useState<any[]>([]);
  const [viewedMessageIds, setViewedMessageIds] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('dd_viewed_message_ids');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [showMessagesModal, setShowMessagesModal] = useState(false);

  // --- Online Application States & Real-time Subscription ---
  const [showOnlineAppModal, setShowOnlineAppModal] = useState(false);
  const [isCityDispatchEnabled, setIsCityDispatchEnabled] = useState<boolean | null>(null);
  const [onlineApp, setOnlineApp] = useState<any>(null);
  const [loadingApp, setLoadingApp] = useState(false);
  const [localAlert, setLocalAlert] = useState<{ title: string; message: string; type?: 'warning' | 'info' | 'success' } | null>(null);

  // Form Fields
  const [applicantName, setApplicantName] = useState('');
  const [applicantGender, setApplicantGender] = useState('男');
  const [applicantAge, setApplicantAge] = useState('');
  const [applicantEmergencyPhone, setApplicantEmergencyPhone] = useState('');
  const [applicantDrivingYears, setApplicantDrivingYears] = useState('');
  const [applicantCity, setApplicantCity] = useState('');
  const [idCardFront, setIdCardFront] = useState('');
  const [idCardBack, setIdCardBack] = useState('');
  const [driverLicenseFront, setDriverLicenseFront] = useState('');
  const [driverLicenseBack, setDriverLicenseBack] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // City Selector Dialog search query
  const [searchCityQuery, setSearchCityQuery] = useState('');
  const [showCitySelector, setShowCitySelector] = useState(false);

  // Subscribe to `/online_applications/{userPhone}`
  useEffect(() => {
    if (!userPhone) return;
    setLoadingApp(true);
    const docRef = doc(db, 'online_applications', userPhone);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const appData = docSnap.data();
        setOnlineApp({ id: docSnap.id, ...appData });
        if (appData) {
          setApplicantName(appData.driverName || '');
          setApplicantGender(appData.driverGender || '男');
          setApplicantAge(String(appData.driverAge || ''));
          setApplicantEmergencyPhone(appData.emergencyPhone || '');
          setApplicantDrivingYears(String(appData.drivingYears || ''));
          setApplicantCity(appData.city || '');
          setIdCardFront(appData.idCardFront || '');
          setIdCardBack(appData.idCardBack || '');
          setDriverLicenseFront(appData.driverLicenseFront || '');
          setDriverLicenseBack(appData.driverLicenseBack || '');
        }
      } else {
        setOnlineApp(null);
        setApplicantName('');
        setApplicantGender('男');
        setApplicantAge('');
        setApplicantEmergencyPhone('');
        setApplicantDrivingYears('');
        setApplicantCity('');
        setIdCardFront('');
        setIdCardBack('');
        setDriverLicenseFront('');
        setDriverLicenseBack('');
      }
      setLoadingApp(false);
    }, (err) => {
      console.error("Error listening to online applications:", err);
      setLoadingApp(false);
    });
    return () => unsubscribe();
  }, [userPhone]);

  // Subscribe to city dispatch config gate
  useEffect(() => {
    let city = settings?.city || onlineApp?.city || '银川市';
    if (city && !city.endsWith('市')) {
      city = city + '市';
    }
    const docRef = doc(db, 'city_dispatch_config', city);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsCityDispatchEnabled(!!data.enabled);
      } else {
        setIsCityDispatchEnabled(false);
      }
    }, (error) => {
      console.warn("Failed to subscribe city dispatch config:", error);
      setIsCityDispatchEnabled(false);
    });
    return () => unsubscribe();
  }, [settings?.city, onlineApp?.city]);

  // Subscribe to messages in Firestore
  useEffect(() => {
    const q = collection(db, 'messages');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort descending by createdAt
      list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setDbMessages(list);
    }, (err) => {
      console.error("Error listening to messages in HomeView:", err);
    });
    return () => unsubscribe();
  }, []);

  // Filter messages relevant to this user (either 'all' or specifically matched targetPhone)
  const userMessages = dbMessages.filter(msg => {
    const target = msg.targetPhone || 'all';
    return target === 'all' || (userPhone && target === userPhone);
  });

  const unreadMessages = userMessages.filter(msg => !viewedMessageIds.includes(msg.id));

  // Real-time audio broadcast and visual alert for newly received system messages
  const lastMessageCountRef = useRef(userMessages.length);
  useEffect(() => {
    if (userMessages.length > lastMessageCountRef.current) {
      // Find the newly added message on top of the list
      const latestMessage = userMessages[0];
      if (latestMessage && !viewedMessageIds.includes(latestMessage.id)) {
        // Trigger speech voice announcement if enabled
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && settings.voiceBroadcast === '开单语音播报') {
          try {
            const utter = new SpeechSynthesisUtterance(`收到系统最新通知公告：${latestMessage.title}`);
            utter.lang = 'zh-CN';
            window.speechSynthesis.speak(utter);
          } catch(e){}
        }
      }
    }
    lastMessageCountRef.current = userMessages.length;
  }, [userMessages, viewedMessageIds, settings.voiceBroadcast]);

  const handleMarkAllRead = () => {
    const allIds = userMessages.map(m => m.id);
    setViewedMessageIds(allIds);
    localStorage.setItem('dd_viewed_message_ids', JSON.stringify(allIds));
  };

  const handleMarkSingleRead = (id: string) => {
    if (!viewedMessageIds.includes(id)) {
      const next = [...viewedMessageIds, id];
      setViewedMessageIds(next);
      localStorage.setItem('dd_viewed_message_ids', JSON.stringify(next));
    }
  };

  // Online active clock simulator
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOnline) {
      interval = setInterval(() => {
        setOnlineTime(prev => prev + 1);
      }, 1000);
    } else {
      setOnlineTime(0);
    }
    return () => clearInterval(interval);
  }, [isOnline]);

  // Slider controls (simulated drag)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (currentTrip) return; // Cannot toggle while in trip
    touchStartRef.current = e.touches[0].clientX;
    setIsSliding(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSliding) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current;
    if (sliderWidthRef.current) {
      const maxSlide = sliderWidthRef.current.clientWidth - 56; // handle width is 56px
      let newPos = Math.max(0, Math.min(deltaX, maxSlide));
      setSliderPos(newPos);
    }
  };

  const handleTouchEnd = () => {
    setIsSliding(false);
    if (sliderWidthRef.current) {
      const maxSlide = sliderWidthRef.current.clientWidth - 56;
      if (sliderPos > maxSlide * 0.7) {
        if (!isOnline) {
          if (settings.isBanned) {
            alert("⚠️ 无法上线！因账户违规，您的账号已被管理员封停。封停期间无法上线听单或接单！");
            setSliderPos(0);
            return;
          }
          const isVip = checkVipActive(settings.vipExpiry);
          if (!isVip && stats.todayOrders >= 2) {
            alert('🔒 提示：非VIP会员每日限制报单次数已用完（每天限额2次，明早6:00自动恢复，激活VIP解除限制）。');
            setSliderPos(0);
            return;
          }
        }
        // Trigger Toggle Online
        onToggleOnline(!isOnline);
        // Play notification
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && settings.voiceBroadcast === '开单语音播报') {
          try {
            const text = !isOnline ? '您已上线，点击报单创建订单' : '您已下线，期待为您下一次服务';
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'zh-CN';
            window.speechSynthesis.speak(utter);
          } catch(e){}
        }
      }
    }
    setSliderPos(0);
  };

  // Support responsive slide simulation on mouse click for desktop previews
  const handleSlideToggleClick = () => {
    if (currentTrip) return;
    if (!isOnline) {
      if (settings.isBanned) {
        alert("⚠️ 无法上线！因账户违规，您的账号已被管理员封停。封停期间无法上线听单或接单！");
        return;
      }
      const isVip = checkVipActive(settings.vipExpiry);
      if (!isVip && stats.todayOrders >= 2) {
        alert('🔒 提示：非VIP会员每日限制报单次数已用完（每天限额2次，明早6:00自动恢复，激活VIP解除限制）。');
        return;
      }
    }
    onToggleOnline(!isOnline);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && settings.voiceBroadcast === '开单语音播报') {
      try {
        const text = !isOnline ? '您已上线，点击报单创建订单' : '您已下线，期待为您下一次服务';
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'zh-CN';
        window.speechSynthesis.speak(utter);
      } catch(e){}
    }
  };

  // --- Online dispatch orders application helper methods ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      alert("⚠️ 读取图片失败，请重试！");
    };
    reader.readAsDataURL(file);
  };

  const handleSimulatePhoto = (type: string, setter: (val: string) => void) => {
    const name = applicantName.trim() || '司马小光';
    const phone = userPhone || '';
    let svgString = '';
    
    if (type === 'id_front') {
      svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190">
        <rect width="300" height="190" rx="12" fill="#eef3f9" stroke="#cbd5e1" stroke-width="2"/>
        <rect x="15" y="15" width="270" height="160" rx="6" fill="#f8fafc"/>
        <text x="30" y="45" font-family="sans-serif" font-size="12" font-weight="900" fill="#1e293b">姓名：${name}</text>
        <text x="30" y="70" font-family="sans-serif" font-size="11" fill="#475569">性别：${applicantGender}    民族：汉</text>
        <text x="30" y="95" font-family="sans-serif" font-size="11" fill="#475569">出生：1994年08月12日</text>
        <text x="30" y="120" font-family="sans-serif" font-size="11" fill="#475569">住址：北京市海淀区中关村南大街1号</text>
        <text x="30" y="155" font-family="sans-serif" font-size="12" font-weight="900" fill="#2563eb" font-mono="true">公民身份号码：110108199408128888</text>
        <rect x="200" y="40" width="70" height="85" rx="4" fill="#cbd5e1" opacity="0.6"/>
        <circle cx="235" cy="70" r="18" fill="#94a3b8"/>
        <path d="M210 120 C210 100, 260 100, 260 120 Z" fill="#94a3b8"/>
      </svg>`;
    } else if (type === 'id_back') {
      svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190">
        <rect width="300" height="190" rx="12" fill="#eef3f9" stroke="#cbd5e1" stroke-width="2"/>
        <rect x="15" y="15" width="270" height="160" rx="6" fill="#f8fafc"/>
        <circle cx="65" cy="95" r="30" fill="none" stroke="#ef4444" stroke-width="2"/>
        <text x="120" y="85" font-family="sans-serif" font-size="13" font-weight="bold" fill="#1e293b">中华人民共和国</text>
        <text x="120" y="110" font-family="sans-serif" font-size="15" font-weight="900" fill="#1e293b" letter-spacing="2">居民身份证</text>
        <text x="45" y="155" font-family="sans-serif" font-size="9" fill="#64748b">签发机关：北京市公安局海淀分局</text>
        <text x="45" y="170" font-family="sans-serif" font-size="9" fill="#64748b">有效期限：2020.08.12 - 2040.08.12</text>
      </svg>`;
    } else if (type === 'license_front') {
      svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190">
        <rect width="300" height="190" rx="12" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
        <rect x="15" y="15" width="270" height="160" rx="6" fill="#0f172a"/>
        <rect x="20" y="20" width="260" height="150" rx="4" fill="#f8fafc" stroke="#e2e8f0"/>
        <text x="35" y="42" font-family="sans-serif" font-size="12" font-weight="900" fill="#ef4444">中华人民共和国机动车驾驶证</text>
        <text x="35" y="65" font-family="sans-serif" font-size="10" fill="#475569">证号：110108199408128888</text>
        <text x="35" y="85" font-family="sans-serif" font-size="10" fill="#475569">姓名：${name}</text>
        <text x="35" y="105" font-family="sans-serif" font-size="10" fill="#475569">国籍：中国    性别：${applicantGender}</text>
        <text x="35" y="125" font-family="sans-serif" font-size="10" fill="#475569">准驾车型：C1</text>
        <text x="35" y="145" font-family="sans-serif" font-size="9" fill="#475569">初次领证日期：2016-05-18</text>
        <rect x="205" y="60" width="60" height="75" rx="3" fill="#e2e8f0" stroke="#cbd5e1"/>
        <circle cx="235" cy="85" r="14" fill="#94a3b8"/>
        <path d="M215 125 C215 110, 255 110, 255 125 Z" fill="#94a3b8"/>
      </svg>`;
    } else {
      svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190">
        <rect width="300" height="190" rx="12" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
        <rect x="15" y="15" width="270" height="160" rx="6" fill="#f8fafc"/>
        <text x="35" y="45" font-family="sans-serif" font-size="12" font-weight="900" fill="#1e293b">中华人民共和国机动车驾驶证副页</text>
        <text x="35" y="75" font-family="sans-serif" font-size="10" fill="#475569">证号：110108199408128888</text>
        <text x="35" y="100" font-family="sans-serif" font-size="10" fill="#475569">姓名：${name}</text>
        <text x="35" y="125" font-family="sans-serif" font-size="10" fill="#475569">档案编号：110000888888</text>
        <text x="35" y="150" font-family="sans-serif" font-size="9" fill="#ef4444">记录：实习期满，请于2036年换发10年有效驾驶证</text>
      </svg>`;
    }
    
    const base64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    setter(base64);
  };

  const handleAutoFillAndSimulate = () => {
    setApplicantName('张大帅');
    setApplicantGender('男');
    setApplicantAge('32');
    setApplicantEmergencyPhone('13812345678');
    setApplicantDrivingYears('10');
    setApplicantCity('上海');
    
    handleSimulatePhoto('id_front', setIdCardFront);
    handleSimulatePhoto('id_back', setIdCardBack);
    handleSimulatePhoto('license_front', setDriverLicenseFront);
    handleSimulatePhoto('license_back', setDriverLicenseBack);
  };

  const handleOnlineAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPhone) return;
    
    const name = applicantName.trim();
    const gender = applicantGender;
    const age = parseInt(applicantAge, 10);
    const emgPhone = applicantEmergencyPhone.trim();
    const dYears = parseInt(applicantDrivingYears, 10);
    const city = applicantCity.trim();
    
    if (!name || !gender || isNaN(age) || !emgPhone || isNaN(dYears) || !city || !idCardFront || !idCardBack || !driverLicenseFront || !driverLicenseBack) {
      alert("⚠️ 提交失败：请完整填写履历表单、选择开通城市并准备好全部实名证照影像！");
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(emgPhone)) {
      alert("⚠️ 请输入有效的11位紧急联系人手机号！");
      return;
    }
    
    setSubmittingApp(true);
    try {
      await setDoc(doc(db, 'online_applications', userPhone), {
        driverPhone: userPhone,
        driverName: name,
        driverGender: gender,
        driverAge: age,
        emergencyPhone: emgPhone,
        drivingYears: dYears,
        city,
        idCardFront,
        idCardBack,
        driverLicenseFront,
        driverLicenseBack,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Run real-time naming conflict suffix resolution
      await resolveAndSyncDuplicateNames();

      alert("🎉 申请提交成功！各项资料已实时安全同步至决策大盘运营管理后台，等待管理员审批核对，可在后台「审批功能」页查看其处理状态。");
    } catch (err: any) {
      console.error("Error submitting driver application:", err);
      alert("提交失败：" + err.message);
    } finally {
      setSubmittingApp(false);
    }
  };

  const formatOnlineTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleRedeemSubmit = async () => {
    const codeValue = redeemCode.trim().toUpperCase();
    if (!codeValue) {
      setModalMessage({ type: 'error', text: '请输入有效的兑换码/验证卡密！' });
      return;
    }
    
    setIsMatching(true);
    setModalMessage(null);
    
    try {
      const docRef = doc(db, 'vip_codes', codeValue);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setModalMessage({ 
          type: 'error', 
          text: '❌ 匹配失败：该兑换码/充值卡密不存在或已被撤销。请从右侧决策管理后台「一键极速批产」生成真实卡密粘贴至此处！' 
        });
        setIsMatching(false);
        return;
      }

      const codeData = docSnap.data();
      if (codeData.isRedeemed) {
        setModalMessage({ 
          type: 'error', 
          text: '❌ 激活失败：该兑换码已被使用过，无法重复兑换！' 
        });
        setIsMatching(false);
        return;
      }

      const durationDays = codeData.duration || 30;

      // Calculate next expiry
      let currentExpiryDate = new Date();
      if (settings.vipExpiry && settings.vipExpiry !== '永久有效') {
        const parsed = Date.parse(settings.vipExpiry);
        if (!isNaN(parsed)) {
          const prevDate = new Date(parsed);
          if (prevDate.getTime() > currentExpiryDate.getTime()) {
            currentExpiryDate = prevDate;
          }
        }
      }

      currentExpiryDate.setDate(currentExpiryDate.getDate() + durationDays);
      const yyyy = currentExpiryDate.getFullYear();
      const mm = String(currentExpiryDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentExpiryDate.getDate()).padStart(2, '0');
      const finalExpiryStr = `${yyyy}-${mm}-${dd}`;

      // Update Firestore document to mark as redeemed
      await updateDoc(docRef, {
        isRedeemed: true,
        redeemedAt: new Date().toISOString(),
        redeemedBy: settings.customAppName?.trim() || '手机APP司机端'
      });

      // Update settings locally
      onUpdateSettings({
        ...settings,
        vipExpiry: finalExpiryStr
      });

      setModalMessage({
        type: 'success',
        text: `🎉 云端兑换成功！您的软件尊享会员已成功续期 +${durationDays} 天！新有效期至：${finalExpiryStr}`
      });
      setRedeemCode('');
    } catch (e: any) {
      console.error(e);
      setModalMessage({ 
        type: 'error', 
        text: '❌ 连接云数据库出现异常: ' + e.message 
      });
    } finally {
      setIsMatching(false);
    }
  };

  const getVipCountdown = () => {
    if (!settings.vipExpiry) {
      return { 
        text: '未激活', 
        daysText: '未激活', 
        colorClass: 'text-slate-400 bg-slate-100 border border-slate-200 font-semibold text-[10px]', 
        subColor: 'text-slate-400', 
        badgeText: '待激活' 
      };
    }
    if (settings.vipExpiry === '永久有效') {
      return { 
        text: '永久', 
        daysText: '永久', 
        colorClass: 'text-amber-600 bg-gradient-to-tr from-amber-100 to-yellow-100 border border-amber-300 font-extrabold text-[11px] shadow-xs animate-subtle-glow', 
        subColor: 'text-amber-600 font-bold', 
        badgeText: '终身' 
      };
    }
    try {
      const expDate = new Date(settings.vipExpiry);
      const now = new Date();
      expDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        return { 
          text: '已过期', 
          daysText: '0天', 
          colorClass: 'text-red-500 bg-red-50 border border-red-200 font-bold text-[11px]', 
          subColor: 'text-slate-400', 
          badgeText: '已过期' 
        };
      }
      return { 
        text: `${diffDays}天`, 
        daysText: `${diffDays}天`, 
        colorClass: 'text-amber-600 bg-amber-50 border border-amber-200 font-bold font-mono text-[11px] shadow-xs', 
        subColor: 'text-amber-600 font-bold',
        badgeText: '已授权'
      };
    } catch {
      return { 
        text: '错误', 
        daysText: '未知', 
        colorClass: 'text-slate-400 bg-slate-50 border border-slate-200 font-semibold text-[10px]', 
        subColor: 'text-slate-400', 
        badgeText: '未知' 
      };
    }
  };

  const vipInfo = getVipCountdown();

  return (
    <div className="flex-1 flex flex-col justify-between h-full select-none bg-slate-100">
      
      {/* 1. Header (Dark Navy Section - Custom colorways supported) */}
      <div className={`pt-6 pb-12 px-6 rounded-b-[32px] shadow-lg relative transition-all duration-300 ${
        settings.homepageColorway === 'blue' ? 'bg-[#1e3a8a]' :
        settings.homepageColorway === 'slate' ? 'bg-[#334155]' : 'bg-[#273046]'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              {(() => {
                const isVipActive = checkVipActive(settings.vipExpiry);
                const currentDisplayName = isVipActive ? (settings.customAppName?.trim() || 'XX代驾') : 'XX代驾';
                
                const handleSaveName = () => {
                  setIsEditingName(false);
                  onUpdateSettings({
                    ...settings,
                    customAppName: tempName.trim()
                  });
                };
                
                if (isVipActive) {
                  if (isEditingName) {
                    return (
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') setIsEditingName(false);
                        }}
                        maxLength={10}
                        className="bg-white/15 text-white border border-white/30 rounded-lg px-2 py-0.5 text-sm font-bold focus:outline-hidden focus:ring-1 focus:ring-amber-400 w-28 text-center"
                        autoFocus
                      />
                    );
                  } else {
                    return (
                      <span 
                        onClick={() => {
                          setTempName(currentDisplayName);
                          setIsEditingName(true);
                        }}
                        className="text-white text-xl font-bold tracking-tight cursor-pointer hover:text-amber-200 inline-flex items-center group transition-colors select-none"
                        title="点击修改代驾品牌名称"
                      >
                        {currentDisplayName}
                      </span>
                    );
                  }
                } else {
                  return (
                    <span 
                      onClick={() => {
                        setModalMessage({
                          type: 'error',
                          text: '🔒 提示：自定义品牌名称为VIP会员专属特权！激活VIP后即可一键修改。'
                        });
                        setShowRedeemModal(true);
                        setRedeemCode('');
                      }}
                      className="text-white text-xl font-bold tracking-tight cursor-pointer hover:text-white/80 transition-opacity select-none"
                      title="激活VIP解锁自定义名称"
                    >
                      {currentDisplayName}
                    </span>
                  );
                }
              })()}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isOnline ? 'bg-emerald-500 text-white' : 'bg-slate-500/40 text-slate-300'
              }`}>
                {isOnline ? '正在听单' : '离线状态'}
              </span>

            </div>
            {/* VIP/membership status banner is hidden per user request */}
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowMessagesModal(true)}
              className="relative p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              title="系统消息"
            >
              <MessageSquare className="w-5 h-5 text-gray-100" />
              {unreadMessages.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-[#273046]"></span>
              )}
            </button>
            <button 
              id="user-avatar-btn"
              onClick={() => setShowUserModal(true)}
              className="w-9 h-9 rounded-full border border-slate-300 bg-slate-200 hover:bg-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm"
              title="用户中心"
            >
              <User className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Work stats display slots (exactly matching Screenshot 4 layout) */}
        <div className="grid grid-cols-3 gap-2 text-center text-white mt-2">
          <div>
            <div className="text-3xl font-bold font-display tracking-tight text-white mb-1">
              {stats.todayOrders}
            </div>
            <div className="text-[11px] text-gray-300 font-medium">今日成单</div>
          </div>
          <div>
            <div className="text-3xl font-bold font-display tracking-tight text-amber-400 mb-1">
              {stats.todayIncome.toFixed(2)}
            </div>
            <div className="text-[11px] text-gray-300 font-medium">今日收入</div>
          </div>
          <div>
            <div className="text-3xl font-bold font-display tracking-tight text-teal-300 mb-1">
              {stats.myPoints}
            </div>
            <div className="text-[11px] text-gray-300 font-medium">总成单量</div>
          </div>
        </div>
      </div>

      {/* 2. Top menu cards (overlapping dark section) */}
      <div className="px-4 -translate-y-6 z-10" id="top-menu-grid-container">
        <div className="bg-white rounded-2xl shadow-md border border-[#ededed] p-3 grid grid-cols-5 gap-1.5 text-center">
          <button 
            onClick={() => {
              if (settings.homepageColorway === 'green') {
                alert('温馨提示：商城道具正在备货中，敬请期待！');
              } else {
                alert('已切换商城链接。');
              }
            }} 
            className="flex flex-col items-center justify-center group"
            id="menu-btn-buy"
          >
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 mb-1.5 transition-transform group-active:scale-95">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-gray-700 font-bold font-sans">购买</span>
          </button>

          <button 
            onClick={() => {
              setShowRedeemModal(true);
              setRedeemCode('');
              setModalMessage(null);
            }} 
            className="flex flex-col items-center justify-center group"
            id="menu-btn-redeem"
          >
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-1.5 transition-transform group-active:scale-95">
              <Gift className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-[10px] text-gray-700 font-bold font-sans">兑换码</span>
          </button>

          <div 
            className={`flex flex-col items-center justify-center cursor-default relative transition-all ${
              settings.vipExpiry ? '' : 'opacity-75'
            }`}
            id="menu-btn-vip"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all ${vipInfo.colorClass}`}>
              <span className="text-[9px] leading-tight text-center truncate font-extrabold font-sans">
                {vipInfo.daysText}
              </span>
            </div>
            <span className="text-[10px] text-gray-700 font-bold font-sans">有效期</span>
            <span className={`absolute -top-1 right-0 text-[8px] px-1 rounded-full scale-80 font-bold text-white ${
              settings.vipExpiry ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
            }`}>
              {vipInfo.badgeText}
            </span>
          </div>

          <button 
            onClick={() => {
              // If they are already approved/active, check if dispatch is disabled for their city.
              // If they are NOT approved yet (e.g. resigned or applying), allow them to open the modal to apply/re-apply.
              if (settings.onlineOrdersEnabled && isCityDispatchEnabled === false) {
                setLocalAlert({
                  title: '服务未开通',
                  message: '您所在的城市未开通服务',
                  type: 'warning'
                });
                return;
              }
              setShowOnlineAppModal(true);
            }} 
            className="flex flex-col items-center justify-center group select-none relative"
            id="menu-btn-online-orders"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all duration-200 group-active:scale-95 ${
              (settings.onlineOrdersEnabled && isCityDispatchEnabled === false)
                ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-60'
                : settings.onlineOrdersEnabled 
                  ? 'bg-emerald-550 text-white shadow-xs border border-emerald-600' 
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {(settings.onlineOrdersEnabled && isCityDispatchEnabled === false) ? <Lock className="w-4 h-4 text-slate-400" /> : <Globe className="w-5 h-5" />}
            </div>
            <span className="text-[10px] text-gray-700 font-bold font-sans whitespace-nowrap">线上单开通</span>
            {(settings.onlineOrdersEnabled && isCityDispatchEnabled === false) ? (
              <span className="absolute -top-1 -right-1 text-[8px] bg-rose-500 text-white px-1 rounded-full font-black scale-85">已锁</span>
            ) : settings.onlineOrdersEnabled && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            )}
          </button>

          <button 
            onClick={() => {
              if (!settings.onlineOrdersEnabled) {
                setLocalAlert({
                  title: '听单未激活',
                  message: '提示：请先开挂/开通「线上单开通」服务，方可激活平台自动分派派单机制监测！',
                  type: 'info'
                });
                return;
              }
              setLocalAlert({
                title: '队列监测正常',
                message: '平台线上派单队列监测正常！当前无待处理推荐，请保持听单状态挂机等待。',
                type: 'success'
              });
            }}
            className={`flex flex-col items-center justify-center relative transition-all duration-200 group ${
              settings.onlineOrdersEnabled ? 'opacity-100' : 'opacity-40'
            }`}
            id="menu-btn-dispatch"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all duration-200 ${
              settings.onlineOrdersEnabled
                ? 'bg-teal-500 text-white shadow-xs group-active:scale-95' 
                : 'bg-teal-50 text-teal-600'
            }`}>
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-gray-500 font-bold font-sans">派单</span>
            {settings.onlineOrdersEnabled ? (
              <span className="absolute -top-1 -right-0.5 bg-red-500 text-white text-[8px] px-1 rounded-full scale-80 font-bold animate-pulse">待锁</span>
            ) : (
              <span className="absolute -top-1 -right-0.5 bg-slate-400 text-white text-[8px] px-1 rounded-full scale-80 font-bold">待锁</span>
            )}
          </button>
        </div>
      </div>

      {/* 2.5 New Message Tip Banner */}
      {unreadMessages.length > 0 && (
        <div 
          onClick={() => setShowMessagesModal(true)}
          className="mx-4 mb-4 bg-gradient-to-r from-pink-500/10 to-indigo-500/10 border border-indigo-250/60 hover:bg-indigo-500/15 py-2.5 px-4 rounded-xl flex items-center justify-between cursor-pointer animate-pulse shrink-0 transition-all active:scale-99"
          id="realtime-unread-messages-tip-banner"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            <p className="text-[11px] font-bold text-slate-800 truncate">
               📢 收到 {unreadMessages.length} 条管理后台发送的消息，点击立即查看！
            </p>
          </div>
          <span className="text-[9.5px] font-bold text-indigo-600 bg-white border border-indigo-150 rounded-lg px-2 py-0.5 whitespace-nowrap active:scale-95 shrink-0 shadow-xs">
            查阅 ➔
          </span>
        </div>
      )}

      {/* 3. Central Working Board / Simulated Dispatch Map Area */}
      <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col justify-center">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center flex-1 min-h-[220px] relative overflow-hidden transition-all">
          
          {isOnline ? (
            /* --- ONLINE STATE (Radar Matching, Screenshot 4 style layout) --- */
            <div className="flex flex-col items-center justify-center text-center w-full h-full relative">
              {/* Pulsing Radar Ring Effects */}
              <div className="relative w-36 h-36 flex items-center justify-center mb-4">
                <div className="absolute inset-0 rounded-full bg-teal-500/10 ping-slow"></div>
                <div className="absolute inset-2 rounded-full bg-teal-500/15 ping-slow" style={{ animationDelay: '0.6s' }}></div>
                <div className="absolute inset-6 rounded-full bg-teal-500/20 ping-slow" style={{ animationDelay: '1.2s' }}></div>
                <div className="w-16 h-16 rounded-full bg-teal-500/25 flex items-center justify-center border border-teal-500/30 text-teal-600">
                  <Bell className="w-7 h-7" />
                </div>
              </div>

              <div className="text-sm font-semibold text-gray-800 mb-1.5 tracking-wide">
                代驾系统已上线，请进行自助开单
              </div>
              
              <div className="text-xs text-slate-500 font-sans tracking-wide max-w-[260px] leading-relaxed">
                请点击右下角 <span className="text-teal-600 font-semibold">「报单」</span> 按钮，或扫描乘客端付款码安全开单计费
              </div>
              
              {/* Simulator Action Helper Trigger */}
              <div className="absolute bottom-1 right-1 text-[9px] text-gray-300 font-mono italic opacity-40">
                等待自主报单中...
              </div>
            </div>
          ) : (
            /* --- OFFLINE STATE (Cute Chauffeur mascot waving) --- */
            <div className="text-center flex flex-col items-center justify-center">
              <DriverIllustration size={160} className="mb-4" />
              <h3 className="text-base font-semibold text-gray-800 mb-1">您当前处于离线休息中</h3>
              <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
                温馨提示：只有上线状态才能使用报单功能
              </p>
            </div>
          )}
        </div>
      </div>



      {/* 5. Bottom System Controls (Matching Screen 4) */}
      <div className="bg-white border-t border-gray-200/80 px-4 py-3 flex items-center justify-between gap-3 shadow-inner">
        
        {/* Settings button on left side */}
        <button
          onClick={() => onNavigate('settings')}
          className="flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 w-14 h-13 rounded-xl border border-gray-200/60 transition-transform active:scale-95"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold text-slate-500">设置</span>
        </button>

        {/* Central Physical-styled slide-to-online switch */}
        <div 
          ref={sliderWidthRef}
          onClick={handleSlideToggleClick}
          className={`flex-1 relative h-13 rounded-2xl flex items-center justify-center overflow-hidden border shadow-inner transition-colors duration-300 cursor-pointer touch-none ${
            isOnline ? 'bg-emerald-500 border-emerald-600/30' : 'bg-[#94a3b8] border-slate-400'
          }`}
        >
          {/* Swipe guide text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-[12px] font-bold tracking-wider text-white drop-shadow-xs">
              {isOnline ? '右滑或轻点下线停止报单' : '右滑或轻点上线开始报单'}
            </span>
          </div>

          {/* Interactive floating slide handler */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
              e.stopPropagation(); // Avoid double click trigger
              handleSlideToggleClick();
            }}
            style={{ 
              transform: `translateX(${sliderPos}px)`,
              transition: isSliding ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className={`absolute left-1.5 w-12 h-10 select-none rounded-xl flex items-center justify-center shadow-md cursor-pointer transform transition-all active:scale-95 bg-white touch-none ${
              isOnline ? 'text-emerald-600' : 'text-slate-600'
            }`}
          >
            <ChevronRight className="w-5 h-5 font-bold animate-pulse" />
          </div>
        </div>

        {/* Direct Register Code Order button on right side */}
        <button
          onClick={() => {
            const isVip = checkVipActive(settings.vipExpiry);
            if (!isVip && stats.todayOrders >= 2) {
              alert('🔒 提示：非VIP会员每日限制报单次数已用完（每天限额2次，明早6:00自动恢复，激活VIP解除限制）。');
              return;
            }
            if (!isOnline) {
              alert('温馨提示：请先在底部右滑上线，即可上线并进行一键报单接客！');
              return;
            }
            onNavigate('create_order');
          }}
          className="flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 w-14 h-13 rounded-xl border border-gray-200/60 transition-transform active:scale-95"
        >
          <QrCode className="w-5 h-5 mb-0.5 text-teal-600" />
          <span className="text-[10px] font-semibold text-slate-500">报单</span>
        </button>
      </div>

      {/* 6. VIP Redemption Dialog Modal */}
      {showRedeemModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50">
          <div className="bg-white rounded-[28px] w-full max-w-[320px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white py-4 px-5 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Crown className="w-5 h-5 text-amber-100 animate-bounce" />
                <span className="font-bold text-sm tracking-wide">VIP会员云端兑换</span>
              </div>
              <button 
                onClick={() => setShowRedeemModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white leading-none transition-transform active:scale-90"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                输入您的云端兑换码激活或延长软件VIP服务，尊享极速听单及开分配优等超值特权。
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  云端兑换码 / 充值卡号
                </label>
                <input 
                  type="text" 
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="请输入代码卡密 (不区分大小写)" 
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-semibold focus:outline-hidden focus:border-amber-500 focus:bg-white text-slate-800 transition-all font-mono"
                  disabled={isMatching}
                />
              </div>

              {/* Helpful suggestions */}
              {!modalMessage && !isMatching && (
                <div className="bg-teal-50/50 rounded-xl p-3 border border-dashed border-teal-200/60">
                  <div className="text-[10px] font-bold text-teal-800 mb-1">💡 云联锁激活说明：</div>
                  <p className="text-[9.5px] leading-relaxed text-teal-700 font-medium">
                    本卡密兑换采用全云端物理级实联结构。请右侧「运营管理后台」一键极速点击“生成卡码”，随后将激活码粘贴至此，即时绑定、全网实收稽核，无缝贯通。
                  </p>
                </div>
              )}

              {/* Status Message */}
              {modalMessage && (
                <div className={`p-3.5 rounded-xl border text-[11px] leading-relaxed font-semibold ${
                  modalMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                    : 'bg-red-50 text-red-800 border-red-100'
                }`}>
                  {modalMessage.text}
                </div>
              )}

              {/* Spinner indicator during interactive matching */}
              {isMatching && (
                <div className="py-2 flex flex-col items-center justify-center space-y-2">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-bold text-amber-600 animate-pulse">正在与云端服务器匹配验证中...</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex space-x-3 pt-1">
                <button 
                  onClick={() => setShowRedeemModal(false)}
                  className="flex-1 h-11 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold border border-slate-200 transition-all active:scale-97"
                  disabled={isMatching}
                >
                  取消
                </button>
                <button 
                  onClick={handleRedeemSubmit}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/10 active:scale-97 transition-all flex items-center justify-center"
                  disabled={isMatching}
                >
                  {isMatching ? '极速校验中' : '匹配激活'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. User Profile Option Modal (Triggered by Avatar) */}
      {showUserModal && (
        <div id="user-profile-modal" className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-[280px] shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="font-bold text-xs text-slate-800">👤 当前登录账户</span>
              <button 
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="关闭"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <div className="space-y-1.5 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-600 mb-2">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-[10px] text-slate-400 font-bold">代驾系统授权手机号</p>
              <p className="font-mono text-sm font-black text-slate-800 tracking-wider">
                {userPhone ? `${userPhone.substring(0, 3)} ${userPhone.substring(3, 7)} ${userPhone.substring(7)}` : '未登录'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  if (onLogout) {
                     onLogout();
                  }
                }}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-rose-500/10 active:scale-97 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                退出当前登录
              </button>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                关闭对话框
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. System Messages & Notifications Modal */}
      {showMessagesModal && (
        <div id="system-messages-modal" className="absolute inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[320px] shadow-2xl overflow-hidden flex flex-col max-h-[85%] animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-pink-600 to-indigo-600 text-white py-4 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-1.5">
                <MessageSquare className="w-5 h-5 text-pink-200" />
                <span className="font-bold text-sm tracking-wide">📬 系统消息通知</span>
              </div>
              <button 
                onClick={() => {
                  setShowMessagesModal(false);
                  // Automatically mark all as read when closing the messages dialog
                  handleMarkAllRead();
                }}
                className="p-1 rounded-full hover:bg-white/10 text-white transition-transform active:scale-90"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 min-h-0 bg-slate-50/50">
              {unreadMessages.length > 0 && (
                <div className="flex justify-between items-center bg-indigo-50 border border-indigo-150 px-3 py-2 rounded-xl text-[10.5px]">
                  <span className="text-black font-black font-sans">
                    📥 有 {unreadMessages.length} 条未读公告 / 消息
                  </span>
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-black hover:text-opacity-80 font-black cursor-pointer underline"
                  >
                    全部标为已读
                  </button>
                </div>
              )}

              {userMessages.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-black text-slate-900">暂无可查看的系统消息</p>
                  <p className="text-[10px] leading-relaxed text-slate-600 max-w-[200px] mx-auto font-medium">
                    请留意管理后台，管理员可能会下发安全通知、福利卡券或调试消息。
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {userMessages.map((msg) => {
                    const isNew = !viewedMessageIds.includes(msg.id);
                    return (
                      <div 
                        key={msg.id} 
                        onClick={() => handleMarkSingleRead(msg.id)}
                        className={`p-3.5 rounded-2xl border transition-all text-left relative ${
                          isNew 
                            ? 'bg-white border-slate-300 shadow-xs ring-1 ring-black/5' 
                            : 'bg-white/95 border-slate-200 opacity-95'
                        }`}
                      >
                        {isNew && (
                          <span className="absolute top-3.5 right-3.5 px-1.5 py-0.5 rounded bg-red-650 text-white text-[8px] font-black leading-none uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-white"></span>
                            未读
                          </span>
                        )}

                        <div className="pr-10 space-y-1">
                          <h4 className="text-sm font-black text-black leading-snug">{msg.title}</h4>
                          <span className="text-[9.5px] text-slate-800 font-mono font-bold block">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString('zh-CN', { hour12: false }) : ''}
                          </span>
                        </div>

                        <p className="text-xs text-black mt-2.5 leading-relaxed font-sans font-extrabold whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        
                        {!isNew && (
                          <div className="text-right mt-1">
                            <span className="text-[9px] text-slate-800 font-bold">✓ 已阅读</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-white shadow-inner flex justify-end shrink-0">
              <button
                onClick={() => {
                  setShowMessagesModal(false);
                  handleMarkAllRead();
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl active:scale-97 cursor-pointer transition-all text-center uppercase tracking-wide"
              >
                我知道了，标记全部已读并关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Online Orders Activation application overlay screen page */}
      {showOnlineAppModal && (
        <div className="absolute inset-0 bg-slate-50 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
          {/* Page Toolbar Header */}
          <div className="bg-slate-900 text-white py-3 px-4 flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/20 text-teal-400">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h3 className="font-extrabold text-xs text-white">线上听单资质认证</h3>
                <span className="text-[9px] text-slate-400 font-normal">当前城市线上订单开通申请</span>
              </div>
            </div>
            <button 
              onClick={() => setShowOnlineAppModal(false)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-90"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Page Main Content area with relative scrolling */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            
            {loadingApp ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[11px] font-black text-slate-500 animate-pulse">正在获取账号实时的同步审批状态...</p>
              </div>
            ) : onlineApp ? (
              /* IF AN APPLICATION RECORD ALREADY EXISTS */
              <div className="space-y-4">
                {/* 1. Status block */}
                {onlineApp.status === 'pending' && (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 animate-bounce">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-amber-800">审核中 (等待管理员审批)</h4>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-bold font-sans max-w-[280px]">
                      您的线上高级听单资质资料已同步至云端审计中心，系统当前正在进行资质比对或管理员审核。预计2小时内完成，请耐心等待！
                    </p>
                  </div>
                )}

                {onlineApp.status === 'approved' && (
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-150 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-pulse">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-emerald-800">✅ 审核已通过 (享有线上派单资格)</h4>
                    <p className="text-[11px] text-emerald-700 leading-relaxed font-semibold font-sans max-w-[280px]">
                      恭喜您！您的线上代驾单业务已成功激活开通！您已加入平台的智能派单调度策略序列中。
                    </p>

                    {/* Integrated status message indicating automatic activation by admin */}
                    <div className="w-full bg-white rounded-xl p-3 border border-emerald-100 mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="text-left">
                        <span className="text-[11px] font-black text-slate-800 block">自动线上听单</span>
                        <span className="text-[9.5px] text-emerald-600 block leading-normal mt-0.5">管理后台审批通过后，系统已为您自动激活开启线上听单功能。您当前已加入平台智能调度派单队列。</span>
                      </div>
                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md shrink-0">
                        已自动开启
                      </span>
                    </div>
                  </div>
                )}

                {onlineApp.status === 'rejected' && (
                  <div className="bg-red-50 rounded-2xl p-4 border border-red-150 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-red-800">❌ 审核未通过 (申请已被驳回)</h4>
                    
                    <div className="w-full bg-white/90 border border-red-200/50 rounded-xl p-3 text-left">
                      <span className="text-[10px] font-black text-red-600 block mb-1">駁回原因 / 改进建议：</span>
                      <p className="text-[11px] text-red-800 leading-relaxed font-bold">
                        {onlineApp.rejectionReason || '原因：您提交的某一证件正面反射光太强、人像面部模糊或驾龄信息有误，无法认定资质。'}
                      </p>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-[280px]">
                      您可以对填写的表单内容再次修正，并点击下方按钮重新发起认证审核，我们会加急为您流转。
                    </p>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm("确定要重新填写申请吗？这会清除您上一次提交的信息状态。")) {
                          try {
                            setLoadingApp(true);
                            // Clear application
                            const appDocRef = doc(db, 'online_applications', userPhone || '');
                            await setDoc(appDocRef, {
                              ...onlineApp,
                              status: 're-filling',
                              updatedAt: new Date().toISOString()
                            });
                            // Reset state and allow re-filling
                            setOnlineApp(null);
                          } catch(err: any) {
                            alert("重置申请出错：" + err.message);
                          } finally {
                            setLoadingApp(false);
                          }
                        }
                      }}
                      className="w-full h-10 mt-2 rounded-xl bg-slate-900 border border-slate-950 font-extrabold text-xs text-white hover:bg-slate-800 transition-all flex items-center justify-center space-x-1 active:scale-97 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>更新资料并重新申请</span>
                    </button>
                  </div>
                )}

                {/* 2. Filed Info Details Summary Card */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-3">
                  <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                    <FileCheck2 className="w-4 h-4 text-slate-800" />
                    <span className="text-xs font-black text-slate-900">已提交审核的申报案详情</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-left">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[9px]">司机手机号</span>
                      <span className="font-extrabold text-slate-800 font-mono">{onlineApp.driverPhone}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[9px]">司机姓名</span>
                      <span className="font-extrabold text-slate-800">{onlineApp.driverName}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[9px]">司机年龄 / 性别</span>
                      <span className="font-extrabold text-slate-800">{onlineApp.driverAge}岁 / {onlineApp.driverGender}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[9px]">驾龄 (年)</span>
                      <span className="font-extrabold text-slate-800">{onlineApp.drivingYears} 年</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg col-span-2">
                      <span className="text-slate-500 block text-[9px]">紧急联系人手机号</span>
                      <span className="font-extrabold text-slate-800 font-mono">{onlineApp.emergencyPhone}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg col-span-2 flex justify-between items-center">
                      <div>
                        <span className="text-slate-500 block text-[9px]">线上单开通城市</span>
                        <span className="font-extrabold text-teal-600">📍 {onlineApp.city || '暂无城市信息'}</span>
                      </div>
                      <span className="text-[8.5px] bg-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded">不可自主修改</span>
                    </div>
                  </div>

                  {/* 4 Photo slots thumbnail preview */}
                  <div className="space-y-1.5 pt-1 text-left">
                    <span className="text-[10px] font-black text-slate-500 block">证件影像档案 (4份已提交)</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-0.5">
                        <img src={onlineApp.idCardFront} className="w-full h-11 object-cover rounded-md" alt="身份证正" referrerPolicy="no-referrer" />
                        <span className="text-[8px] text-slate-500 text-center block mt-0.5 truncate">身份证正</span>
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-0.5">
                        <img src={onlineApp.idCardBack} className="w-full h-11 object-cover rounded-md" alt="身份证反" referrerPolicy="no-referrer" />
                        <span className="text-[8px] text-slate-500 text-center block mt-0.5 truncate">身份证反</span>
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-0.5">
                        <img src={onlineApp.driverLicenseFront} className="w-full h-11 object-cover rounded-md" alt="驾驶证" referrerPolicy="no-referrer" />
                        <span className="text-[8px] text-slate-500 text-center block mt-0.5 truncate">驾驶证正</span>
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-0.5">
                        <img src={onlineApp.driverLicenseBack} className="w-full h-11 object-cover rounded-md" alt="驾驶证副" referrerPolicy="no-referrer" />
                        <span className="text-[8px] text-slate-500 text-center block mt-0.5 truncate">驾驶证副</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-200/40 rounded-xl text-left">
                  <p className="text-[10px] text-amber-800 leading-relaxed font-bold">
                    ⚠️ 提示：您当前处于线上单审批资料锁定期。任何信息的更新都需要通过后台管理人员审核，请勿擅自提交虚假照片，稽核中心将实时跟进审计。
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOnlineAppSubmit} className="space-y-4">
                
                {/* Speed-run Autocompletion Simulator for quick applet audit / testing */}
                <div className="bg-slate-900 text-white rounded-2xl p-3 border border-slate-800 space-y-2 text-left">
                  <div className="flex items-center justify-between font-extrabold text-[10px]">
                    <span className="text-[10.5px] font-black text-amber-400 flex items-center gap-1">
                      ⚡ 开发者快捷沙箱工具箱 (Auditor Sandbox)
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 leading-relaxed">
                    考虑到您在 AI Studio 网页沙盒测试，通常没有准备真实身份证/驾驶证照片，点按下方按钮即可在1秒内使用 SVG 自动合成全套仿真证件照，省去寻找本地照片的繁育！
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoFillAndSimulate}
                    className="w-full py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:opacity-90 active:scale-98 transition-all rounded-xl text-[11px] font-black text-white flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <span>🎯 一键填充真实仿真数据 + 合成四张证件照</span>
                  </button>
                </div>

                {/* FORM INPUTS */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 shadow-2xs text-left">
                  <div className="flex items-center space-x-1.5 border-b border-slate-50 pb-2">
                    <User className="w-4 h-4 text-slate-800" />
                    <span className="text-xs font-black text-slate-900">1. 代驾基本履历登记</span>
                  </div>

                  {/* Registered Driver Mobile (Read-only) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">
                      当前登录司机注册手机号 (默认不可更改)
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={userPhone || '未登录'}
                        disabled
                        className="w-full h-11 bg-slate-100 border border-slate-200 rounded-xl px-3 text-xs font-black text-slate-500 font-mono cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-3 text-[9px] font-bold text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded">不可篡改</span>
                    </div>
                  </div>

                  {/* 线上单开通城市 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">
                      线上单开通城市 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (onlineApp && (onlineApp.status === 'approved' || onlineApp.status === 'pending')) {
                            setLocalAlert({
                              title: "🔒 锁定提示",
                              message: "线上开通城市由省市运管中心登记认证。申请流程中及通过核准后无法自行修改变更，如需变更，请联系后台运营管理人员调整修改。",
                              type: "warning"
                            });
                            return;
                          }
                          setShowCitySelector(true);
                        }}
                        className={`w-full h-11 border rounded-xl px-3 flex items-center justify-between text-left text-xs font-extrabold font-sans transition-all active:scale-99 ${
                          applicantCity ? 'text-teal-600 bg-teal-50/10 border-teal-200' : 'text-slate-400 bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="truncate">{applicantCity ? `📍 ${applicantCity}` : '🔍 点击选择开通听单城市 (首字母快速查找)'}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* Driver Name & Gender Input Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 block">
                        司机姓名 <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        placeholder="请输入姓名"
                        className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-hidden rounded-xl px-3 text-xs font-extrabold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 block">
                        司机性别 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={applicantGender}
                        onChange={(e) => setApplicantGender(e.target.value)}
                        className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-hidden rounded-xl px-3 text-xs font-extrabold text-slate-800"
                      >
                        <option value="男">男 (Male)</option>
                        <option value="女">女 (Female)</option>
                      </select>
                    </div>
                  </div>

                  {/* Driver Age & Driving Experience Years Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 block">
                        司机年龄 <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        required
                        min="18"
                        max="70"
                        value={applicantAge}
                        onChange={(e) => setApplicantAge(e.target.value)}
                        placeholder="例：35"
                        className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-hidden rounded-xl px-3 text-xs font-extrabold text-slate-800 hover:shadow-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 block">
                        驾龄多少年 <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        max="50"
                        value={applicantDrivingYears}
                        onChange={(e) => setApplicantDrivingYears(e.target.value)}
                        placeholder="年数"
                        className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-hidden rounded-xl px-3 text-xs font-extrabold text-slate-800 hover:shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Emergency Contact Mobile */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 block">
                      紧急联系人手机号码 <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="tel" 
                      required
                      pattern="1[3-9]\d{9}"
                      maxLength={11}
                      value={applicantEmergencyPhone}
                      onChange={(e) => setApplicantEmergencyPhone(e.target.value)}
                      placeholder="请输入紧急联系人的11位手机号"
                      className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-hidden rounded-xl px-3 text-xs font-extrabold text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* GRAPHIC CREDENTIAL PHOTO UPLOADS */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-4 shadow-2xs text-left">
                  <div className="flex items-center space-x-1.5 border-b border-slate-50 pb-2">
                    <Camera className="w-4 h-4 text-slate-800" />
                    <span className="text-xs font-black text-slate-900">2. 实名与执照影像档案上传</span>
                  </div>

                  {/* ID Card front and back upload elements */}
                  <div className="space-y-2">
                    <span className="text-[10.5px] font-black text-slate-700 block">居民身份证原始影像档案复印件</span>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Front Card */}
                      <div className="relative">
                        <input 
                          type="file" 
                          id="upload-id-front" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileChange(e, setIdCardFront)} 
                        />
                        <div 
                          onClick={() => document.getElementById('upload-id-front')?.click()}
                          className={`aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all ${
                            idCardFront ? 'border-teal-450 bg-teal-50/20' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          {idCardFront ? (
                            <img src={idCardFront} className="w-full h-full object-cover rounded-lg" alt="身份证人像" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="space-y-1">
                              <UploadCloud className="w-5 h-5 text-slate-400 mx-auto animate-pulse" />
                              <span className="text-[9.5px] font-extrabold text-slate-500 block">身份证【人像面】</span>
                              <span className="text-[8px] text-slate-400 block font-normal">点击上传照片</span>
                            </div>
                          )}
                        </div>
                        {idCardFront && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setIdCardFront(''); }}
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 leading-none shadow-xs z-10"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>

                      {/* Back Card */}
                      <div className="relative">
                        <input 
                          type="file" 
                          id="upload-id-back" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileChange(e, setIdCardBack)} 
                        />
                        <div 
                          onClick={() => document.getElementById('upload-id-back')?.click()}
                          className={`aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all ${
                            idCardBack ? 'border-teal-450 bg-teal-50/20' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          {idCardBack ? (
                            <img src={idCardBack} className="w-full h-full object-cover rounded-lg" alt="国徽面" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="space-y-1">
                              <UploadCloud className="w-5 h-5 text-slate-400 mx-auto animate-pulse" />
                              <span className="text-[9.5px] font-extrabold text-slate-500 block">身份证【国徽面】</span>
                              <span className="text-[8px] text-slate-400 block font-normal">点击上传照片</span>
                            </div>
                          )}
                        </div>
                        {idCardBack && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setIdCardBack(''); }}
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 leading-none shadow-xs z-10"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Driver License front and back upload elements */}
                  <div className="space-y-2">
                    <span className="text-[10.5px] font-black text-slate-700 block">机动车驾驶证原始影像档案复印件</span>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Front License */}
                      <div className="relative">
                        <input 
                          type="file" 
                          id="upload-license-front" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileChange(e, setDriverLicenseFront)} 
                        />
                        <div 
                          onClick={() => document.getElementById('upload-license-front')?.click()}
                          className={`aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all ${
                            driverLicenseFront ? 'border-teal-455 bg-teal-50/20' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          {driverLicenseFront ? (
                            <img src={driverLicenseFront} className="w-full h-full object-cover rounded-lg" alt="驾驶证正" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="space-y-1">
                              <UploadCloud className="w-5 h-5 text-slate-400 mx-auto animate-pulse" />
                              <span className="text-[9.5px] font-extrabold text-slate-500 block">驾驶证【正页】</span>
                              <span className="text-[8px] text-slate-400 block font-normal">点击上传照片</span>
                            </div>
                          )}
                        </div>
                        {driverLicenseFront && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setDriverLicenseFront(''); }}
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 leading-none shadow-xs z-10"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>

                      {/* Back License */}
                      <div className="relative">
                        <input 
                          type="file" 
                          id="upload-license-back" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileChange(e, setDriverLicenseBack)} 
                        />
                        <div 
                          onClick={() => document.getElementById('upload-license-back')?.click()}
                          className={`aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all ${
                            driverLicenseBack ? 'border-teal-455 bg-teal-50/20' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                          }`}
                        >
                          {driverLicenseBack ? (
                            <img src={driverLicenseBack} className="w-full h-full object-cover rounded-lg" alt="驾驶证副" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="space-y-1">
                              <UploadCloud className="w-5 h-5 text-slate-400 mx-auto animate-pulse" />
                              <span className="text-[9.5px] font-extrabold text-slate-500 block">驾驶证【副页】</span>
                              <span className="text-[8px] text-slate-400 block font-normal">点击上传照片</span>
                            </div>
                          )}
                        </div>
                        {driverLicenseBack && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setDriverLicenseBack(''); }}
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 leading-none shadow-xs z-10"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submitting controller & Actions */}
                <div className="pt-2 text-center">
                  <button
                    type="submit"
                    disabled={submittingApp || !applicantName.trim() || !applicantAge.trim() || !applicantEmergencyPhone.trim() || !applicantDrivingYears.trim() || !idCardFront || !idCardBack || !driverLicenseFront || !driverLicenseBack}
                    className={`w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                      (applicantName.trim() && applicantAge.trim() && applicantEmergencyPhone.trim() && applicantDrivingYears.trim() && idCardFront && idCardBack && driverLicenseFront && driverLicenseBack)
                        ? 'bg-gradient-to-r from-teal-600 to-indigo-650 text-white hover:opacity-95 shadow-md shadow-indigo-600/10 active:scale-97'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {submittingApp ? (
                      <span className="flex items-center space-x-1">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>正在同步双轨资质数据至后台...</span>
                      </span>
                    ) : (
                      <span>提交开通申请 (实名联合认证)</span>
                    )}
                  </button>
                  <p className="text-[9px] text-center text-slate-400 font-normal mt-2 leading-relaxed">
                    信息将采用全信加密存储，保证隐私安全。每个手机账户在绑定状态下仅支持一宗注册申请审计，严禁上传非本人的虚假伪造凭据。
                  </p>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

      {/* 9. City Selection Modal */}
      {showCitySelector && (
        <div className="absolute inset-0 bg-slate-50 z-[100] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="bg-slate-900 text-white py-3 px-4 flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4.5 h-4.5 text-teal-400" />
              <div className="text-left">
                <h3 className="font-extrabold text-xs text-white">选择听单城市</h3>
                <span className="text-[9px] text-slate-400 font-normal">支持首字母拼音快速跳转检索</span>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => {
                setShowCitySelector(false);
                setSearchCityQuery('');
              }}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-90"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={searchCityQuery}
                onChange={(e) => setSearchCityQuery(e.target.value)}
                placeholder="输入城市中文名或拼音检索（如：北京 / Beijing）"
                className="w-full h-10 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-hidden rounded-xl pl-9 pr-8 text-xs font-semibold text-slate-800 transition-all"
              />
              <span className="absolute left-3 top-3 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
              </span>
              {searchCityQuery && (
                <button
                  type="button"
                  onClick={() => setSearchCityQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto relative min-h-0">
            {searchCityQuery.trim() ? (
              // Search Results List
              <div className="p-4 space-y-2">
                <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">搜索结果</span>
                {(() => {
                  const filtered = ALL_CITIES_FLAT.filter(city => 
                    city.name.includes(searchCityQuery.trim()) || 
                    city.pinyin.toLowerCase().includes(searchCityQuery.trim().toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                        <MapPin className="w-8 h-8 text-slate-300 stroke-1" />
                        <span className="text-xs">未找到名称含 “{searchCityQuery}” 的城市</span>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {filtered.map(city => (
                        <button
                          key={city.name}
                          type="button"
                          onClick={() => {
                            setApplicantCity(city.name);
                            setShowCitySelector(false);
                            setSearchCityQuery('');
                          }}
                          className={`py-2 px-1 text-center text-xs font-black rounded-xl border transition-all cursor-pointer ${
                            applicantCity === city.name 
                              ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-xs' 
                              : 'bg-white hover:bg-slate-50 border-slate-200/60 text-slate-700 shadow-3xs'
                          }`}
                        >
                          {city.name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Full Directory
              <div className="pr-8 pl-4 py-4 space-y-4">
                {/* Current Selection */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">当前选择</span>
                  <div className="flex">
                    <div className={`py-2 px-4 text-xs font-black rounded-xl border flex items-center space-x-1 ${
                      applicantCity ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                      <span>{applicantCity ? `已选择：${applicantCity}` : '暂无选择'}</span>
                    </div>
                  </div>
                </div>

                {/* Popular Cities */}
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">热门城市</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['北京', '上海', '广州', '深圳', '成都', '杭州', '武汉', '西安', '重庆'].map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setApplicantCity(name);
                          setShowCitySelector(false);
                          setSearchCityQuery('');
                        }}
                        className={`py-2 px-1 text-center text-xs font-black rounded-xl border transition-all cursor-pointer ${
                          applicantCity === name 
                            ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-xs' 
                            : 'bg-white hover:bg-slate-50 border-slate-200/60 text-slate-700 shadow-3xs'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Directory by Alphabet letters */}
                <div className="space-y-4 text-left">
                  {CITY_GROUPS.map(group => (
                    <div key={group.letter} id={`city-letter-${group.letter}`} className="scroll-mt-4 space-y-2">
                      <div className="bg-slate-100/80 backdrop-blur-xs rounded-lg px-2.5 py-0.5 inline-block text-[10px] font-extrabold text-slate-600 font-mono tracking-wide">
                        {group.letter}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.cities.map(city => (
                          <button
                            key={city.name}
                            type="button"
                            onClick={() => {
                              setApplicantCity(city.name);
                              setShowCitySelector(false);
                              setSearchCityQuery('');
                            }}
                            className={`py-2 px-1 text-center text-xs font-black rounded-xl border transition-all cursor-pointer ${
                              applicantCity === city.name 
                                ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-xs' 
                                : 'bg-white hover:bg-slate-50 border-slate-200/60 text-slate-700 shadow-3xs'
                            }`}
                          >
                            {city.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floating Right Sidebar Alphabet Index (only visible when not searching) */}
            {!searchCityQuery && (
              <div className="absolute right-1 top-4 bottom-4 w-6 flex flex-col justify-between items-center py-2 bg-white/60 backdrop-blur-xs border border-slate-100 rounded-2xl z-25 shadow-2xs">
                {CITY_GROUPS.map(group => (
                  <button
                    key={group.letter}
                    type="button"
                    onClick={() => {
                      const element = document.getElementById(`city-letter-${group.letter}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="w-5 h-5 flex items-center justify-center text-[9px] font-black text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all"
                  >
                    {group.letter}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Beautiful custom pop-up dialog to replace window.alert inside iframes */}
      {localAlert && (
        <div className="absolute inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in scale-in duration-200">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              localAlert.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
              localAlert.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
            }`}>
              {localAlert.type === 'success' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : localAlert.type === 'warning' ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <Bell className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-800">{localAlert.title}</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                {localAlert.message}
              </p>
            </div>
            <button
              onClick={() => setLocalAlert(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-97 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-lg"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
