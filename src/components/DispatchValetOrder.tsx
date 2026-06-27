import React, { useState, useEffect, useRef } from 'react';
import { db, collection, doc, setDoc, onSnapshot } from '../lib/dbProxy';
import { ALL_CITIES_FLAT } from '../constants/cities';
import { BillingRules, DEFAULT_BILLING_RULES } from '../types';
import { 
  Plus, 
  MapPin, 
  Search, 
  Navigation, 
  ToggleLeft, 
  ToggleRight, 
  Locate, 
  CheckCircle, 
  Loader2, 
  Users, 
  Settings, 
  X, 
  HelpCircle,
  TrendingUp,
  Briefcase,
  Compass,
  AlertTriangle
} from 'lucide-react';

// Haversine Distance Formula (直线距离计算)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

interface DispatchValetOrderProps {
  onShowToast: (msg: string) => void;
}

interface SimulatedDriver {
  phone: string;
  name: string;
  lat: number;
  lng: number;
  drivingYears: number;
  avatar: string;
}

export default function DispatchValetOrder({ onShowToast }: DispatchValetOrderProps) {
  // 1. 城市选择与自动派单配置状态
  const [selectedCity, setSelectedCity] = useState('银川市');
  const [cityDispatchEnabled, setCityDispatchEnabled] = useState(false);
  const [cityConfigLoading, setCityConfigLoading] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // 2. 乘客/派单录入核心信息 (双向秒同步)
  const [passengerPhone, setPassengerPhone] = useState('');
  const [passengerAddress, setPassengerAddress] = useState('银川金凤万达广场东门');
  const [passengerDestination, setPassengerDestination] = useState('');
  const [passengerCoords, setPassengerCoords] = useState<{ lat: number; lng: number }>({
    lat: 38.487193,
    lng: 106.230912
  });
  const [passengerDestinationCoords, setPassengerDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [onlineBillingRules, setOnlineBillingRules] = useState<BillingRules | null>(null);

  // GPS 实时位置感知与同步状态名
  const [currentGPSPlaceName, setCurrentGPSPlaceName] = useState('定位获取中...');
  const [isLocating, setIsLocating] = useState(false);

  // 3. 地图定位与搜索自动联想
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const drivingInstanceRef = useRef<any>(null);
  const isUserDraggingRef = useRef(false);
  const centerMarkerInstanceRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [clickedMapDriver, setClickedMapDriver] = useState<any | null>(null);

  // 4. 在线听单司机控制机制 (仿真 3km 司机 v.s. 云端真实注册司机)
  const [driverMode, setDriverMode] = useState<'real' | 'simulated'>('simulated');
  const [realDrivers, setRealDrivers] = useState<any[]>([]);
  const [simulatedDrivers, setSimulatedDrivers] = useState<SimulatedDriver[]>([]);
  const driverMarkersRef = useRef<any[]>([]);

  // 5. 线上派单的临时动态交互结果状态
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);

  // 六、行政区域过滤
  const filteredCities = ALL_CITIES_FLAT.filter(city => 
    city.name.includes(citySearchQuery) || 
    city.pinyin.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  // ==================== 核心GPS定位自动获取与同步机制 ====================
  const handleMapLocateSelf = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      onShowToast('❌ 您的浏览器不支持物理地理定位。');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPassengerCoords({ lat, lng });

        // 调用高德进行座标逆解析
        const AMap = (window as any).AMap;
        if (AMap && AMap.Geocoder) {
          const geocoder = new AMap.Geocoder({
            city: selectedCity,
            radius: 1000
          });
          geocoder.getAddress([lng, lat], (status: string, result: any) => {
            setIsLocating(false);
            if (status === 'complete' && result.regeocode) {
              const formattedAddress = result.regeocode.formattedAddress;
              const simpleAddress = formattedAddress
                .replace(result.regeocode.addressComponent.province, '')
                .replace(result.regeocode.addressComponent.city, '')
                .replace(result.regeocode.addressComponent.district, '') || '当前定位点';

              // 自动实时将当前位置地标同步为乘客的起点
              setCurrentGPSPlaceName(simpleAddress);
              setPassengerAddress(simpleAddress);

              // 归中地图
              const map = mapInstanceRef.current;
              if (map) {
                map.setCenter([lng, lat]);
                map.setZoom(15);
              }
              onShowToast(`🧭 成功获取您的当前位置并同步为乘客起点：【${simpleAddress}】`);
            } else {
              // 无法解析出名字，则直接同步座标
              setCurrentGPSPlaceName(`经纬度点: ${lng.toFixed(5)}, ${lat.toFixed(5)}`);
              setPassengerAddress(`经纬度位置 (${lng.toFixed(5)}, ${lat.toFixed(5)})`);
              const map = mapInstanceRef.current;
              if (map) {
                map.setCenter([lng, lat]);
              }
            }
          });
        } else {
          setIsLocating(false);
          onShowToast('⚠️ AMap Geocoder 尚未加载完毕，定位点将延迟同步。');
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS 定位获取失败，采用高德默认位置:', err.message);
        onShowToast('⚠️ 获取 GPS 定位失败，请检查浏览器定位权限。');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // 初始化自动定位
  useEffect(() => {
    const timer = setTimeout(() => {
      handleMapLocateSelf();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 二、一键激活、关闭选定城市云端同步派单闸配置
  useEffect(() => {
    setCityConfigLoading(true);
    const docRef = doc(db, 'city_dispatch_config', selectedCity);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCityDispatchEnabled(!!data.enabled);
      } else {
        setCityDispatchEnabled(false);
      }
      setCityConfigLoading(false);
    }, (error) => {
      console.warn("读取城市派单配置失败:", error);
      setCityConfigLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCity]);

  const handleToggleCityDispatch = async () => {
    const nextVal = !cityDispatchEnabled;
    setCityDispatchEnabled(nextVal);
    try {
      await setDoc(doc(db, 'city_dispatch_config', selectedCity), {
        city: selectedCity,
        enabled: nextVal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      onShowToast(`✓ 已成功保存【${selectedCity}】的一键线上自动派单闸状态为：${nextVal ? '激活中' : '已挂起'}`);
    } catch (e: any) {
      alert("配置云同步失败，请检查数据库链路授权 rules:" + e.message);
    }
  };

  // 三、实时拉取 Firestore 全体真实的司机 users_online
  useEffect(() => {
    const q = collection(db, 'driver_users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.onlineOrdersEnabled && !data.isBanned) {
          list.push({
            phone: d.id,
            name: data.customAppName || '特约代驾司机',
            lat: data.lat || (passengerCoords.lat + (Math.random() - 0.5) * 0.04),
            lng: data.lng || (passengerCoords.lng + (Math.random() - 0.5) * 0.04),
            drivingYears: data.drivingYears || 6,
            avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${d.id}`
          });
        }
      });
      setRealDrivers(list);
    });

    return () => unsubscribe();
  }, []);

  // 四、智能仿真司机列表发生变化 (当起点 passengerCoords 变更时，更新 3 公里仿真线上接单车辆分布)
  useEffect(() => {
    const generateSimulatedDrivers = (centerLat: number, centerLng: number) => {
      const names = ['李卫国', '赵崇兵', '王福生', '钱志朋', '孙浩澜', '陈铁柱', '马学峰'];
      const suffixes = ['师傅', '代驾星级老手', '星级专家', '白金尊享代驾'];
      const drivers: SimulatedDriver[] = [];

      for (let i = 0; i < 6; i++) {
        const radiusInKm = 0.5 + Math.random() * 2.3; // 分布在 0.5km 至 2.8km 的范围内
        const angle = Math.random() * 2 * Math.PI;
        const offsetLat = (radiusInKm / 111) * Math.sin(angle);
        const offsetLng = (radiusInKm / (111 * Math.cos(centerLat * Math.PI / 180))) * Math.cos(angle);

        const phoneNum = `15${String(Math.floor(100000000 + Math.random() * 900000000))}`;
        const nameVal = `${names[i % names.length]}${suffixes[i % suffixes.length]}`;

        drivers.push({
          phone: phoneNum,
          name: nameVal,
          lat: Number((centerLat + offsetLat).toFixed(6)),
          lng: Number((centerLng + offsetLng).toFixed(6)),
          drivingYears: 5 + Math.floor(Math.random() * 11),
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${nameVal}`
        });
      }
      setSimulatedDrivers(drivers);
    };

    generateSimulatedDrivers(passengerCoords.lat, passengerCoords.lng);
  }, [passengerCoords.lat, passengerCoords.lng]);

  // 五、高德 2D 交互地图初始化与双向同步
  useEffect(() => {
    (window as any)._AMapSecurityConfig = {
      securityJsCode: '0aa3912e6a88fe59f9e5f0275524feba'
    };

    const loadAMap = () => {
      const AMap = (window as any).AMap;
      if (!AMap || !mapContainerRef.current) return;

      try {
        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 14,
          center: [passengerCoords.lng, passengerCoords.lat],
          viewMode: '2D',
          pitch: 0,
          rotateEnable: false,
          pitchEnable: false,
          resizeEnable: true
        });

        mapInstanceRef.current = map;

        AMap.plugin(['AMap.Geocoder', 'AMap.PlaceSearch'], () => {
          setIsMapLoaded(true);
        });

        // 顶层红心定位销(十字星)，标定当前的绝对业务中心
        const centerMarker = new AMap.Marker({
          position: map.getCenter(),
          content: `<div class="relative flex items-center justify-center pointer-events-none">
            <div class="absolute -top-10 flex flex-col items-center animate-bounce">
              <div class="bg-indigo-650 border border-teal-400 outline outline-4 outline-slate-950 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl shadow-2xl flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                拖拽此处设为起点
              </div>
              <div class="w-2h-2 bg-indigo-650 border-r border-b border-teal-400 rotate-45 -mt-1 shadow-lg"></div>
            </div>
            <div class="w-5 h-5 rounded-full bg-teal-500/30 border border-teal-400 flex items-center justify-center shadow-lg">
              <div class="w-2.5 h-2.5 bg-teal-400 rounded-full"></div>
            </div>
          </div>`,
          offset: new AMap.Pixel(0, 0),
          clickable: false
        });
        centerMarker.setMap(map);
        centerMarkerInstanceRef.current = centerMarker;

        // 滑动拖动地图：自动校准十字星准瞬时，反向逆地理同步 “乘客起点输入框” 的内容
        map.on('dragstart', () => {
          isUserDraggingRef.current = true;
        });

        map.on('moveend', () => {
          if (!isUserDraggingRef.current) return;
          isUserDraggingRef.current = false;

          const center = map.getCenter();
          const nextLat = center.getLat();
          const nextLng = center.getLng();

          setPassengerCoords({ lat: nextLat, lng: nextLng });
          // 在拖拖校准时隐藏提示输入字联想
          setShowSuggestions(false);

          const geocoder = new AMap.Geocoder({
            city: selectedCity,
            radius: 1000
          });

          geocoder.getAddress([nextLng, nextLat], (status: string, result: any) => {
            if (status === 'complete' && result.regeocode) {
              const formattedAddress = result.regeocode.formattedAddress;
              const simpleAddress = formattedAddress
                .replace(result.regeocode.addressComponent.province, '')
                .replace(result.regeocode.addressComponent.city, '')
                .replace(result.regeocode.addressComponent.district, '') || '未知街区';

              // 双向秒同步：当前GPS位置名与乘客起点输入框
              setPassengerAddress(simpleAddress);
              setCurrentGPSPlaceName(simpleAddress);
            }
          });
        });

      } catch (err) {
        console.error('AMap 2D map loader failed:', err);
      }
    };

    if (!(window as any).AMap) {
      const script = document.createElement('script');
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=4143e567d55bbc1855231f9637efd6b0';
      script.async = true;
      script.defer = true;
      script.onload = loadAMap;
      document.head.appendChild(script);
    } else {
      loadAMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
      }
    };
  }, []);

  // 城市选择发生变更时，重定位到该城市的中心区
  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    setShowCityDropdown(false);
    setCitySearchQuery('');

    const map = mapInstanceRef.current;
    if (!map) return;

    const AMap = (window as any).AMap;
    if (AMap) {
      AMap.plugin('AMap.PlaceSearch', () => {
        const placeSearch = new AMap.PlaceSearch({
          city: cityName,
          pageSize: 1
        });
        placeSearch.search(cityName, (status: string, result: any) => {
          if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
            const first = result.poiList.pois[0];
            if (first.location) {
              map.setCenter([first.location.lng, first.location.lat]);
              map.setZoom(13);
              setPassengerCoords({ lat: first.location.lat, lng: first.location.lng });
              setPassengerAddress(`${cityName}中心城区`);
              onShowToast(`📍 地图已极速归中至目标城市：【${cityName}】`);
            }
          }
        });
      });
    }
  };

  // 六、在地图上实时更新/绘制活跃的听单司机 Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    // 清理先前的旧标记
    driverMarkersRef.current.forEach(m => m.setMap(null));
    driverMarkersRef.current = [];

    const activeDrivers = driverMode === 'simulated' ? simulatedDrivers : realDrivers;
    const AMap = (window as any).AMap;

    activeDrivers.forEach((driver) => {
      const dist = calculateDistance(passengerCoords.lat, passengerCoords.lng, driver.lat, driver.lng);
      const isInRange = dist <= 3.0;

      const dMarker = new AMap.Marker({
        position: [driver.lng, driver.lat],
        content: `<div class="relative flex flex-col items-center group cursor-pointer">
          <div class="px-2.5 py-1 bg-slate-950/95 border ${isInRange ? 'border-teal-500/90 text-teal-400' : 'border-amber-500/80 text-amber-500'} text-[10px] font-black rounded-lg shadow-2xl mb-1.5 whitespace-nowrap transition-transform hover:scale-105">
            ${driver.name} (直距 ${dist.toFixed(2)}km)
          </div>
          <div class="w-8.5 h-8.5 rounded-full border-2 ${isInRange ? 'border-teal-400 bg-slate-900' : 'border-amber-400 bg-slate-950'} flex items-center justify-center shadow-2xl">
            <svg viewBox="0 0 24 24" class="w-4 h-4 ${isInRange ? 'text-teal-400 animate-pulse' : 'text-amber-500'} fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1-1.5 1zm11 0c-.83 0-1.5-.67-1.5-1s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1-1.5 1z" />
            </svg>
          </div>
        </div>`,
        offset: new AMap.Pixel(0, 0)
      });

      dMarker.setMap(map);

      // 单击司机 Marker 即可瞬时拉起地图高定强行指派下单(不限距离)功能，突破围栏限制
      dMarker.on('click', () => {
        setClickedMapDriver(driver);
        onShowToast(`🎯 精确点击锁定了在线代驾司机：【${driver.name}】，您可在弹窗中对其无视距离直接强制指派下单！`);
      });

      driverMarkersRef.current.push(dMarker);
    });

  }, [simulatedDrivers, realDrivers, driverMode, passengerCoords, isMapLoaded]);

  // 七、起点输入关键字一键联想解析与定位
  useEffect(() => {
    const AMap = (window as any).AMap;
    if (!AMap || !passengerAddress.trim() || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      AMap.plugin('AMap.AutoComplete', () => {
        const auto = new AMap.AutoComplete({
          city: selectedCity,
          citylimit: true
        });
        auto.search(passengerAddress, (status: string, result: any) => {
          if (status === 'complete' && result.tips) {
            setSuggestions(result.tips.filter((t: any) => t.location && t.name));
          } else {
            setSuggestions([]);
          }
        });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [passengerAddress, selectedCity, showSuggestions]);

  // 处理在输入下拉补全中选择地点
  const handleSelectSuggestion = (tip: any) => {
    const map = mapInstanceRef.current;
    if (map && tip.location) {
      const { lng, lat } = tip.location;
      map.setCenter([lng, lat]);
      map.setZoom(15);
      setPassengerAddress(tip.name);
      setPassengerCoords({ lat, lng });
      setShowSuggestions(false);
      setSuggestions([]);
      onShowToast(`📍 起点已精确定位至：【${tip.name}】`);
    }
  };

  // Fetch active online billing rules
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

  // 自动在后台规划路线并计算价格 (当出发地和目的地都选择好之后)
  useEffect(() => {
    if (
      passengerCoords &&
      passengerDestinationCoords &&
      passengerAddress.trim() &&
      passengerDestination.trim()
    ) {
      const AMap = (window as any).AMap;
      const map = mapInstanceRef.current;
      if (!AMap || !map) return;

      AMap.plugin('AMap.Driving', () => {
        try {
          if (!drivingInstanceRef.current) {
            drivingInstanceRef.current = new AMap.Driving({
              map: map,
              hideMarkers: false,
              autoFitView: true,
            });
          } else {
            try {
              drivingInstanceRef.current.clear();
            } catch (_) {}
          }

          const onRouteComplete = (status: string, result: any) => {
            if (status === 'complete' && result.routes && result.routes[0]) {
              const distanceMeters = AntiquityDrivingCleanDist(result.routes[0].distance);
              const distanceKm = Number((distanceMeters / 1000).toFixed(2));
              setEstimatedDistance(distanceKm);

              const calculated = calculatePriceWithRules(distanceKm);
              setEstimatedPrice(calculated);
              onShowToast(`🚗 智能后台路线规划成功！路程：${distanceKm}公里，自动计算预估代单价格：约 ${calculated} 元`);
            } else {
              console.warn('AMap.Driving status:', status, result);
              const hDist = calculateDistance(
                passengerCoords.lat,
                passengerCoords.lng,
                passengerDestinationCoords.lat,
                passengerDestinationCoords.lng
              );
              const estDrivingKm = Number((hDist * 1.3).toFixed(2));
              setEstimatedDistance(estDrivingKm);
              const calculated = calculatePriceWithRules(estDrivingKm);
              setEstimatedPrice(calculated);
              onShowToast(`🚗 路径分析偏差，后台自动通过测距计算预估价格：约 ${calculated} 元`);
            }
          };

          const origin = new AMap.LngLat(passengerCoords.lng, passengerCoords.lat);
          const destination = new AMap.LngLat(passengerDestinationCoords.lng, passengerDestinationCoords.lat);
          drivingInstanceRef.current.search(origin, destination, onRouteComplete);
        } catch (e) {
          console.warn('Auto background driving search failed:', e);
        }
      });
    }
  }, [
    passengerCoords.lat,
    passengerCoords.lng,
    passengerDestinationCoords?.lat,
    passengerDestinationCoords?.lng
  ]);

  // 目的地输入关键字一键联想解析
  useEffect(() => {
    const AMap = (window as any).AMap;
    if (!AMap || !passengerDestination.trim() || !showDestSuggestions) {
      setDestSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      AMap.plugin('AMap.AutoComplete', () => {
        const auto = new AMap.AutoComplete({
          city: selectedCity,
          citylimit: true
        });
        auto.search(passengerDestination, (status: string, result: any) => {
          if (status === 'complete' && result.tips) {
            setDestSuggestions(result.tips.filter((t: any) => t.location && t.name));
          } else {
            setDestSuggestions([]);
          }
        });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [passengerDestination, selectedCity, showDestSuggestions]);

  // 处理在目的地输入下拉补全中选择地点并自动触发规划
  const handleSelectDestSuggestion = (tip: any) => {
    if (tip.location) {
      const { lng, lat } = tip.location;
      setPassengerDestination(tip.name);
      setPassengerDestinationCoords({ lat, lng });
      setShowDestSuggestions(false);
      setDestSuggestions([]);
      onShowToast(`📍 目的地已确定：【${tip.name}】，点击“确定”按钮即可自动规划路线并算出估价`);
    }
  };

  const calculatePriceWithRules = (tripDist: number): number => {
    if (onlineBillingRules && onlineBillingRules.slots && onlineBillingRules.slots.length > 0) {
      try {
        const activeHour = new Date().getHours();
        let activeSlot = onlineBillingRules.slots[0];
        
        for (const slot of onlineBillingRules.slots) {
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
        if (tripDist > freeKm) {
          distanceCost = Math.ceil((tripDist - freeKm) / interval) * increase;
        }
        
        let returnCost = 0;
        const returnStart = onlineBillingRules.returnFeeStartKm ?? 15;
        const returnPerKm = onlineBillingRules.returnFeePerKm ?? 2;
        if (tripDist > returnStart) {
          returnCost = Math.ceil(tripDist - returnStart) * returnPerKm;
        }
        
        return base + distanceCost + returnCost;
      } catch (e) {
        console.warn('Error calculating approxPrice with onlineBillingRules, falling back:', e);
      }
    }
    return 38;
  };

  const handleConfirmRouteAndEstimatePrice = () => {
    if (!passengerAddress.trim()) {
      alert('⚠️ 请先输入并定位乘客起点地址！');
      return;
    }
    if (!passengerDestination.trim()) {
      alert('⚠️ 请先输入目的地终点！');
      return;
    }

    const AMap = (window as any).AMap;
    const map = mapInstanceRef.current;
    if (!AMap || !map) {
      onShowToast('⚠️ 地图组件尚未完全载入，请稍候');
      return;
    }

    onShowToast('🔄 正在智能计算并规划最优路线...');

    AMap.plugin('AMap.Driving', () => {
      try {
        if (!drivingInstanceRef.current) {
          drivingInstanceRef.current = new AMap.Driving({
            map: map,
            hideMarkers: false,
            autoFitView: true,
          });
        } else {
          try {
            drivingInstanceRef.current.clear();
          } catch (_) {}
        }

        const onRouteComplete = (status: string, result: any) => {
          if (status === 'complete' && result.routes && result.routes[0]) {
            const distanceMeters = AntiquityDrivingCleanDist(result.routes[0].distance);
            const distanceKm = Number((distanceMeters / 1000).toFixed(2));
            setEstimatedDistance(distanceKm);

            const calculated = calculatePriceWithRules(distanceKm);
            setEstimatedPrice(calculated);
            onShowToast(`🚗 路线规划完毕！路程：${distanceKm}公里，按线上模板算出预估价格：约 ${calculated} 元`);
          } else {
            console.warn('AMap.Driving status:', status, result);
            if (passengerCoords && passengerDestinationCoords) {
              const hDist = calculateDistance(
                passengerCoords.lat,
                passengerCoords.lng,
                passengerDestinationCoords.lat,
                passengerDestinationCoords.lng
              );
              const estDrivingKm = Number((hDist * 1.3).toFixed(2));
              setEstimatedDistance(estDrivingKm);
              const calculated = calculatePriceWithRules(estDrivingKm);
              setEstimatedPrice(calculated);
              onShowToast(`🚗 路径分析偏差，采用距离公式估算为 ${estDrivingKm} 公里，价格约 ${calculated} 元`);
            } else {
              const randomDist = 6 + Math.floor(Math.random() * 8);
              setEstimatedDistance(randomDist);
              const calculated = calculatePriceWithRules(randomDist);
              setEstimatedPrice(calculated);
              onShowToast(`🚗 无法获取精准坐标，以 ${randomDist}公里 概略算出价格约 ${calculated} 元`);
            }
          }
        };

        if (passengerCoords && passengerDestinationCoords) {
          const origin = new AMap.LngLat(passengerCoords.lng, passengerCoords.lat);
          const destination = new AMap.LngLat(passengerDestinationCoords.lng, passengerDestinationCoords.lat);
          drivingInstanceRef.current.search(origin, destination, onRouteComplete);
        } else {
          drivingInstanceRef.current.search(
            [
              { keyword: passengerAddress, city: selectedCity },
              { keyword: passengerDestination, city: selectedCity }
            ],
            onRouteComplete
          );
        }
      } catch (e) {
        console.warn('Driving path search failed:', e);
      }
    });
  };

  // Utility to handle any potential undefined or nan values safely
  const AntiquityDrivingCleanDist = (val: any): number => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    return 10000; // default 10km in meters
  };

  // 八、一键匹配派单给附近3公里范围的最近司机 (如果手机号不填则默认使用匿名代派单)
  const handleDispatchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerAddress.trim()) {
      alert('⚠️ 请先输入并定位乘客起点地址！');
      return;
    }

    const activeDrivers = driverMode === 'simulated' ? simulatedDrivers : realDrivers;
    const driversInScope = activeDrivers
      .map(d => ({
        ...d,
        distance: calculateDistance(passengerCoords.lat, passengerCoords.lng, d.lat, d.lng)
      }))
      .filter(d => d.distance <= 3.0);

    if (driversInScope.length === 0) {
      alert('❌ 抱歉，当前起点 3 公里范围内没有任何空闲的执勤代驾司机！您可以尝试使用大屏强指功能或更换起点坐标');
      return;
    }

    const finalPhone = passengerPhone.trim() || '未填写 (匿名代开单)';

    // 2. 匹配直线距离最临近的黄金执勤司机
    driversInScope.sort((a, b) => a.distance - b.distance);
    const closestDriver = driversInScope[0];

    setIsDispatching(true);
    setDispatchResult(null);

    // 给予调度算法寻址配对过渡感
    setTimeout(async () => {
      try {
        const finalDest = passengerDestination.trim() || '由司机根据现场口头协商规划行程';
        const finalPrice = estimatedPrice !== null 
          ? estimatedPrice 
          : (passengerDestination.trim() 
              ? calculatePriceWithRules(closestDriver.distance) 
              : (34 + Math.floor(Math.random() * 30)));

        await setDoc(doc(db, 'passenger_links', closestDriver.phone), {
          passengerPhone: finalPhone,
          startLocation: passengerAddress,
          destination: finalDest,
          status: 'submitted',
          timestamp: Date.now(),
          isValetOrder: true, // 标记为后台一键代客录入开单
          passengerLat: passengerCoords.lat,
          passengerLng: passengerCoords.lng,
          approxPrice: finalPrice
        });

        setIsDispatching(false);
        setDispatchResult({
          driver: closestDriver,
          passengerPhone: finalPhone,
          startLocation: passengerAddress,
          destination: finalDest,
          dist: closestDriver.distance
        });

        // Reset estimations after successful dispatch
        setEstimatedDistance(null);
        setEstimatedPrice(null);
        setPassengerDestination('');
        setPassengerDestinationCoords(null);

        onShowToast(`🎉 一键智能自动匹配派单成功！已直接秒同步派送给 3km 范围内最临近（直距：${(closestDriver.distance * 1000).toFixed(0)} 米）的代驾司机【${closestDriver.name}】，来单估价：约 ${finalPrice} 元`);
      } catch (err: any) {
        setIsDispatching(false);
        alert("线上自动指派通道失败，数据库安全阻截异常:" + err.message);
      }
    }, 1100);
  };

  // 九、对特定点击司机执行——无视3公里区域强行派单逻辑
  const handleForceDispatch = async (driver: any) => {
    if (!driver) return;

    setIsDispatching(true);
    const finalPhone = passengerPhone.trim() || '未填写 (匿名代开单)';
    const dist = calculateDistance(passengerCoords.lat, passengerCoords.lng, driver.lat, driver.lng);
    const finalDest = passengerDestination.trim() || '由司机根据现场口头协商规划行程';
    const finalPrice = estimatedPrice !== null 
      ? estimatedPrice 
      : (passengerDestination.trim() 
          ? calculatePriceWithRules(dist > 0 ? dist : 8) 
          : (34 + Math.floor(Math.random() * 30)));

    try {
      await setDoc(doc(db, 'passenger_links', driver.phone), {
        passengerPhone: finalPhone,
        startLocation: passengerAddress,
        destination: finalDest,
        status: 'submitted',
        timestamp: Date.now(),
        isValetOrder: true,
        passengerLat: passengerCoords.lat,
        passengerLng: passengerCoords.lng,
        approxPrice: finalPrice
      });

      setIsDispatching(false);
      setClickedMapDriver(null);
      setDispatchResult({
        driver,
        passengerPhone: finalPhone,
        startLocation: passengerAddress,
        destination: finalDest,
        dist
      });

      // Reset estimations after successful dispatch
      setEstimatedDistance(null);
      setEstimatedPrice(null);
      setPassengerDestination('');
      setPassengerDestinationCoords(null);

      onShowToast(`🎉 [调度中心强指成功] 已强行突破 3km 限制，指定将代单委派派发给空闲司机：【${driver.name}】，来单估价：约 ${finalPrice} 元！`);
    } catch (err: any) {
      setIsDispatching(false);
      alert("大屏指定指派由于云数据库权限受阻异常: " + err.message);
    }
  };

  return (
    <div className="space-y-6 select-text text-slate-200">
      
      {/* 1. HORIZONTAL CITY DISPATCH CONTROL CENTER (城市业务控制中心改为横向显示) */}
      <div className="bg-[#11131e] border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-left w-full">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-teal-500/10 text-[#189F95] rounded-full text-[10px] font-black uppercase tracking-wider">
              城市业务控制中心
            </span>
            <span className="text-[9.5px] text-slate-500 font-mono">Service Control Hub</span>
            <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-sm">
              Cloud Synced
            </span>
          </div>
          <h3 className="text-sm font-black text-white">选择听单运营区域及总闸</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
            在这里选择开通代驾自动派遣业务的基础行政城市。一键开启或挂起该城市下的全城【线上全自动派单匹配监控闸】，系统将根据用户发单在后台自动秒配。
          </p>
        </div>

        {/* Controls stacked vertically: switch placed below city selector */}
        <div className="flex flex-col gap-3 w-full sm:w-64 shrink-0">
          
          {/* Dropdown City Selector */}
          <div className="relative text-left w-full">
            <label className="text-[9px] font-black tracking-wider text-slate-500 uppercase block mb-1">
              服务辖区城市
            </label>
            <button
              type="button"
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="w-full h-11 px-4 bg-[#0d0e15] border border-slate-850 hover:border-slate-800 rounded-xl text-xs font-black text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>📍 {selectedCity}</span>
              <span className="text-[10px] text-[#189F95]">切换城市 ➔</span>
            </button>

            {showCityDropdown && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-[#121422] border border-slate-800 rounded-2xl shadow-2xl p-2.5 flex flex-col space-y-2 animate-in fade-in duration-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="输入首字母拼音或汉字搜索..."
                    value={citySearchQuery}
                    onChange={(e) => setCitySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#090a0f] border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-teal-500 text-slate-100"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-slate-900/50 flex flex-col">
                  {filteredCities.map((city, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCitySelect(city.name + '市')}
                      className="py-2 px-3.5 text-left text-xs font-bold text-slate-300 hover:bg-slate-950 hover:text-[#189F95] transition-colors rounded-lg flex items-center justify-between cursor-pointer"
                    >
                      <span>{city.name}市</span>
                      <span className="text-[10px] font-mono text-slate-600 block uppercase">{city.pinyin}</span>
                    </button>
                  ))}
                  {filteredCities.length === 0 && (
                    <p className="text-[10px] text-slate-650 text-center py-4">无匹配的代驾服务城市</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cloud Sync Auto Match Switch */}
          <div className="w-full">
            <label className="text-[9px] font-black tracking-wider text-slate-500 uppercase block mb-1">
              线上自动匹配派单闸
            </label>
            <div className="bg-[#090a0f] border border-slate-850 h-11 px-4 rounded-xl flex items-center justify-between gap-4">
              <span className="text-xs font-bold text-slate-300">本城全网监控</span>

              {cityConfigLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <button
                  type="button"
                  onClick={handleToggleCityDispatch}
                  className="cursor-pointer transition-transform hover:scale-105"
                  title={cityDispatchEnabled ? "点击关闭" : "点击开启"}
                >
                  {cityDispatchEnabled ? (
                    <div className="text-emerald-500 flex items-center gap-1.5 group">
                      <span className="text-[9px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/25">ACTIVE 开启</span>
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="text-slate-500 flex items-center gap-1.5 group">
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800">DISABLED 挂起</span>
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 2. MAIN FULL-WIDTH HIGH-DEFINITION INTERACTIVE AMAP (高德地图) */}
      <div className="bg-[#11131e] border border-slate-800 p-4 rounded-3xl shadow-xl relative w-full overflow-hidden">
        
        {/* Map Outer Box */}
        <div className="relative w-full h-[650px] bg-[#0c0e15] rounded-2xl overflow-hidden border border-slate-900/50">
          
          {/* High-Precision Interactive AMap Canvas */}
          <div ref={mapContainerRef} className="w-full h-full" id="manager-dispatch-amap-box" />

          {/* Floating Left Control Panel (Glassmorphic Sidebar Overlay) */}
          <div className="absolute top-4 left-4 bottom-4 w-full max-w-[360px] bg-[#0c0e16]/95 border border-slate-800/80 rounded-2xl shadow-2xl z-30 p-4 flex flex-col justify-between overflow-y-auto backdrop-blur-md animate-in slide-in-from-left-4 duration-300 scrollbar-thin select-text">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 bg-teal-500/10 text-teal-400 rounded-lg text-[9.5px] font-black uppercase tracking-wider">
                    代客录入派单大屏
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Console</span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">一键秒配·大屏调度</span>
              </div>

              {/* Form elements */}
              <form onSubmit={handleDispatchOrder} className="space-y-3.5">
                {/* Passenger Phone */}
                <div className="space-y-1 text-left">
                  <label className="text-[9.5px] font-black tracking-wider text-slate-400 uppercase flex items-center justify-between">
                    <span>乘客特约手机号码</span>
                    <span className="text-[8.5px] text-[#189F95] font-semibold">(选填)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="匿名代开单（选填）"
                    maxLength={11}
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full h-10 px-3 bg-[#06070a] border border-slate-850 focus:border-teal-500 rounded-xl text-xs font-bold focus:outline-none text-slate-100 placeholder:text-slate-700 font-mono tracking-wider"
                  />
                </div>

                {/* Destination */}
                <div className="space-y-1 text-left relative">
                  <label className="text-[9.5px] font-black tracking-wider text-slate-400 uppercase flex items-center justify-between">
                    <span>目的地 / 出发终点 (输入并搜索)</span>
                    {estimatedPrice !== null && (
                      <span className="text-[10px] text-teal-400 font-black tracking-wide">
                        路程: {estimatedDistance}km | 估价: {estimatedPrice}元
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="输入并搜索目的地点"
                    value={passengerDestination}
                    onChange={(e) => {
                      setPassengerDestination(e.target.value);
                      setShowDestSuggestions(true);
                      setEstimatedDistance(null);
                      setEstimatedPrice(null);
                      setPassengerDestinationCoords(null);
                    }}
                    className="w-full h-10 px-3 bg-[#06070a] border border-slate-850 focus:border-teal-500 rounded-xl text-xs font-bold focus:outline-none text-slate-100 placeholder:text-slate-700"
                  />

                  {/* Suggestions Dropdown */}
                  {destSuggestions.length > 0 && showDestSuggestions && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-[#121422]/98 border border-slate-800 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-900 max-h-48 overflow-y-auto flex flex-col p-1 backdrop-blur-md">
                      {destSuggestions.map((tip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectDestSuggestion(tip)}
                          className="py-1.5 px-2.5 text-left text-xs text-slate-300 hover:bg-slate-950 hover:text-[#189F95] transition-colors flex flex-col rounded-lg cursor-pointer"
                        >
                          <span className="font-extrabold text-slate-200 text-[11px]">{tip.name}</span>
                          <span className="text-[9px] text-slate-500 pt-0.5 truncate">{tip.district || ''}{tip.address || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}


                </div>

                {/* Start Location with Autocomplete */}
                <div className="space-y-1 text-left relative">
                  <label className="text-[9.5px] font-black tracking-wider text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">📍 乘客起点地址 <span className="text-teal-400 font-black">(*必填)</span></span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="输入并搜索乘客起点地址"
                      value={passengerAddress}
                      onChange={(e) => {
                        setPassengerAddress(e.target.value);
                        setShowSuggestions(true);
                        setEstimatedDistance(null);
                        setEstimatedPrice(null);
                        setPassengerDestinationCoords(null);
                      }}
                      className="w-full h-10 pl-9 pr-3 bg-[#06070a] border border-slate-850 focus:border-teal-500 rounded-xl text-xs font-black focus:outline-none text-slate-150 placeholder:text-slate-700"
                    />
                    
                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && showSuggestions && (
                      <div className="absolute left-0 right-0 z-50 mt-1 bg-[#121422]/98 border border-slate-800 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-900 max-h-48 overflow-y-auto flex flex-col p-1 backdrop-blur-md">
                        {suggestions.map((tip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSuggestion(tip)}
                            className="py-1.5 px-2.5 text-left text-xs text-slate-300 hover:bg-slate-950 hover:text-[#189F95] transition-colors flex flex-col rounded-lg cursor-pointer"
                          >
                            <span className="font-extrabold text-slate-200 text-[11px]">{tip.name}</span>
                            <span className="text-[9px] text-slate-500 pt-0.5 truncate">{tip.district || ''}{tip.address || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* GPS Location Info */}
                <div className="bg-[#06070a] border border-slate-850/80 p-2 rounded-xl flex items-center justify-between gap-2 text-left">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <Compass className="w-3 h-3 text-teal-400 rotate-45" />
                      <span className="text-[8px] font-extrabold text-slate-500 block tracking-wider uppercase">
                        GPS 地理微调感知
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-teal-400 block truncate" title={currentGPSPlaceName}>
                      {currentGPSPlaceName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleMapLocateSelf}
                    disabled={isLocating}
                    className="px-2 py-1 bg-teal-500/10 border border-teal-500/25 hover:bg-teal-500/20 text-teal-400 rounded-lg text-[9px] font-black flex items-center gap-0.5 cursor-pointer transition-all shrink-0 active:scale-95"
                  >
                    {isLocating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Locate className="w-2.5 h-2.5" />}
                    校准
                  </button>
                </div>

                {/* Auto Match Dispatch Button */}
                <button
                  type="submit"
                  disabled={isDispatching}
                  className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-indigo-500 hover:from-teal-600 hover:to-indigo-600 disabled:opacity-40 text-slate-950 font-black text-xs tracking-wider rounded-xl shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDispatching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      正在配对派单中...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5 text-slate-950 fill-current" />
                      一键智能秒配 (起程3kM内)
                    </>
                  )}
                </button>
              </form>

              {/* Collapsible / Floating Nearby Drivers Accordion/List right in the left panel */}
              <div className="border-t border-slate-900/60 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-black tracking-wider text-slate-400 uppercase flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    附近活跃司机 ({driverMode === 'simulated' ? simulatedDrivers.length : realDrivers.length}台)
                  </span>
                  {/* Miniature Mode Switcher */}
                  <div className="flex bg-[#06070a] border border-slate-900 rounded-lg p-0.5 h-6 text-[9px]">
                    <button
                      type="button"
                      onClick={() => setDriverMode('simulated')}
                      className={`px-2 rounded-md font-bold transition-all ${driverMode === 'simulated' ? 'bg-teal-500/20 text-teal-400' : 'text-slate-500'}`}
                    >
                      仿真
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriverMode('real')}
                      className={`px-2 rounded-md font-bold transition-all ${driverMode === 'real' ? 'bg-teal-500/20 text-teal-400' : 'text-slate-500'}`}
                    >
                      真实
                    </button>
                  </div>
                </div>

                {/* Compact drivers list inside left drawer */}
                <div className="max-h-[160px] overflow-y-auto divide-y divide-slate-900/40 pr-1 flex flex-col space-y-1 scrollbar-thin">
                  {(() => {
                    const list = driverMode === 'simulated' ? simulatedDrivers : realDrivers;
                    const sorted = list.map(d => {
                      const dist = calculateDistance(passengerCoords.lat, passengerCoords.lng, d.lat, d.lng);
                      return { ...d, dist };
                    }).sort((a, b) => a.dist - b.dist);

                    if (sorted.length === 0) {
                      return (
                        <div className="py-4 text-center text-slate-600 text-[10px]">
                          暂无在线接单的司机人员
                        </div>
                      );
                    }

                    return sorted.map((driver) => {
                      const isInRange = driver.dist <= 3.0;

                      return (
                        <div 
                          key={driver.phone} 
                          className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 text-left ${
                            isInRange 
                              ? 'bg-[#06070a]/70 border-slate-900 hover:border-teal-500/20' 
                              : 'bg-[#0c0d12]/50 border-transparent hover:border-amber-500/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 border ${isInRange ? 'border-teal-500/50 bg-slate-900' : 'border-amber-500/40 bg-slate-950'} flex items-center justify-center`}>
                              <img src={driver.avatar} alt={driver.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-extrabold text-slate-250 truncate">{driver.name}</span>
                                <span className="text-[8px] bg-slate-900 text-slate-500 px-1 py-0.2 rounded shrink-0">
                                  {driver.drivingYears}年
                                </span>
                              </div>
                              <span className={`text-[9px] font-black block ${isInRange ? 'text-teal-400' : 'text-amber-500'}`}>
                                📍 {driver.dist.toFixed(2)}km
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleForceDispatch(driver)}
                            disabled={isDispatching}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black shrink-0 transition-all cursor-pointer flex items-center gap-0.5 active:scale-95 ${
                              isInRange 
                                ? 'bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20' 
                                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                            }`}
                          >
                            指派
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>

            {/* Bottom Panel: Dispatch Result (if any) or Tip */}
            <div className="pt-3 border-t border-slate-900">
              {dispatchResult ? (
                <div className="p-2 bg-[#06070a] border border-emerald-500/10 text-slate-200 rounded-xl text-left animate-in fade-in duration-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      委派下单同步成功！
                    </span>
                    <button onClick={() => setDispatchResult(null)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    已自动委派给距起点 <span className="text-teal-400 font-extrabold">{(dispatchResult.dist * 1000).toFixed(0)}米</span> 的代驾司机：<span className="text-white font-extrabold">{dispatchResult.driver.name}</span>。
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[8.5px] text-slate-500 pl-1">
                  <HelpCircle className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span>拖拽中心地标或在地图上点击司机即可派单。</span>
                </div>
              )}
            </div>

          </div>

          {/* Absolute overlay: Selected driver detail card (on map click) */}
          {clickedMapDriver && (
            <div className="absolute top-4 right-4 w-72 sm:w-80 bg-[#0c0e16]/95 border-2 border-amber-500/80 p-3.5 rounded-2xl shadow-2xl z-40 animate-in slide-in-from-right-4 duration-300 backdrop-blur-md text-left">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
                <span className="text-[9px] font-black text-amber-400 tracking-widest uppercase flex items-center gap-1">
                  🎯 大屏强制指派面板
                </span>
                <button
                  onClick={() => setClickedMapDriver(null)}
                  className="w-5 h-5 rounded-full hover:bg-slate-900 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-900 border border-amber-500/50 overflow-hidden flex items-center justify-center">
                    <img src={clickedMapDriver.avatar} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white">{clickedMapDriver.name}</h4>
                    <span className="text-[9px] text-slate-400 font-mono block">{clickedMapDriver.phone}</span>
                  </div>
                </div>

                <div className="space-y-1 font-bold text-[9.5px] text-slate-400 bg-[#06070a] p-2.5 rounded-xl border border-slate-900">
                  <p>🚗 与起点直线距离: <span className="text-amber-400 font-black">{calculateDistance(passengerCoords.lat, passengerCoords.lng, clickedMapDriver.lat, clickedMapDriver.lng).toFixed(2)} 公里</span></p>
                  <p className="truncate">📍 乘客起点地标: <span className="text-teal-400 font-sans">{passengerAddress}</span></p>
                  <p className="truncate">🏁 目的地/终点: <span className="text-slate-300 font-sans">{passengerDestination || '由现场口头协商'}</span></p>
                  <p>📱 乘客特约号码: <span className="text-[#189F95] font-mono">{passengerPhone || '未填写 (匿名代开单)'}</span></p>
                </div>

                <button
                  type="button"
                  onClick={() => handleForceDispatch(clickedMapDriver)}
                  disabled={isDispatching}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-[10px] rounded-xl shadow-lg transition-transform flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                >
                  {isDispatching ? (
                    <>
                      <Loader2 className="w-3 animate-spin text-slate-950" />
                      正在指派下单通道中...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3 h-3 fill-current text-slate-950" />
                      确认强行指派该车辆
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Floating Right-Bottom Controls */}
          <div className="absolute right-4 bottom-4 z-30 flex flex-col space-y-2">
            <button
              type="button"
              onClick={handleMapLocateSelf}
              disabled={isLocating}
              className="w-9 h-9 bg-slate-900/95 border border-slate-800 hover:bg-slate-800 text-teal-400 font-bold rounded-xl shadow-lg flex items-center justify-center transition-all cursor-pointer"
              title="重新获取并同步当前GPS物理座标起点"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <Locate className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Floating Left-Bottom Status indicators */}
          <div className="absolute left-[390px] bottom-4 z-30 bg-[#0c0e17]/95 border border-slate-850 p-2.5 rounded-xl shadow-xl hidden md:flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-left text-[9px] space-y-0.5 font-bold">
              <span className="text-slate-300 block">系统当前区域：{selectedCity}</span>
              <span className="text-slate-500 block">
                方圆 3 公里：
                <span className="text-teal-400 font-extrabold text-[10px]">
                  {driverMode === 'simulated' ? simulatedDrivers.length : realDrivers.filter(d => calculateDistance(passengerCoords.lat, passengerCoords.lng, d.lat, d.lng) <= 3.0).length}
                </span> 台已上线车辆待命中
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
