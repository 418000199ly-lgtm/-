import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Clock, RotateCw, CheckCircle2 } from 'lucide-react';
import { BillingRules, TripState, ChauffeurSettings } from '../types';
import { db, doc, onSnapshot, deleteDoc, setDoc } from '../lib/dbProxy';
import PassengerOrderView from './PassengerOrderView';

const MULTIPLIER_OPTIONS = Array.from({ length: 11 }, (_, i) => Number((1.0 + i * 0.1).toFixed(1))); // [1.0, 1.1, ..., 2.0]

const SUGGESTED_DESTINATIONS = [
  '银川火车站',
  '建发大阅城',
  '新华百货(鼓楼店)',
  '金凤万达广场',
  '悦海新天地购物广场',
  '银川河东国际机场',
  '阅海湾中央商务区',
];

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
  driverCoords?: { lat: number; lng: number } | null;
  activeOnlineOrder?: any;
  onClearOnlineOrder?: () => void;
}

export default function CreateOrderView({
  billingRules,
  settings,
  userPhone,
  onStartTrip,
  onNavigateBack,
  driverCoords,
  activeOnlineOrder,
  onClearOnlineOrder
}: CreateOrderViewProps) {
  const registeredCity = settings?.city || '';
  const [startLocation, setStartLocation] = useState(() => {
    if (activeOnlineOrder) {
      return '我的当前位置';
    }
    return registeredCity ? `${registeredCity}万达广场住宅区` : '兴庆区政府住宅区';
  });
  const [destination, setDestination] = useState(() => {
    if (activeOnlineOrder) {
      return activeOnlineOrder.startLocation || '';
    }
    return '';
  });
  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (activeOnlineOrder) {
      return activeOnlineOrder.passengerPhone || '';
    }
    return '';
  });

  const startLocationRef = useRef(startLocation);
  const destinationRef = useRef(destination);

  useEffect(() => {
    startLocationRef.current = startLocation;
  }, [startLocation]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);
  const [isEditingStart, setIsEditingStart] = useState(false);

  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // AMap AutoComplete suggestions
  useEffect(() => {
    const AMap = (window as any).AMap;
    if (!AMap || !searchText.trim()) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      AMap.plugin('AMap.AutoComplete', () => {
        try {
          const auto = new AMap.AutoComplete({
            city: registeredCity || '银川市',
            citylimit: true
          });
          auto.search(searchText, (status: string, result: any) => {
            if (status === 'complete' && result.tips) {
              setSuggestions(result.tips.filter((t: any) => t.id && t.name));
            } else {
              setSuggestions([]);
            }
          });
        } catch (e) {
          console.warn('AutoComplete plugin failed:', e);
        }
      });
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchText, registeredCity]);


  // Real Web Gaode (AMap) API Integration
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const isMapMovingProgrammaticallyRef = useRef<boolean>(false);
  const isUserDraggingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);
  const prefetchedCoordsRef = useRef<{ lng: number; lat: number } | null>(null);
  const prefetchedGeocodedRef = useRef<boolean>(false);

  useEffect(() => {
    if (driverCoords) {
      prefetchedCoordsRef.current = { lng: driverCoords.lng, lat: driverCoords.lat };
    }
  }, [driverCoords]);

  useEffect(() => {
    // 0. Start high-accuracy native geolocation pre-fetching in parallel immediately on page open
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const rawLat = position.coords.latitude;
          const rawLng = position.coords.longitude;
          prefetchedCoordsRef.current = { lng: rawLng, lat: rawLat };
          console.log('⚡ Prefetched native GPS coordinates:', rawLng, rawLat);

          const AMap = (window as any).AMap;
          const map = mapInstanceRef.current;
          // If map and AMap are already fully loaded, immediately update center & reverse-geocode
          if (map && AMap && !prefetchedGeocodedRef.current) {
            prefetchedGeocodedRef.current = true;
            AMap.convertFrom([rawLng, rawLat], 'gps', (status: string, result: any) => {
              const finalLng = (status === 'complete' && result.locations) ? result.locations[0].lng : rawLng;
              const finalLat = (status === 'complete' && result.locations) ? result.locations[0].lat : rawLat;
              
              isMapMovingProgrammaticallyRef.current = true;
              map.setCenter([finalLng, finalLat]);
              
              AMap.plugin('AMap.Geocoder', () => {
                const geocoder = new AMap.Geocoder({
                  city: registeredCity || '银川市'
                });
                geocoder.getAddress([finalLng, finalLat], (geoStatus: string, geoResult: any) => {
                  isMapMovingProgrammaticallyRef.current = false;
                  if (geoStatus === 'complete' && geoResult.regeocode) {
                    const formattedAddress = geoResult.regeocode.formattedAddress;
                    const addressComp = geoResult.regeocode.addressComponent || {};
                    let cleanLabel = formattedAddress;
                    if (addressComp.province) cleanLabel = cleanLabel.replace(addressComp.province, '');
                    if (addressComp.city) cleanLabel = cleanLabel.replace(addressComp.city, '');
                    if (addressComp.district) cleanLabel = cleanLabel.replace(addressComp.district, '');
                    if (!cleanLabel.trim()) cleanLabel = formattedAddress;
                    setStartLocation(cleanLabel);
                  }
                });
              });
            });
          }
        },
        (err) => {
          console.warn('⚡ Native geolocation pre-fetch skipped or timed out:', err);
        },
        {
          enableHighAccuracy: true,
          timeout: 2500,     // fast 2.5 seconds timeout
          maximumAge: 120000 // use cached position up to 2 minutes old for ultra-instant lookup!
        }
      );
    }

    // 1. Configure the Gaode Security Key
    (window as any)._AMapSecurityConfig = {
      securityJsCode: '0aa3912e6a88fe59f9e5f0275524feba'
    };

    const scriptId = 'amap-js-api-v2';

    const initializeMap = () => {
      const AMap = (window as any).AMap;
      if (!AMap || !mapContainerRef.current) return;

      try {
        // Initialize AMap strictly in 2D mode, with disabled manual rotatability/pitching
        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
          center: [106.230912, 38.487193], // Default Yinchuan Wanda (银川万达) region
          viewMode: '2D',
          pitch: 0,
          rotateEnable: false,
          pitchEnable: false,
          resizeEnable: true
        });

        mapInstanceRef.current = map;
        setMapLoaded(true);

        AMap.plugin(['AMap.Geocoder', 'AMap.Geolocation', 'AMap.Driving'], () => {
          const geocoder = new AMap.Geocoder({
            city: registeredCity || '银川市'
          });

          const fallbackGeolocation = () => {
            isMapMovingProgrammaticallyRef.current = true;
            geocoder.getLocation(startLocation, (locStatus: string, locResult: any) => {
              isMapMovingProgrammaticallyRef.current = false;
              if (locStatus === 'complete' && locResult && locResult.geocodes && locResult.geocodes.length) {
                const loc = locResult.geocodes[0].location;
                map.setCenter([loc.lng, loc.lat]);
              } else {
                // IP fallback for virtual sandbox environments
                AMap.plugin('AMap.CitySearch', () => {
                  try {
                    const citySearch = new AMap.CitySearch();
                    citySearch.getLocalCity((cityStatus: string, cityResult: any) => {
                      if (cityStatus === 'complete' && cityResult.bounds) {
                        map.setBounds(cityResult.bounds);
                      }
                    });
                  } catch (e) {
                    console.warn('CitySearch failed:', e);
                  }
                });
              }
            });
          };

          // Try using our fast pre-fetched native coordinates first
          const tryUsePrefetched = () => {
            if (prefetchedCoordsRef.current && !prefetchedGeocodedRef.current) {
              prefetchedGeocodedRef.current = true;
              const { lng, lat } = prefetchedCoordsRef.current;
              console.log('⚡ Speeding up using pre-fetched native GPS coordinates:', lng, lat);
              
              AMap.convertFrom([lng, lat], 'gps', (convertStatus: string, convertResult: any) => {
                const finalLng = (convertStatus === 'complete' && convertResult.locations) ? convertResult.locations[0].lng : lng;
                const finalLat = (convertStatus === 'complete' && convertResult.locations) ? convertResult.locations[0].lat : lat;
                
                isMapMovingProgrammaticallyRef.current = true;
                const coords = [finalLng, finalLat];
                map.setCenter(coords);
                
                geocoder.getAddress(coords, (geoStatus: string, geoResult: any) => {
                  isMapMovingProgrammaticallyRef.current = false;
                  if (geoStatus === 'complete' && geoResult.regeocode) {
                    const formattedAddress = geoResult.regeocode.formattedAddress;
                    const addressComp = geoResult.regeocode.addressComponent || {};
                    let cleanLabel = formattedAddress;
                    if (addressComp.province) cleanLabel = cleanLabel.replace(addressComp.province, '');
                    if (addressComp.city) cleanLabel = cleanLabel.replace(addressComp.city, '');
                    if (addressComp.district) cleanLabel = cleanLabel.replace(addressComp.district, '');
                    if (!cleanLabel.trim()) cleanLabel = formattedAddress;
                    
                    setStartLocation(cleanLabel);
                  }
                });
              });
              return true;
            }
            return false;
          };

          if (tryUsePrefetched()) {
            return;
          }

          try {
            // Create Geolocation instance with high accuracy enabled for real mobile GPS tracking but with short timeout fallback
            const geolocation = new AMap.Geolocation({
              enableHighAccuracy: true,  // enable real GPS for actual phone users
              timeout: 3000,             // 3s timeout for fast response
              zoomToAccuracy: true,
              buttonPosition: 'RB',
              needAddress: true
            });

            map.addControl(geolocation);

            // Auto-locate user on open and sync name
            isMapMovingProgrammaticallyRef.current = true;
            geolocation.getCurrentPosition((status: string, result: any) => {
              isMapMovingProgrammaticallyRef.current = false;
              if (status === 'complete' && result.position) {
                const coords = [result.position.lng, result.position.lat];
                map.setCenter(coords);
                
                if (result.formattedAddress) {
                  const formattedAddress = result.formattedAddress;
                  const addressComp = result.addressComponent || {};
                  let cleanLabel = formattedAddress;
                  if (addressComp.province) cleanLabel = cleanLabel.replace(addressComp.province, '');
                  if (addressComp.city) cleanLabel = cleanLabel.replace(addressComp.city, '');
                  if (addressComp.district) cleanLabel = cleanLabel.replace(addressComp.district, '');
                  
                  if (!cleanLabel.trim()) {
                    cleanLabel = formattedAddress;
                  }
                  setStartLocation(cleanLabel);
                } else {
                  geocoder.getAddress(coords, (geoStatus: string, geoResult: any) => {
                    if (geoStatus === 'complete' && geoResult.regeocode) {
                      const formattedAddress = geoResult.regeocode.formattedAddress;
                      const addressComp = geoResult.regeocode.addressComponent || {};
                      let cleanLabel = formattedAddress;
                      if (addressComp.province) cleanLabel = cleanLabel.replace(addressComp.province, '');
                      if (addressComp.city) cleanLabel = cleanLabel.replace(addressComp.city, '');
                      if (addressComp.district) cleanLabel = cleanLabel.replace(addressComp.district, '');
                      
                      if (!cleanLabel.trim()) {
                        cleanLabel = formattedAddress;
                      }
                      setStartLocation(cleanLabel);
                    }
                  });
                }
              } else {
                // If the map has loaded but geolocation failed, let's try prefetch coords one last check, or fallback to IP city
                if (!tryUsePrefetched()) {
                  fallbackGeolocation();
                }
              }
            });
          } catch (err) {
            console.warn('Geolocation was blocked or failed, using city fallback:', err);
            isMapMovingProgrammaticallyRef.current = false;
            if (!tryUsePrefetched()) {
              fallbackGeolocation();
            }
          }

          const updateAddressFromMapCenter = () => {
            if (isMapMovingProgrammaticallyRef.current || destinationRef.current.trim().length > 0) return;
            const center = map.getCenter();
            geocoder.getAddress([center.lng, center.lat], (geocodestatus: string, geocoderesult: any) => {
              if (geocodestatus === 'complete' && geocoderesult.regeocode) {
                const formattedAddress = geocoderesult.regeocode.formattedAddress;
                const addressComp = geocoderesult.regeocode.addressComponent;
                
                // Keep only building description or neighborhood sub-info to look elegant & compact
                let cleanLabel = formattedAddress;
                if (addressComp.province) cleanLabel = cleanLabel.replace(addressComp.province, '');
                if (addressComp.city) cleanLabel = cleanLabel.replace(addressComp.city, '');
                if (addressComp.district) cleanLabel = cleanLabel.replace(addressComp.district, '');
                
                if (!cleanLabel.trim()) {
                  cleanLabel = formattedAddress;
                }
                setStartLocation(cleanLabel);
              }
            });
          };

          // Track when the user is actively dragging the map
          map.on('dragstart', () => {
            isUserDraggingRef.current = true;
          });

          // Debounced live update as the user is dragging the map
          const onDragging = () => {
            if (!isUserDraggingRef.current || isMapMovingProgrammaticallyRef.current) return;
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              updateAddressFromMapCenter();
            }, 180); // ultra-responsive live 180ms debounced updates
          };

          map.on('dragging', onDragging);
          map.on('mapmove', onDragging);
          
          map.on('dragend', () => {
            isUserDraggingRef.current = false;
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            updateAddressFromMapCenter();
          });
        });
      } catch (err) {
        console.error('Failed to initialize Gaode AMap:', err);
      }
    };

    let script = document.getElementById(scriptId) as HTMLScriptElement || document.querySelector('script[src*="webapi.amap.com"]');

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=4143e567d55bbc1855231f9637efd6b0';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeMap();
      };
      document.head.appendChild(script);
    } else {
      if ((window as any).AMap) {
        initializeMap();
      } else {
        script.addEventListener('load', initializeMap);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (_) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize map center when manually editing startLocation text
  useEffect(() => {
    const AMap = (window as any).AMap;
    const map = mapInstanceRef.current;
    if (AMap && map && startLocation && !isEditingStart) {
      AMap.plugin('AMap.Geocoder', () => {
        const geocoder = new AMap.Geocoder({
          city: registeredCity || '银川市'
        });
        geocoder.getLocation(startLocation, (status: string, result: any) => {
          if (status === 'complete' && result && result.geocodes && result.geocodes.length) {
            const loc = result.geocodes[0].location;
            const currentCenter = map.getCenter();
            const dist = Math.sqrt(Math.pow(currentCenter.lng - loc.lng, 2) + Math.pow(currentCenter.lat - loc.lat, 2));
            if (dist > 0.0008) { // update center if offset exists to make it snug
              map.setCenter([loc.lng, loc.lat]);
            }
          }
        });
      });
    }
  }, [isEditingStart, startLocation]);

  // AMap Driving/Riding Route planning for distance calculation and map display
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const drivingInstanceRef = useRef<any>(null);
  const ridingInstanceRef = useRef<any>(null);

  useEffect(() => {
    const AMap = (window as any).AMap;
    const map = mapInstanceRef.current;
    if (!AMap || !map || !mapLoaded) return;

    if (!startLocation || !destination) {
      if (drivingInstanceRef.current) {
        try { drivingInstanceRef.current.clear(); } catch (_) {}
      }
      if (ridingInstanceRef.current) {
        try { ridingInstanceRef.current.clear(); } catch (_) {}
      }
      setRouteDistance(null);
      return;
    }

    const delayDebounce = setTimeout(() => {
      if (activeOnlineOrder) {
        AMap.plugin('AMap.Riding', () => {
          try {
            if (drivingInstanceRef.current) {
              try { drivingInstanceRef.current.clear(); } catch (_) {}
            }
            if (!ridingInstanceRef.current) {
              ridingInstanceRef.current = new AMap.Riding({
                map: map,
                hideMarkers: false,
                autoFitView: true
              });
            } else {
              try { ridingInstanceRef.current.clear(); } catch (_) {}
            }

            isMapMovingProgrammaticallyRef.current = true;

            const startPt = driverCoords 
              ? new AMap.LngLat(driverCoords.lng, driverCoords.lat)
              : startLocation;

            const endPt = (activeOnlineOrder.passengerLng && activeOnlineOrder.passengerLat)
              ? new AMap.LngLat(activeOnlineOrder.passengerLng, activeOnlineOrder.passengerLat)
              : destination;

            ridingInstanceRef.current.search(
              startPt,
              endPt,
              (status: string, result: any) => {
                setTimeout(() => {
                  isMapMovingProgrammaticallyRef.current = false;
                }, 1500);

                if (status === 'complete' && result.routes && result.routes[0]) {
                  const distanceMeters = result.routes[0].distance;
                  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
                  setRouteDistance(distanceKm);
                } else {
                  console.warn('AMap.Riding status:', status, result);
                  setRouteDistance(null);
                }
              }
            );
          } catch (e) {
            console.warn('Initializing or using AMap.Riding failed:', e);
          }
        });
      } else {
        AMap.plugin('AMap.Driving', () => {
          try {
            if (ridingInstanceRef.current) {
              try { ridingInstanceRef.current.clear(); } catch (_) {}
            }
            if (!drivingInstanceRef.current) {
              drivingInstanceRef.current = new AMap.Driving({
                map: map,
                hideMarkers: false,
                autoFitView: true,
                city: registeredCity || '银川市'
              });
            } else {
              try { drivingInstanceRef.current.clear(); } catch (_) {}
            }

            isMapMovingProgrammaticallyRef.current = true;
            drivingInstanceRef.current.search(
              [
                { keyword: startLocation, city: registeredCity || '银川市' },
                { keyword: destination, city: registeredCity || '银川市' }
              ],
              (status: string, result: any) => {
                setTimeout(() => {
                  isMapMovingProgrammaticallyRef.current = false;
                }, 1500);

                if (status === 'complete' && result.routes && result.routes[0]) {
                  const distanceMeters = result.routes[0].distance;
                  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
                  setRouteDistance(distanceKm);
                } else {
                  console.warn('AMap.Driving status:', status, result);
                  setRouteDistance(null);
                }
              }
            );
          } catch (e) {
            console.warn('Initializing or using AMap.Driving failed:', e);
          }
        });
      }
    }, 100);

    return () => clearTimeout(delayDebounce);
  }, [startLocation, destination, mapLoaded, registeredCity, activeOnlineOrder, driverCoords]);

  // Clean up driving and riding instances on unmount
  useEffect(() => {
    return () => {
      if (drivingInstanceRef.current) {
        try { drivingInstanceRef.current.clear(); } catch (_) {}
        drivingInstanceRef.current = null;
      }
      if (ridingInstanceRef.current) {
        try { ridingInstanceRef.current.clear(); } catch (_) {}
        ridingInstanceRef.current = null;
      }
    };
  }, []);

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

  // Synchronous Firestore persist for passenger scan access so they get the driver's latest active location
  useEffect(() => {
    const driverPhoneNum = userPhone || '18609518888';
    const docRef = doc(db, 'passenger_links', driverPhoneNum);
    
    setDoc(docRef, {
      driverPhone: driverPhoneNum,
      driverStartLocation: startLocation,
      updatedAt: Date.now()
    }, { merge: true }).catch(err => console.error('Error persisting driver start location in passenger_links:', err));
  }, [startLocation, userPhone]);


  const passengerScanUrl = `https://daijiajifei.ccwu.cc/?driver=${encodeURIComponent(userPhone || '18609518888')}&name=${encodeURIComponent(settings?.customAppName?.trim() || 'XX代驾')}&startLocation=${encodeURIComponent(startLocation || '')}`;

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

  // Find active time slot for the current time
  const getActiveTimeSlot = () => {
    const nowObj = new Date();
    const activeHour = nowObj.getHours();
    let activeSlot = billingRules.slots[0];
    
    for (const slot of billingRules.slots) {
      if (!slot.startTime || !slot.endTime) continue;
      const [startH] = slot.startTime.split(':').map(Number);
      const [endH] = slot.endTime.split(':').map(Number);
      
      if (startH > endH) { // overnight slot
        if (activeHour >= startH || activeHour <= endH) {
          activeSlot = slot;
          break;
        }
      } else {
        if (activeHour >= startH && activeHour <= endH) {
          activeSlot = slot;
          break;
        }
      }
    }
    return activeSlot;
  };

  const activeSlot = getActiveTimeSlot();
  const baseStartingPrice = activeSlot.startingPrice ?? 40;
  
  // Calculate estimation fee: show starting price as minimum even if destination is empty
  const isEstimated = destination.trim().length > 0;
  
  // Calculate distance cost and return fee if we have a routeDistance
  let estimatedPriceSubtotal = baseStartingPrice;
  const freeKm = activeSlot.includedDistance ?? 7;
  const interval = activeSlot.distanceInterval || 1;
  const increase = activeSlot.priceIncrease ?? activeSlot.unitPricePerKm ?? 5;

  if (routeDistance !== null) {
    let distanceCost = 0;
    if (routeDistance > freeKm) {
      distanceCost = Math.ceil((routeDistance - freeKm) / interval) * increase;
    }
    
    let returnFee = 0;
    if (billingRules.returnFeeStartKm > 0 && routeDistance > billingRules.returnFeeStartKm) {
      const rInterval = billingRules.returnFeeIntervalKm || 1;
      const rIncrease = billingRules.returnFeeIncreaseYuan ?? billingRules.returnFeePerKm ?? 0;
      returnFee = Math.ceil((routeDistance - billingRules.returnFeeStartKm) / rInterval) * rIncrease;
    }
    
    estimatedPriceSubtotal = baseStartingPrice + distanceCost + returnFee;
  }

  const estimatedPrice = Number((estimatedPriceSubtotal * weatherMultiplier).toFixed(2));

  const handleCreateOrder = () => {
    if (settings && settings.isBanned) {
      alert("⚠️ 无法接单！因账户违规，您的账号已被管理员封停。封停期间无法接取任何线上/线下订单，请联系后台解封！");
      return;
    }

    // Generate new robust trip state
    const targetDestination = destination.trim() || '待指定安全目的地';
    const targetPhone = phoneNumber.trim() || '13900000000';
    const startingFeeApplied = Number((baseStartingPrice * weatherMultiplier).toFixed(2));
    const finalEstimatedBaseFee = routeDistance !== null ? Number((estimatedPriceSubtotal * weatherMultiplier).toFixed(2)) : startingFeeApplied;
    
    // Non-blocking warning instead of blocking order creation so checking order creation always works seamlessly.
    if (registeredCity && !startLocation.includes(registeredCity)) {
      console.warn(`出发地（当前输入：${startLocation}）不在线上认证的听单开通城市（${registeredCity}）范围内。但因属于线下自助报单，已放行创建订单。`);
    }
    
    if (activeOnlineOrder) {
      const isValet = activeOnlineOrder.isValetOrder || activeOnlineOrder.isPlatformDispatch;
      const newTrip: TripState = {
        id: 'OL' + Math.floor(Math.random() * 900000 + 100000),
        orderNumber: activeOnlineOrder.id || ('DD' + Date.now().toString().slice(-8)),
        passengerName: isValet ? '商户代叫乘客' : '线上自助预约乘客',
        passengerPhone: targetPhone,
        // The actual trip is from the passenger's pickup location to the passenger's end location
        startLocation: activeOnlineOrder.startLocation || startLocation,
        endLocation: activeOnlineOrder.destination || targetDestination,
        startTimestamp: Date.now(),
        currentDistance: 0.0,
        currentWaitingTime: 0,
        currentStatus: 'serving',
        extraBridgeFee: 0,
        extraParkingFee: 0,
        extraOtherFee: 0,
        calculatedBaseFee: startingFeeApplied,
        calculatedTotalFee: startingFeeApplied,
        weatherMultiplier: weatherMultiplier,
        isOnlineOrder: true,
        orderType: isValet ? '后台指派订单' : '乘客下单'
      };
      onStartTrip(newTrip);
      if (onClearOnlineOrder) onClearOnlineOrder();
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
      currentDistance: 0.0,
      currentWaitingTime: 0,
      currentStatus: 'serving',
      extraBridgeFee: 0,
      extraParkingFee: 0,
      extraOtherFee: 0,
      calculatedBaseFee: startingFeeApplied,
      calculatedTotalFee: startingFeeApplied,
      weatherMultiplier: weatherMultiplier,
      orderType: scanSuccessMsg ? '二维码报单' : '报单'
    };

    onStartTrip(newTrip);
  };

  return (
    <div className="relative flex-grow flex flex-col justify-between w-full h-full select-none overflow-hidden text-gray-900 bg-gray-100 font-sans">
      
      {/* BEGIN: MapBackground (Real Dynamic Gaode AMap Integration) */}
      <div className="absolute inset-0 z-0 bg-[#e4eae4] overflow-hidden">
        {/* Real Gaode map target container */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        
        {/* Dynamic loading overlays/fallbacks before map initialization resolves */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 space-y-3">
            <div className="w-8 h-8 rounded-full border-3 border-teal-600 border-t-transparent animate-spin" />
            <span className="text-xs text-teal-800 font-medium font-sans">高德地图初始化中...</span>
          </div>
        )}

        {/* Elegant overlay to match styling */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20 pointer-events-none z-5" />
      </div>
      {/* END: MapBackground */}

      {/* BEGIN: NavigationHeader (Floating top panel bar) */}
      <header className="relative p-4 flex justify-between items-start z-10 pointer-events-none">
        <button 
          onClick={onNavigateBack}
          className="bg-white rounded-full p-2.5 shadow-lg active:scale-90 transition-transform pointer-events-auto" 
          data-purpose="back-button"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
          </svg>
        </button>
        {activeOnlineOrder ? (
          <div className="bg-teal-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 border border-teal-500/10 pointer-events-auto animate-pulse">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            <span className="text-xs font-black">接单骑行：前往乘客起点</span>
          </div>
        ) : (
          <div 
            onClick={() => setShowQrModal(true)}
            className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform border border-teal-500/10 hover:bg-teal-50/50 pointer-events-auto" 
            data-purpose="qr-order-trigger"
          >
            <QrCode className="w-3.5 h-3.5 text-[#189F95]" />
            <span className="text-xs font-bold text-gray-700">二维码创单</span>
          </div>
        )}
      </header>
      {/* END: NavigationHeader */}

      {/* BEGIN: MapMarkerSection */}
      <main className="flex-grow relative z-10 flex flex-col justify-between pointer-events-none">
        
        {/* Center Map Marker (Static pin indicator in center - aligned to true map center) */}
        {!activeOnlineOrder && !routeDistance && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none" data-purpose="pickup-location-marker">
            <div className="bg-white px-3.5 py-1.5 rounded-lg shadow-xl border border-gray-100 mb-1 whitespace-nowrap flex items-center gap-1.5 animate-bounce pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-[#189F95]"></span>
              {isEditingStart ? (
                <input
                  type="text"
                  value={startLocation}
                  onChange={(e) => setStartLocation(e.target.value)}
                  onBlur={() => setIsEditingStart(false)}
                  autoFocus
                  className="text-xs font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:outline-hidden p-0 max-w-[140px] pointer-events-auto"
                />
              ) : (
                <span 
                  onClick={() => setIsEditingStart(true)}
                  className="text-xs font-black text-gray-800 cursor-pointer hover:underline pointer-events-auto"
                >
                  {startLocation}
                </span>
              )}
            </div>
            <div className="w-0.5 h-6 bg-black shadow-lg"></div>
            <div className="w-2 h-2 bg-black rounded-full -mt-1 shadow-md"></div>
          </div>
        )}

        {/* Spacer for filling up remaining section */}
        <div className="flex-grow"></div>

        {/* Map Action Buttons (Floating above the bottom sheet) */}
        <div className="w-full px-4 mb-4 flex justify-between items-end gap-2 pointer-events-auto" data-purpose="map-tools">
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
          <div 
            onClick={() => {
              setSearchText(destination);
              setShowDestinationSearch(true);
            }}
            className="flex items-center gap-3 bg-gray-50 hover:bg-white rounded-2xl px-4 py-2.5 border border-transparent hover:border-teal-500/20 active:scale-[0.99] transition-all cursor-pointer select-none"
            id="destination-trigger"
          >
            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0"></div>
            <div className="flex-grow flex items-center justify-between overflow-hidden">
              <span className={`text-sm tracking-wide truncate ${destination ? 'font-bold text-gray-800' : 'text-gray-400 font-normal font-sans'}`}>
                {destination || "请填写目的地（选填）"}
              </span>
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </div>
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
            <p className="text-gray-400 text-[10px] scale-95 origin-left mt-1 font-medium select-none">
              {activeOnlineOrder ? (
                <span className="text-orange-600 font-bold">
                  🏍️ 骑行距离: {routeDistance ? `${routeDistance.toFixed(2)}公里` : '计算中...'}
                </span>
              ) : routeDistance !== null ? (
                <span className="text-teal-600 font-bold">
                  预估里程: {routeDistance.toFixed(2)}公里 (起步含{activeSlot.includedDistance}公里)
                </span>
              ) : isEstimated ? (
                `正在规划最优路线并计算距离...`
              ) : (
                '(选择终点后，可预估起步价及路线费用)'
              )}
            </p>
          </div>
          
          <button 
            onClick={handleCreateOrder}
            className="bg-[#189F95] hover:bg-[#158C83] text-white px-8 py-3.5 rounded-xl font-bold text-base active:scale-95 shadow-md shadow-[#189F95]/25 transition-all font-sans" 
            data-purpose="submit-order"
          >
            {activeOnlineOrder ? "创建订单 (开始计费)" : "创建订单"}
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
            </div>



            {/* Actions Panel */}
            <div className="w-full flex flex-col gap-2 pt-1 font-sans">
              
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
      {/* BEGIN: Full-screen Destination Selection Overlay */}
      {showDestinationSearch && (
        <div 
          className="absolute inset-0 bg-white z-[70] flex flex-col animate-in slide-in-from-bottom duration-300 pointer-events-auto"
          id="destination-search-page"
        >
          {/* Header */}
          <div className="bg-gray-700 border-b border-gray-600 px-4 py-7 flex items-center justify-between shrink-0">
            <button 
              onClick={() => setShowDestinationSearch(false)}
              className="text-white hover:text-gray-200 p-1 rounded-full active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              </svg>
              <span className="text-sm font-bold text-white">返回</span>
            </button>
            <h3 className="text-lg font-black text-white tracking-tight">输入目的地</h3>
            
            {/* "取消目的地" Button: Reset to default state and close */}
            <button 
              onClick={() => {
                setDestination('');
                setSearchText('');
                setShowDestinationSearch(false);
              }}
              className="text-white bg-rose-600 hover:bg-rose-750 font-bold text-xs active:scale-95 transition-all cursor-pointer px-3.5 py-2 rounded-full border border-rose-500"
            >
              取消目的地
            </button>
          </div>

          {/* Search Input bar */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 shrink-0">
            <div className="relative flex items-center bg-white rounded-2xl border border-gray-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 transition-all p-3 shadow-xs">
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0 mr-3"></div>
              <input 
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索目的地 / 输入具体地址"
                className="bg-transparent border-none focus:outline-hidden p-0 text-sm font-bold text-gray-800 flex-grow placeholder:text-gray-400 placeholder:font-normal focus:ring-0"
                autoFocus
              />
              {searchText && (
                <button 
                  onClick={() => setSearchText('')}
                  className="p-1 rounded-full hover:bg-gray-150 text-gray-400 hover:text-gray-650"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content Area - suggestions vs defaults */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {suggestions.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">匹配搜索建议</p>
                {suggestions.map((tip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDestination(tip.name);
                      setSearchText(tip.name);
                      setShowDestinationSearch(false);
                    }}
                    className="w-full text-left p-3.5 hover:bg-teal-50/50 rounded-xl flex items-start gap-3 transition-colors border border-transparent hover:border-teal-500/10 cursor-pointer"
                  >
                    <div className="w-5 h-5 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 leading-snug">{tip.name}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{tip.address || tip.district}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {searchText.trim() ? (
                  <div className="p-3 bg-teal-50/40 rounded-xl border border-teal-500/10 mb-4">
                    <p className="text-xs text-teal-800 leading-relaxed font-semibold">
                      找不到精准建议？
                    </p>
                    <p className="text-xs text-teal-600/70 leading-relaxed mt-0.5">
                      您可直接点击下方【确认目的地】使用您手输的地址名称。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">热门 / 推荐目的地</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SUGGESTED_DESTINATIONS.map((name, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setDestination(name);
                              setSearchText(name);
                              setShowDestinationSearch(false);
                            }}
                            className="text-left px-3.5 py-2.5 bg-gray-50 hover:bg-teal-50/35 hover:border-teal-500/20 border border-transparent rounded-xl text-xs font-bold text-gray-700 transition-all cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis mr-1 mb-1"
                          >
                            📍 {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {destination && (
                      <div className="pt-2">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">当前已设定</p>
                        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-850">{destination}</span>
                          <button 
                            onClick={() => {
                              setDestination('');
                              setSearchText('');
                              setShowDestinationSearch(false);
                            }}
                            className="text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded-lg"
                          >
                            清除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 border-t border-gray-100 bg-white shrink-0">
            <button
              onClick={() => {
                if (searchText.trim()) {
                  setDestination(searchText.trim());
                } else {
                  setDestination('');
                }
                setShowDestinationSearch(false);
              }}
              className="w-full py-4 bg-[#189F95] hover:bg-[#13827a] text-white rounded-2xl font-black text-sm active:scale-[0.98] transition-transform shadow-lg shadow-teal-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
              </svg>
              <span>确认目的地</span>
            </button>
          </div>
        </div>
      )}

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
