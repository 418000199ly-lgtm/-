/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame';
import HomeView from './components/HomeView';
import SettingsView, { regenerateQRCode } from './components/SettingsView';
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
import { Sparkles, CheckCircle, Database, Smartphone, Users } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import LoginView from './components/LoginView';
import { db, doc, onSnapshot, setDoc, deleteDoc } from './lib/dbProxy';
import { IncomingOrderOverlay } from './components/IncomingOrderOverlay';

const getCityCenterCoords = (cityName: string): { lat: number; lng: number } => {
  const norm = (cityName || '').trim();
  const mapper: { [key: string]: { lat: number; lng: number } } = {
    '银川': { lat: 38.487193, lng: 106.230912 },
    '银川市': { lat: 38.487193, lng: 106.230912 },
    '北京': { lat: 39.9042, lng: 116.4074 },
    '北京市': { lat: 39.9042, lng: 116.4074 },
    '上海': { lat: 31.2304, lng: 121.4737 },
    '上海市': { lat: 31.2304, lng: 121.4737 },
    '广州': { lat: 23.1291, lng: 113.2644 },
    '广州市': { lat: 23.1291, lng: 113.2644 },
    '深圳': { lat: 22.5431, lng: 114.0579 },
    '深圳市': { lat: 22.5431, lng: 114.0579 },
    '成都': { lat: 30.5728, lng: 104.0668 },
    '成都市': { lat: 30.5728, lng: 104.0668 },
    '杭州': { lat: 30.2741, lng: 120.1551 },
    '杭州市': { lat: 30.2741, lng: 120.1551 },
    '重庆': { lat: 29.5630, lng: 106.5516 },
    '重庆市': { lat: 29.5630, lng: 106.5516 },
    '长沙': { lat: 28.1963, lng: 112.9821 },
    '长沙市': { lat: 28.1963, lng: 112.9821 },
    '武汉': { lat: 30.5928, lng: 114.3055 },
    '武汉市': { lat: 30.5928, lng: 114.3055 },
    '西安': { lat: 34.3416, lng: 108.9402 },
    '西安市': { lat: 34.3416, lng: 108.9402 },
    '南京': { lat: 32.0603, lng: 118.7969 },
    '南京市': { lat: 32.0603, lng: 118.7969 },
    '天津': { lat: 39.1256, lng: 117.1902 },
    '天津市': { lat: 39.1256, lng: 117.1902 },
    '郑州': { lat: 34.7579, lng: 113.6654 },
    '郑州市': { lat: 34.7579, lng: 113.6654 },
    '济南': { lat: 36.6512, lng: 117.1201 },
    '济南市': { lat: 36.6512, lng: 117.1201 },
    '青岛': { lat: 36.0671, lng: 120.3826 },
    '青岛市': { lat: 36.0671, lng: 120.3826 },
    '苏州': { lat: 31.2990, lng: 120.6186 },
    '苏州市': { lat: 31.2990, lng: 120.6186 },
    '宁波': { lat: 29.8683, lng: 121.5440 },
    '宁波市': { lat: 29.8683, lng: 121.5440 },
    '沈阳': { lat: 41.8057, lng: 123.4315 },
    '沈阳市': { lat: 41.8057, lng: 123.4315 },
    '哈尔滨': { lat: 45.8038, lng: 126.5350 },
    '哈尔滨市': { lat: 45.8038, lng: 126.5350 },
    '石家庄': { lat: 38.0423, lng: 114.5149 },
    '石家庄市': { lat: 38.0423, lng: 114.5149 },
    '太原': { lat: 37.8706, lng: 112.5489 },
    '太原市': { lat: 37.8706, lng: 112.5489 },
    '呼和浩特': { lat: 40.8174, lng: 111.6708 },
    '呼和浩特市': { lat: 40.8174, lng: 111.6708 },
    '乌鲁木齐': { lat: 43.8256, lng: 87.6168 },
    '乌鲁木齐市': { lat: 43.8256, lng: 87.6168 },
    '昆明': { lat: 25.0421, lng: 102.7122 },
    '昆明市': { lat: 25.0421, lng: 102.7122 },
    '贵阳': { lat: 26.5982, lng: 106.7112 },
    '贵阳市': { lat: 26.5982, lng: 106.7112 },
    '福州': { lat: 26.0745, lng: 119.3062 },
    '福州市': { lat: 26.0745, lng: 119.3062 },
    '厦门': { lat: 24.4798, lng: 118.0894 },
    '厦门市': { lat: 24.4798, lng: 118.0894 },
    '南昌': { lat: 28.6820, lng: 115.8579 },
    '南昌市': { lat: 28.6820, lng: 115.8579 },
    '合肥': { lat: 31.8608, lng: 117.2722 },
    '合肥市': { lat: 31.8608, lng: 117.2722 }
  };

  for (const key of Object.keys(mapper)) {
    if (norm.includes(key) || key.includes(norm)) {
      return mapper[key];
    }
  }

  return { lat: 38.487193, lng: 106.230912 };
};

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

  const [onlineBillingRules, setOnlineBillingRules] = useState<BillingRules>(DEFAULT_BILLING_RULES);

  const [settings, setSettings] = useState<ChauffeurSettings>(() => {
    const cached = localStorage.getItem('dd_settings');
    return cached ? JSON.parse(cached) : DEFAULT_SETTINGS;
  });

  const [stats, setStats] = useState<DriverStats>(() => {
    const cached = localStorage.getItem('dd_stats');
    const hasResetMyPoints = localStorage.getItem('dd_stats_reset_my_points_v1');
    const defaultStats: DriverStats = { todayOrders: 0, todayIncome: 0.00, myPoints: 0, lastResetDate: getCurrent6AmDay() };

    if (!hasResetMyPoints) {
      localStorage.setItem('dd_stats_reset_my_points_v1', 'true');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          parsed.myPoints = 0;
          localStorage.setItem('dd_stats', JSON.stringify(parsed));
          const currentDay = getCurrent6AmDay();
          if (parsed.lastResetDate !== currentDay) {
            parsed.todayOrders = 0;
            parsed.todayIncome = 0.00;
            parsed.lastResetDate = currentDay;
          }
          return { ...defaultStats, ...parsed };
        } catch {
          return defaultStats;
        }
      }
    }

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
      return { ...defaultStats, ...parsed };
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
    return cached === 'true';
  });

  const [currentView, setCurrentView] = useState<string>('home');
  const [mobileActiveTab, setMobileActiveTab] = useState<'app' | 'admin' | 'passenger'>('app');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [passengerDriverPhone, setPassengerDriverPhone] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('driver');
  });
  const [userPhone, setUserPhone] = useState<string | null>(() => {
    return localStorage.getItem('dd_user_phone');
  });
  const [incomingOrder, setIncomingOrder] = useState<any>(null);
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number }>({
    lat: 38.487193,
    lng: 106.230912
  });

  // Periodically track physical geolocation of the driver, and update/sync it onto their driver_user document in Firestore
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncDriverLocation = () => {
      const city = settings?.city || '银川市';
      const fallbackGrid = getCityCenterCoords(city);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const latitude = pos.coords.latitude;
            const longitude = pos.coords.longitude;
            setDriverCoords({ lat: latitude, lng: longitude });

            // Silently store coordinate updates directly onto the active DB document to let simulated matching query work stably
            if (userPhone && isOnline) {
              const uRef = doc(db, 'driver_users', userPhone);
              setDoc(uRef, { lat: latitude, lng: longitude }, { merge: true }).catch((e) => {
                console.error("Failed to sync driver GPS location coordinates to Firestore:", e);
              });
            }
          },
          (err) => {
            console.warn("Driver browser location blocked or unavailable, applying city center fallback:", err.message);
            setDriverCoords(fallbackGrid);

            if (userPhone && isOnline) {
              const uRef = doc(db, 'driver_users', userPhone);
              setDoc(uRef, fallbackGrid, { merge: true }).catch((e) => {
                console.error("Failed to sync driver fallback coordinates to Firestore:", e);
              });
            }
          }
        );
      } else {
        setDriverCoords(fallbackGrid);
        if (userPhone && isOnline) {
          const uRef = doc(db, 'driver_users', userPhone);
          setDoc(uRef, fallbackGrid, { merge: true }).catch((e) => {
            console.error("Failed to sync driver fallback coordinates to Firestore:", e);
          });
        }
      }
    };

    // Trigger instant location alignment on mount / status transitions
    syncDriverLocation();

    // Recheck location every 12 seconds to ensure high accuracy
    const trackTimer = setInterval(syncDriverLocation, 12000);
    return () => clearInterval(trackTimer);
  }, [userPhone, isOnline, settings?.city]);

  const handleLogout = () => {
    localStorage.removeItem('dd_user_phone');
    setUserPhone(null);
    setCurrentView('home');
    triggerToast('您的司机端安全会话已安全退出断开！');
  };

  // Real-time synchronization for global online billing rules configured in Admin Panel
  useEffect(() => {
    const configDocRef = doc(db, 'config', 'online_billing_rules');
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const activeName = data.activeTemplateName || '系统默认线上计费模版';
        const templatesList = data.templates || [];
        const found = templatesList.find((t: any) => t.templateName === activeName);
        if (found) {
          setOnlineBillingRules(found);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sinks to disk
  useEffect(() => {
    localStorage.setItem('dd_billing_rules', JSON.stringify(billingRules));
  }, [billingRules]);

  useEffect(() => {
    localStorage.setItem('dd_settings', JSON.stringify(settings));
  }, [settings]);

  // One-time automatic clean-up of legacy QR codes from user session/database to eliminate old center logos/text
  useEffect(() => {
    const isCleaned = localStorage.getItem('dd_qr_clean_v3') === 'true';
    if (!isCleaned) {
      localStorage.setItem('dd_qr_clean_v3', 'true');
      const cleanLegacyQrs = async () => {
        let updated = false;
        const newSettings = { ...settings };
        
        if (settings.wechatQrCode) {
          try {
            const cleaned = await regenerateQRCode(settings.wechatQrCode, 'wechat');
            if (cleaned && cleaned !== settings.wechatQrCode) {
              newSettings.wechatQrCode = cleaned;
              updated = true;
            }
          } catch (e) {
            console.error("Auto-heal WeChat QR failed: ", e);
          }
        }
        
        if (settings.alipayQrCode) {
          try {
            const cleaned = await regenerateQRCode(settings.alipayQrCode, 'alipay');
            if (cleaned && cleaned !== settings.alipayQrCode) {
              newSettings.alipayQrCode = cleaned;
              updated = true;
            }
          } catch (e) {
            console.error("Auto-heal Alipay QR failed: ", e);
          }
        }
        
        if (updated) {
          setSettings(newSettings);
        }
      };
      
      cleanLegacyQrs();
    }
  }, []);

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
            if (data.customAppName !== undefined && prev.customAppName !== data.customAppName) {
              nextSettings.customAppName = data.customAppName;
              changed = true;
            }
            if (data.wechatQrCode !== undefined && prev.wechatQrCode !== data.wechatQrCode) {
              nextSettings.wechatQrCode = data.wechatQrCode;
              changed = true;
            }
            if (data.alipayQrCode !== undefined && prev.alipayQrCode !== data.alipayQrCode) {
              nextSettings.alipayQrCode = data.alipayQrCode;
              changed = true;
            }
            if (data.billingTemplateName !== undefined && prev.billingTemplateName !== data.billingTemplateName) {
              nextSettings.billingTemplateName = data.billingTemplateName;
              changed = true;
            }
            if (data.voiceBroadcast !== undefined && prev.voiceBroadcast !== data.voiceBroadcast) {
              nextSettings.voiceBroadcast = data.voiceBroadcast;
              changed = true;
            }
            if (data.accountBalance !== undefined && prev.accountBalance !== data.accountBalance) {
              nextSettings.accountBalance = data.accountBalance;
              changed = true;
            }
            if (data.startServiceSMS !== undefined && prev.startServiceSMS !== data.startServiceSMS) {
              nextSettings.startServiceSMS = data.startServiceSMS;
              changed = true;
            }
            if (data.endServiceSMS !== undefined && prev.endServiceSMS !== data.endServiceSMS) {
              nextSettings.endServiceSMS = data.endServiceSMS;
              changed = true;
            }
            if (data.smsContent !== undefined && prev.smsContent !== data.smsContent) {
              nextSettings.smsContent = data.smsContent;
              changed = true;
            }
            if (data.homepageColorway !== undefined && prev.homepageColorway !== data.homepageColorway) {
              nextSettings.homepageColorway = data.homepageColorway;
              changed = true;
            }
            if (data.deviationMitigation !== undefined && prev.deviationMitigation !== data.deviationMitigation) {
              nextSettings.deviationMitigation = data.deviationMitigation;
              changed = true;
            }
            if (data.deviationKm !== undefined && prev.deviationKm !== data.deviationKm) {
              nextSettings.deviationKm = data.deviationKm;
              changed = true;
            }
            if (data.deviationWaitSec !== undefined && prev.deviationWaitSec !== data.deviationWaitSec) {
              nextSettings.deviationWaitSec = data.deviationWaitSec;
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
          customAppName: settings.customAppName || '',
          wechatQrCode: settings.wechatQrCode || '',
          alipayQrCode: settings.alipayQrCode || '',
          billingTemplateName: settings.billingTemplateName || '',
          voiceBroadcast: settings.voiceBroadcast || '',
          accountBalance: settings.accountBalance || 0,
          startServiceSMS: !!settings.startServiceSMS,
          endServiceSMS: !!settings.endServiceSMS,
          smsContent: settings.smsContent || '',
          homepageColorway: settings.homepageColorway || 'green',
          deviationMitigation: !!settings.deviationMitigation,
          deviationKm: settings.deviationKm ?? 1.0,
          deviationWaitSec: settings.deviationWaitSec ?? 30,
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

  // Listen for real-time incoming passenger orders from passenger self-service scans or admin dispatching
  useEffect(() => {
    if (!userPhone) return;

    const docRef = doc(db, 'passenger_links', userPhone);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.status === 'submitted') {
          const submitTime = data.timestamp || 0;
          // Verify submission timestamp to avoid processing historical stales (last 5 mins)
          if (submitTime > Date.now() - 300000) {
            // Only trigger if we are NOT on the 'create_order' (手动报单) view
            if (currentView !== 'create_order') {
              setIncomingOrder(data);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [userPhone, currentView]);

  const handleAcceptIncomingOrder = (trip: TripState) => {
    if (!userPhone) return;
    setCurrentTrip(trip);
    setCurrentView('navigation');
    setIncomingOrder(null);
    triggerToast('✓ 成功确认接单！线上单已直接并入计费导航大屏。');
    // Clear/delete the passenger link doc to finish the session
    deleteDoc(doc(db, 'passenger_links', userPhone)).catch(err => {
      console.error("Error clearing accepted passenger order link document:", err);
    });
  };

  const handleDeclineIncomingOrder = () => {
    if (!userPhone) return;
    setIncomingOrder(null);
    triggerToast('已拒收/取消当前派发的线上订单。');
    // Clear/delete the passenger link doc to finish the session
    deleteDoc(doc(db, 'passenger_links', userPhone)).catch(err => {
      console.error("Error clearing declined passenger order link document:", err);
    });
  };

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
    // Record to driver order history
    if (currentTrip) {
      try {
        const existingStr = localStorage.getItem('dd_driver_orders');
        let orders = existingStr ? JSON.parse(existingStr) : [];
        if (!Array.isArray(orders)) orders = [];
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        // Filter out orders older than half a year (6 months)
        orders = orders.filter((order: any) => {
          if (!order) return false;
          if (order.timestamp) {
            return new Date(order.timestamp) >= sixMonthsAgo;
          }
          if (order.id && !isNaN(Number(order.id))) {
            const ts = Number(order.id);
            if (ts > 1500000000000) {
              return new Date(ts) >= sixMonthsAgo;
            }
          }
          if (order.timeStr && typeof order.timeStr === 'string') {
            const parts = order.timeStr.match(/(\d+)-(\d+)\s+(\d+):(\d+)/);
            if (parts) {
              const month = parseInt(parts[1], 10) - 1;
              const day = parseInt(parts[2], 10);
              const hour = parseInt(parts[3], 10);
              const min = parseInt(parts[4], 10);
              const orderDate = new Date(now.getFullYear(), month, day, hour, min);
              if (orderDate > now) {
                orderDate.setFullYear(now.getFullYear() - 1);
              }
              return orderDate >= sixMonthsAgo;
            }
          }
          return true;
        });

        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const newOrder = {
          id: currentTrip.id || Date.now().toString(),
          timeStr: `${month}-${day} ${hours}:${minutes}`,
          timestamp: Date.now(),
          amount: amount,
          startLocation: currentTrip.startLocation || '未定位起点',
          endLocation: currentTrip.endLocation || '未定位终点',
          type: currentTrip.orderType || (currentTrip.isOnlineOrder ? '乘客下单' : '报单'),
          status: '已支付'
        };
        orders.unshift(newOrder);
        localStorage.setItem('dd_driver_orders', JSON.stringify(orders));
      } catch (e) {
        console.error('Failed to save order to history:', e);
      }
    }

    // Add up stats securely
    const nextPoints = (stats.myPoints || 0) + 1;
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
    if (userPhone) {
      const userDocRef = doc(db, 'driver_users', userPhone);
      setDoc(userDocRef, {
        phoneNumber: userPhone,
        vipExpiry: newSettings.vipExpiry || '',
        customAppName: newSettings.customAppName || '',
        wechatQrCode: newSettings.wechatQrCode || '',
        alipayQrCode: newSettings.alipayQrCode || '',
        billingTemplateName: newSettings.billingTemplateName || '',
        voiceBroadcast: newSettings.voiceBroadcast || '',
        accountBalance: newSettings.accountBalance ?? 0,
        startServiceSMS: !!newSettings.startServiceSMS,
        endServiceSMS: !!newSettings.endServiceSMS,
        smsContent: newSettings.smsContent || '',
        homepageColorway: newSettings.homepageColorway || 'green',
        deviationMitigation: !!newSettings.deviationMitigation,
        deviationKm: newSettings.deviationKm ?? 1.0,
        deviationWaitSec: newSettings.deviationWaitSec ?? 30,
        onlineOrdersEnabled: !!newSettings.onlineOrdersEnabled,
        city: newSettings.city || '',
        isBanned: !!newSettings.isBanned,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error("Error syncing user settings update to Firestore:", err);
      });
    }
  };

  // --- 3. Page Router dispatcher ---
  const renderView = () => {
    if (mobileActiveTab === 'passenger' || passengerDriverPhone) {
      return (
        <PassengerOrderView 
          driverPhone={passengerDriverPhone || userPhone || '18609518888'}
          onUnlockAdmin={() => {
            setMobileActiveTab('admin');
            triggerToast('🔒 请正确核对并输入运营安全系统账号与安全密钥');
          }}
          onClose={() => {
            if (mobileActiveTab === 'passenger') {
              setMobileActiveTab('app');
            } else {
              // Remove ?driver=xxxxx query param and reset passenger state to access demo
              const newUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              setPassengerDriverPhone(null);
            }
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
              customAppName: 'XX代驾'
            }));
            triggerToast('🎉 设备签署校验通过，欢迎重新登录回一键代驾系统！');
          }}
        />
      );
    }

    if (incomingOrder && currentView !== 'create_order') {
      return (
        <IncomingOrderOverlay
          order={incomingOrder}
          driverCoords={driverCoords}
          onlineBillingRules={onlineBillingRules}
          onAccept={handleAcceptIncomingOrder}
          onDecline={handleDeclineIncomingOrder}
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
            billingRules={currentTrip.isOnlineOrder ? onlineBillingRules : billingRules}
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
    <div className="h-screen w-screen bg-[#07080b] flex flex-col items-center justify-start overflow-hidden text-slate-200 antialiased font-sans">
      
      {/* Top Professional Control Center Header Bar for real-time developers */}
      <div className="w-full bg-[#111625] border-b border-[#212b44] px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/10">
            <Database className="w-4 h-4 text-slate-900 font-bold" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-wide text-white">XX代驾 - 开发者智能调试工作台</h1>
            <p className="text-[9px] sm:text-[10px] text-gray-400">实时观察数据库变动 / 账号模拟 / 优惠券代码秒发</p>
          </div>
        </div>

        {/* View togglers for flexible debugging */}
        <div className="flex items-center bg-[#1b233a] rounded-full p-1 border border-gray-700/50 text-xs font-semibold shrink-0">
          <button
            onClick={() => setMobileActiveTab('app')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              mobileActiveTab === 'app'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>手机端(司机)</span>
          </button>

          <button
            onClick={() => setMobileActiveTab('passenger')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              mobileActiveTab === 'passenger'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>乘客自助端(代开单)</span>
          </button>
          
          <button
            onClick={() => setMobileActiveTab('admin')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              mobileActiveTab === 'admin'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>管理后台</span>
          </button>
        </div>
      </div>

      {/* Main split-screen or single workspace zone */}
      <div className="flex-1 w-full max-w-[1550px] mx-auto p-3 sm:p-5 flex flex-row items-stretch justify-center gap-6 overflow-hidden">
        
        {/* Left pane: Smartphone simulator containing driver client app or passenger self booking view */}
        <div className={`flex flex-col items-center justify-center transition-all duration-300 shrink-0 ${
          mobileActiveTab === 'app' || mobileActiveTab === 'passenger' ? 'flex-1 max-w-[420px] w-full' : 'hidden lg:flex lg:w-[400px]'
        }`}>
          <div className="relative w-full h-full sm:h-[82vh] sm:max-h-[820px] sm:rounded-[40px] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] sm:border-8 sm:border-[#1e293b] bg-[#f8fafc] flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col relative overflow-hidden text-[#333333]">
              {renderView()}

              {/* Top floating toasts */}
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
            </div>
          </div>
        </div>

        {/* Right pane / Center AdminPanel (Hidden if mobileActiveTab is app on mobile, but visible/scrollable as a secondary panel on lg: screens!) */}
        <div className={`transition-all duration-300 bg-[#111625]/90 border border-[#212b44] rounded-3xl overflow-hidden flex flex-col ${
          mobileActiveTab === 'admin' ? 'flex-1 w-full' : 'hidden lg:flex lg:flex-1'
        }`}>
          <div className="flex-1 overflow-y-auto">
            <AdminPanel />
          </div>
        </div>

      </div>

      {/* Persistent helper watermark for comfortable navigation */}
      <div className="w-full bg-[#0a0d17] py-2 px-4 text-center border-t border-[#121927] shrink-0 text-[10px] text-gray-500 flex justify-between items-center z-40">
        <span>XX代驾 © 2026 调试环境已对接云端（系统自动检测到 Firebase 联动机制健全）</span>
        <button 
          onClick={() => {
            setMobileActiveTab(mobileActiveTab === 'app' ? 'passenger' : mobileActiveTab === 'passenger' ? 'admin' : 'app');
          }}
          className="text-teal-400 hover:text-teal-300 cursor-pointer lg:hidden font-medium"
        >
          {mobileActiveTab === 'app' ? '切换至乘客端 ➔' : mobileActiveTab === 'passenger' ? '切换至后台 ➔' : '返回手机端 ➔'}
        </button>
        <span className="hidden lg:inline text-gray-400 font-mono text-[9px]">
          建议宽屏设备下并排操作：左侧模拟接单，右侧调试审核 ⚡
        </span>
      </div>

    </div>
  );
}
