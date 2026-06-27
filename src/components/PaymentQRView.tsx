import React, { useState, useEffect } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { TripState, ChauffeurSettings } from '../types';
import DriverIllustration from './DriverIllustration';
import { MOCK_ALBUM_PHOTOS } from '../utils/mockImages';

function cleanAndRegenerate(dataUrl: string, type: 'wechat' | 'alipay'): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Scan original QR payload using jsQR
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth'
        });
        
        if (code && code.data) {
          // Re-generate complete, clean, vector-exact high-contrast black-white QR code
          QRCode.toDataURL(code.data, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 450,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          }).then(resolve).catch((err) => {
            console.error('QRCode generation failed in view', err);
            resolve(dataUrl);
          });
        } else {
          // Fallback to generating a pristine mock pay link matching original's intended type
          const fallbackData = type === 'wechat' 
            ? 'wxp://f2f0a1b2c3d4e5f6g7h8_Payment_Client_Active_ID17'
            : 'https://qr.alipay.com/fkx05353_Alipay_Pristine_Payment_Active';
          
          QRCode.toDataURL(fallbackData, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 450,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          }).then(resolve).catch((err) => {
            console.error('QRCode fallback generation failed in view', err);
            resolve(dataUrl);
          });
        }
      } catch (err) {
        console.error('Failed in cleanAndRegenerate processing', err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
}

interface PaymentQRViewProps {
  trip: TripState;
  settings?: ChauffeurSettings;
  onNavigateBack: () => void;
  onFinishTrip: (amount: number) => void;
}

export default function PaymentQRView({
  trip,
  settings,
  onNavigateBack,
  onFinishTrip
}: PaymentQRViewProps) {
  const [isWechat, setIsWechat] = useState(true);
  const [wechatClean, setWechatClean] = useState<string>('');
  const [alipayClean, setAlipayClean] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(true);

  useEffect(() => {
    const processQrs = async () => {
      setIsProcessing(true);
      
      // 1. WeChat
      const rawWechat = settings?.wechatQrCode;
      if (rawWechat) {
        if (rawWechat.startsWith('data:image/png;base64,') && !rawWechat.includes('ID.17') && !rawWechat.includes('svg')) {
          setWechatClean(rawWechat);
        } else {
          try {
            const clean = await cleanAndRegenerate(rawWechat, 'wechat');
            setWechatClean(clean);
          } catch (e) {
            setWechatClean(rawWechat);
          }
        }
      } else {
        try {
          const defaultQrText = 'wxp://f2f0a1b2c3d4e5f6g7h8_Payment_Client_Active_ID17';
          const clean = await QRCode.toDataURL(defaultQrText, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 450,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          setWechatClean(clean);
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Alipay
      const rawAlipay = settings?.alipayQrCode;
      if (rawAlipay) {
        if (rawAlipay.startsWith('data:image/png;base64,') && !rawAlipay.includes('ID.17') && !rawAlipay.includes('svg')) {
          setAlipayClean(rawAlipay);
        } else {
          try {
            const clean = await cleanAndRegenerate(rawAlipay, 'alipay');
            setAlipayClean(clean);
          } catch (e) {
            setAlipayClean(rawAlipay);
          }
        }
      } else {
        try {
          const defaultQrText = 'https://qr.alipay.com/fkx05353_Alipay_Pristine_Payment_Active';
          const clean = await QRCode.toDataURL(defaultQrText, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 450,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          setAlipayClean(clean);
        } catch (e) {
          console.error(e);
        }
      }
      
      setIsProcessing(false);
    };

    processQrs();
  }, [settings?.wechatQrCode, settings?.alipayQrCode]);

  const handleConfirmPayment = () => {
    onFinishTrip(trip.calculatedTotalFee);
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-full bg-[#F8FAFC] text-[#333333] select-none font-sans overflow-hidden">
      {/* HEADER */}
      <header className="bg-[#3B4257] text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center">
          <button 
            type="button"
            onClick={onNavigateBack}
            aria-label="返回" 
            className="p-1 active:opacity-75 transition-opacity"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>
        <h1 className="text-base font-medium">确认收费方式</h1>
        <div className="text-xs font-light opacity-90">
          <button 
            onClick={onNavigateBack}
            className="active:opacity-70 transition-opacity"
          >
            订单详情
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col justify-start overflow-hidden">
        <section className="bg-[#E9F9F8] px-6 py-4 flex justify-between items-center relative overflow-hidden shrink-0" data-purpose="service-status-banner">
          <div className="z-10 flex flex-col gap-0.5">
            <h2 className="text-[#00A591] text-lg font-bold leading-tight">服务完成</h2>
            <h2 className="text-[#00A591] text-sm font-medium leading-tight opacity-90">期待下次再见</h2>
          </div>
          <div className="relative flex items-center justify-end">
            <DriverIllustration size={72} className="relative z-10" />
          </div>
        </section>

        <section className="px-4 -mt-3 flex-1 flex flex-col justify-center py-2 overflow-hidden">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] w-full max-w-xs mx-auto">
            <div className="flex items-baseline gap-1.5 mb-1.5" data-purpose="price-display">
              <span className="text-lg font-semibold text-gray-600">共</span>
              <span className="text-6xl font-black tracking-tighter font-mono text-gray-950">
                {trip.calculatedTotalFee.toFixed(2)}
              </span>
              <span className="text-lg font-semibold text-gray-600">元</span>
            </div>
            
            <p className="text-gray-500 text-xs mb-4">客人扫码支付，支持微信/支付宝</p>
            
            <div className="w-full max-w-[220px] aspect-square flex items-center justify-center shrink-0 mb-4 animate-in fade-in zoom-in-95" data-purpose="qr-code-display">
              {isWechat ? (
                wechatClean ? (
                  <img src={wechatClean} alt="Wechat Pay QR" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100/50 rounded-lg animate-pulse text-gray-400 text-xs text-center font-semibold">
                    ⏳ 正在安全生成微信二维码...
                  </div>
                )
              ) : (
                settings?.alipayQrCode ? (
                  alipayClean ? (
                    <img src={alipayClean} alt="Alipay QR" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100/50 rounded-lg animate-pulse text-gray-400 text-xs text-center font-semibold">
                      ⏳ 正在安全生成支付宝二维码...
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500 text-xs text-center font-semibold px-3 py-2 border border-dashed border-gray-250 rounded-lg">
                    请设置并上传
                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">支付宝收款二维码</div>
                  </div>
                )
              )}
            </div>

            {isWechat ? (
              <div className="flex flex-col items-center w-full mt-1">
                <div className="flex items-center gap-2 mb-2" data-purpose="active-payment-method">
                  <svg fill="none" height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.477 2 2 6.015 2 10.97c0 2.81 1.442 5.315 3.69 6.963l-.46 1.72a.5.5 0 0 0 .668.59l2.12-.96c1.233.454 2.585.717 3.982.717 5.523 0 10-4.015 10-10.97C22 6.015 17.523 2 12 2z" fill="#07C160"></path>
                    <path d="M7.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" fill="white"></path>
                  </svg>
                  <span className="text-gray-800 text-sm font-bold">微信支付</span>
                </div>
                <button 
                  onClick={() => setIsWechat(false)}
                  className="flex items-center gap-1.5 px-6 py-1.5 border border-[#00A591] text-[#00A591] rounded-xl text-xs font-semibold active:bg-[#F0FBFA] hover:bg-[#F0FBFA]/50 transition-colors" 
                  data-purpose="switch-payment-action"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  切换支付宝收款
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full mt-1">
                <div className="flex items-center gap-2 mb-2" data-purpose="active-payment-method">
                  <svg fill="none" height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="12" fill="#108EE9"/>
                    <text x="12" y="16.5" fill="white" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">支</text>
                  </svg>
                  <span className="text-gray-800 text-sm font-bold">支付宝支付</span>
                </div>
                <button 
                  onClick={() => setIsWechat(true)}
                  className="flex items-center gap-1.5 px-6 py-1.5 border border-[#108EE9] text-[#108EE9] rounded-xl text-xs font-semibold active:bg-[#F0F7FB] hover:bg-[#F0F7FB]/50 transition-colors" 
                  data-purpose="switch-payment-action"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  切换微信收款
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="p-4 bg-white sm:bg-transparent shrink-0">
        <button 
          onClick={handleConfirmPayment}
          className="w-full py-3 bg-[#3B4257] text-white text-base font-medium rounded-lg shadow-md active:bg-[#2D3344] hover:bg-[#2D3344] transition-all" 
          data-purpose="confirm-payment-button"
        >
          我已收款，返回首页
        </button>
      </footer>
    </div>
  );
}
