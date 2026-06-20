/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame';
import HomeView from './components/HomeView';
import SettingsView from './components/SettingsView';
import MileageModeView from './components/MileageModeView';
import ActiveTripView from './components/ActiveTripView';
import TripCostView from './components/TripCostView';
import PaymentQRView from './components/PaymentQRView';
import CreateOrderView from './components/CreateOrderView';
import PassengerOrderView from './components/PassengerOrderView';

import { 
  ChauffeurSettings, 
  BillingRules, 
  TripState, 
  DriverStats,
  DEFAULT_BILLING_RULES,
  DEFAULT_SETTINGS,
  checkVipActive
} from './types';
import { Sparkles, CheckCircle, Database, Smartphone } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import LoginView from './components/LoginView';
import { db } from './lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const getCurrent6AmDay = (): string => {
  const now = new Date();
  const adjusted = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const yyyy = adjusted.getFullYear();
  const mm = String(adjusted.getMonth() + 1).padStart(2, '0');
  const dd = String(adjusted.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function App() {
  // --- 1. Persistent State Management ---
  const [billingRules, setBillingRules] = useState<BillingRules>(() => {
    const cached = localStorage.getItem('dd_billing_rules');
    return cached ? JSON.parse(cached) : DEFAULT_BILLING_RULES;
  });

  const [settings, setSettings] = useState<ChauffeurSettings>(() => {
    const cached = localStorage.getItem('dd_settings');
    return cached ? JSON.parse(cached) : DEFAULT_SETTINGS;
  });

  const [stats, setStats] = useState<DriverStats>(() => {
    const cached = localStorage.getItem('dd_stats');
    const defaultStats: DriverStats = { todayOrders: 0, todayIncome: 0.00, myPoints: 0, lastResetDate: getCurrent6AmDay() };
    if (!cached) return defaultStats;
    try {
      const parsed = JSON.parse(cached);
      if (parsed.myPoints === undefined || parsed.myPoints === 360) {
        parsed.myPoints = 0;
      }
      const currentDay = getCurrent6AmDay();
      if (parsed.lastResetDate !== currentDay) {
        parsed.todayOrders = 0;
        parsed.todayIncome = 0.00;
        parsed.lastResetDate = currentDay;
      }
      return parsed;
    } catch {
      return defaultStats;
    }
  });

  const [currentTrip, setCurrentTrip] = useState<TripState | null>(() => {
    const cached = localStorage.getItem('dd_current_trip');
    return cached ? JSON.parse(cached) : null;
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    const cached = localStorage.getItem('dd_is_online');
    return cached ? JSON.parse(cached) === 'true' : false;
  });

  const [currentView, setCurrentView] = useState<string>('home');
  const [mobileActiveTab, setMobileActiveTab] = useState<'app' | 'admin'>('app');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [passengerDriverPhone, setPassengerDriverPhone] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('driver');
  });
  const [userPhone, setUserPhone] = useState<string | null>(() => {
    return localStorage.getItem('dd_user_phone');
  });

  const handleLogout = () => {
    localStorage.removeItem('dd_user_phone');
    setUserPhone(null);
    setCurrentView('home');
    triggerToast('您的司机端安全会话已安全退出断开！');
  };

  // Sinks to disk
  useEffect(() => {
    localStorage.setItem('dd_billing_rules', JSON.stringify(billingRules));
  }, [billingRules]);

  useEffect(() => {
    localStorage.setItem('dd_settings', JSON.stringify(settings));
  }, [settings]);

  // Synchronize driver user account membership expiry & online orders status with Firestore in real-time
  useEffect(() => {
    if (!userPhone) return;
    
    const userDocRef = doc(db, 'driver_users', userPhone);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          setSettings(prev => {
            let nextSettings = { ...prev };
            let changed = false;
            if (data.vipExpiry !== undefined && prev.vipExpiry !== data.vipExpiry) {
              nextSettings.vipExpiry = data.vipExpiry;
              changed = true;
            }
            if (data.onlineOrdersEnabled !== undefined && prev.onlineOrdersEnabled !== data.onlineOrdersEnabled) {
              nextSettings.onlineOrdersEnabled = data.onlineOrdersEnabled;
              changed = true;
            }
            if (data.city !== undefined && prev.city !== data.city) {
              nextSettings.city = data.city;
              changed = true;
            }
            if (data.isBanned !== undefined && prev.isBanned !== data.isBanned) {
              nextSettings.isBanned = data.isBanned;
              changed = true;
            }
            return changed ? nextSettings : prev;
          });
        }
      } else {
        // Create user doc if it doesn't exist yet
        const initialExpiry = settings.vipExpiry || '';
        const initialOnlineEnabled = settings.onlineOrdersEnabled || false;
        const initialCity = settings.city || '';
        const initialIsBanned = settings.isBanned || false;
        setDoc(userDocRef, {
          phoneNumber: userPhone,
          vipExpiry: initialExpiry,
          onlineOrdersEnabled: initialOnlineEnabled,
          city: initialCity,
          isBanned: initialIsBanned,
          updatedAt: new Date().toISOString()
        }).catch(err => {
          console.error("Error registering driver user in firestore:", err);
        });
      }
    }, (err) => {
      console.error("Error listening to driver user changes:", err);
    });
    
    return () => unsubscribe();
  }, [userPhone]);

  useEffect(() => {
    localStorage.setItem('dd_stats', JSON.stringify(stats));
  }, [stats]);

  // Automatic daily reset at 6:00 AM
  useEffect(() => {
    const checkAndResetStats = () => {
      const currentDay = getCurrent6AmDay();
      if (stats.lastResetDate !== currentDay) {
        setStats(prev => ({
          ...prev,
          todayOrders: 0,
          todayIncome: 0.00,
          lastResetDate: currentDay
        }));
      }
    };

    // Run custom reset check immediately on mount/update
    checkAndResetStats();

    // Check every 10 seconds for precise, live 6:00 AM transition
    const interval = setInterval(checkAndResetStats, 10000);
    return () => clearInterval(interval);
  }, [stats.lastResetDate]);

  useEffect(() => {
    if (currentTrip) {
      localStorage.setItem('dd_current_trip', JSON.stringify(currentTrip));
    } else {
      localStorage.removeItem('dd_current_trip');
    }
  }, [currentTrip]);

  useEffect(() => {
    localStorage.setItem('dd_is_online', isOnline ? 'true' : 'false');
  }, [isOnline]);

  // Active Account Ban Listener: automatically force-offline banned driver
  useEffect(() => {
    if (settings.isBanned && isOnline) {
      setIsOnline(false);
      alert('⚠️ 系统警告：您的账号已被管理员封停。已强制为您切换至下线状态，封停期间您将无法接单或开启线上听单服务！如有异议请联系客服。');
    }
  }, [settings.isBanned, isOnline]);

  // Handle route locking: if an active ride is underway, keep display constrained to active navigation
  useEffect(() => {
    if (currentTrip) {
      if (currentTrip.currentStatus === 'serving') {
        setCurrentView('navigation');
      } else if (currentTrip.currentStatus === 'ended') {
        setCurrentView('cost');
      } else if (currentTrip.currentStatus === 'payment_pending') {
        setCurrentView('payment_qr');
      }
    }
  }, [currentTrip]);

  // --- 2. Action Flow Responders ---
  const handleStartTrip = (trip: TripState) => {
    setCurrentTrip(trip);
    setCurrentView('navigation');
    triggerToast('订单已被接单！计费计时系统已极速激活。');
  };

  const handleUpdateTrip = (updated: TripState) => {
    setCurrentTrip(updated);
  };

  const handleEndTrip = (finalBaseFee: number) => {
    if (!currentTrip) return;
    const endedTrip = {
      ...currentTrip,
      calculatedBaseFee: finalBaseFee,
      currentStatus: 'ended' as const
    };
    setCurrentTrip(endedTrip);
    setCurrentView('cost');
    triggerToast('行程结束。请登记路桥及垫付费用。');
  };

  const handleGoToCollection = (finalizedTrip: TripState) => {
    setCurrentTrip(finalizedTrip);
    setCurrentView('payment_qr');
  };

  const handleFinishTrip = (amount: number) => {
    // Add up stats securely
    let nextPoints = stats.myPoints + 1;
    if (nextPoints > 999) {
      nextPoints = 0;
    }
    const updatedStats = {
      todayOrders: stats.todayOrders + 1,
      todayIncome: Number((stats.todayIncome + amount).toFixed(2)),
      myPoints: nextPoints,
      lastResetDate: stats.lastResetDate || getCurrent6AmDay()
    };
    setStats(updatedStats);
    setCurrentTrip(null);
    setCurrentView('home');

    const isVip = checkVipActive(settings.vipExpiry);
    if (!isVip && updatedStats.todayOrders >= 2) {
      setIsOnline(false);
      triggerToast(`账款 ¥${amount.toFixed(2)} 元收取成功！提示：因您不是VIP，达每日2次上限已自动下线。`);
    } else {
      triggerToast(`账款 ¥${amount.toFixed(2)} 元收取成功，并入今日收入统计！`);
    }

    // Voice announcement overlay completion
    if (settings.voiceBroadcast === '开单语音播报' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const textStr = `收款成功。本次收款金额：${amount}元，已存入代驾指定账户钱包中。感谢您的辛苦劳动！`;
        const utter = new SpeechSynthesisUtterance(textStr);
        utter.lang = 'zh-CN';
        window.speechSynthesis.speak(utter);
      } catch(e){}
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const handleToggleOnline = (online: boolean) => {
    if (online) {
      const isVip = checkVipActive(settings.vipExpiry);
      if (!isVip && stats.todayOrders >= 2) {
        alert('🔒 提示：非VIP会员每日限制报单次数已用完（每天限额2次，明早6:00自动恢复，激活VIP解除限制）。');
        return;
      }
    }
    setIsOnline(online);
  };

  const handleUpdateSettings = (newSettings: ChauffeurSettings) => {
    setSettings(newSettings);
    if (userPhone && newSettings.vipExpiry !== undefined) {
      const userDocRef = doc(db, 'driver_users', userPhone);
      setDoc(userDocRef, {
        phoneNumber: userPhone,
        vipExpiry: newSettings.vipExpiry,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error("Error syncing user settings update to Firestore:", err);
      });
    }
  };

  // --- 3. Page Router dispatcher ---
  const renderView = () => {
    if (passengerDriverPhone) {
      return (
        <PassengerOrderView 
          driverPhone={passengerDriverPhone}
          onClose={() => {
            // Remove ?driver=xxxxx query param and reset passenger state to access demo
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            setPassengerDriverPhone(null);
          }}
        />
      );
    }

    if (!userPhone) {
      return (
        <LoginView
          onLoginSuccess={(phone) => {
            localStorage.setItem('dd_user_phone', phone);
            setUserPhone(phone);
            // Sync setting with dynamic driver name
            setSettings(prev => ({
              ...prev,
              customAppName: '极速代驾'
            }));
            triggerToast('🎉 设备签署校验通过，欢迎重新登录回一键代驾系统！');
          }}
        />
      );
    }

    switch (currentView) {
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setCurrentView('home')}
            onNavigateToBilling={() => setCurrentView('mileage')}
            onLogout={handleLogout}
          />
        );

      case 'create_order':
        return (
          <CreateOrderView
            billingRules={billingRules}
            settings={settings}
            userPhone={userPhone}
            onStartTrip={handleStartTrip}
            onNavigateBack={() => setCurrentView('home')}
          />
        );

      case 'mileage':
        return (
          <MileageModeView
            billingRules={billingRules}
            onSave={(rules) => {
              setBillingRules(rules);
              // Sync template name directly on settings too for display match
              setSettings({ ...settings, billingTemplateName: rules.templateName });
            }}
            onNavigateBack={() => setCurrentView('settings')}
          />
        );

      case 'navigation':
        if (!currentTrip) return null;
        return (
          <ActiveTripView
            trip={currentTrip}
            settings={settings}
            billingRules={billingRules}
            onUpdateTrip={handleUpdateTrip}
            onEndTrip={handleEndTrip}
          />
        );

      case 'cost':
        if (!currentTrip) return null;
        return (
          <TripCostView
            trip={currentTrip}
            onNavigateBack={() => {
              // Safe fallback back to navigation
              if (currentTrip) {
                setCurrentTrip({ ...currentTrip, currentStatus: 'serving' });
                setCurrentView('navigation');
              }
            }}
            onGoToCollection={handleGoToCollection}
          />
        );

      case 'payment_qr':
        if (!currentTrip) return null;
        return (
          <PaymentQRView
            trip={currentTrip}
            settings={settings}
            onNavigateBack={() => {
              // Roll back to fee adjustment page
              if (currentTrip) {
                setCurrentTrip({ ...currentTrip, currentStatus: 'ended' });
                setCurrentView('cost');
              }
            }}
            onFinishTrip={handleFinishTrip}
          />
        );

      case 'home':
      default:
        return (
          <HomeView
            settings={settings}
            stats={stats}
            currentTrip={currentTrip}
            billingRules={billingRules}
            onNavigate={setCurrentView}
            onStartTrip={handleStartTrip}
            onUpdateStats={setStats}
            onToggleOnline={handleToggleOnline}
            isOnline={isOnline}
            onUpdateSettings={handleUpdateSettings}
            userPhone={userPhone}
            onLogout={handleLogout}
          />
        );
    }
  };

  return (
    <div className="h-screen w-screen bg-[#07080b] flex flex-col md:flex-row overflow-hidden font-sans antialiased text-slate-200">
      
      {/* Mobile top navigation switcher bar - only dynamic on smaller screens */}
      <div className="md:hidden bg-[#0e1017] border-b border-slate-900 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
          <span className="text-xs font-black tracking-wide text-slate-100">一键代驾调度台</span>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900">
          <button
            type="button"
            onClick={() => setMobileActiveTab('app')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider flex items-center gap-1 transition-all uppercase ${
              mobileActiveTab === 'app'
                ? 'bg-[#189F95] text-white font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            司机手机端
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveTab('admin')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider flex items-center gap-1 transition-all uppercase ${
              mobileActiveTab === 'admin'
                ? 'bg-[#189F95] text-white font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Database className="w-3 h-3" />
            运营管理后台
          </button>
        </div>
      </div>

      {/* Main workspaces layout container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 bg-[#07080b]">
        
        {/* Mobile View Container - App Interface */}
        <div className={`flex-1 md:flex-initial flex items-center justify-center bg-[#07080a] ${
          mobileActiveTab === 'app' ? 'flex' : 'hidden md:flex'
        }`} style={{ minWidth: '380px' }}>
          <div className="w-full h-full flex items-center justify-center p-0 md:p-4 lg:p-6">
            <PhoneFrame>
              {renderView()}

              {/* Reusable premium float action toast element inside phone frame */}
              {showToast && (
                <div className="absolute top-16 left-4 right-4 bg-teal-600/95 border border-teal-400/20 text-white p-3 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 duration-300 flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className="text-xs font-semibold leading-relaxed tracking-wide font-sans">
                    {toastMessage}
                  </span>
                </div>
              )}
            </PhoneFrame>
          </div>
        </div>

        {/* Mobile View Container - Admin System Dashboard */}
        <div className={`flex-1 border-t md:border-t-0 md:border-l border-slate-900/60 transition-all ${
          mobileActiveTab === 'admin' ? 'flex' : 'hidden md:flex'
        }`}>
          <AdminPanel />
        </div>

      </div>

    </div>
  );
}
