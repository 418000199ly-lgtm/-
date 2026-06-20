export interface TimeSlot {
  id: string;
  startTime: string; // e.g., "06:00"
  endTime: string;   // e.g., "18:59"
  startingPrice: number; // e.g., 40
  includedDistance: number; // e.g., 7
  unitPricePerKm: number; // e.g., 5
  distanceInterval?: number; // e.g., 1
  priceIncrease?: number; // e.g., 5
}

export interface BillingRules {
  templateName: string; // e.g., "40-60"
  slots: TimeSlot[];
  returnFeeStartKm: number; // e.g., 20 (行程超过20公里)
  returnFeePerKm: number;   // e.g., 2 (超出后每1公里2元)
  returnFeeIntervalKm?: number; // e.g., 1 (每多少公里)
  returnFeeIncreaseYuan?: number; // e.g., 2 (增加多少元)
  freeWaitingTime: number;  // e.g., 10 (等候10分钟免费)
  waitingChargePerMin: number; // e.g., 1 (超出后每1分钟1元)
  waitingIntervalMin?: number; // e.g., 1 (超时后每多少分钟)
  waitingIncreaseYuan?: number; // e.g., 1 (每多少分钟增加多少元)
}

export interface ChauffeurSettings {
  billingTemplateName: string;
  voiceBroadcast: string; // "开单语音播报" | "静音播报"
  accountBalance: number;
  startServiceSMS: boolean;
  endServiceSMS: boolean;
  smsContent: string;
  homepageColorway: 'green' | 'blue' | 'slate';
  deviationMitigation: boolean;
  deviationKm: number; // e.g., 1.0
  deviationWaitSec: number; // e.g., 30
  wechatQrCode?: string;
  alipayQrCode?: string;
  vipExpiry?: string;
  customAppName?: string;
  onlineOrdersEnabled?: boolean;
  city?: string;
  isBanned?: boolean;
}

export interface TripState {
  id: string;
  orderNumber: string;
  passengerName: string;
  passengerPhone: string;
  startLocation: string;
  endLocation: string;
  startTimestamp: number;
  currentDistance: number; // in km
  currentWaitingTime: number; // in mins
  currentStatus: 'idle' | 'listening' | 'received' | 'serving' | 'ended' | 'payment_pending' | 'completed';
  extraBridgeFee: number;
  extraParkingFee: number;
  extraOtherFee: number;
  calculatedBaseFee: number;
  calculatedTotalFee: number;
  weatherMultiplier?: number;
}

export interface DriverStats {
  todayOrders: number;
  todayIncome: number;
  myPoints: number;
  lastResetDate?: string;
}

// Default values to provide structured and robust initialization
export const DEFAULT_SLOTS: TimeSlot[] = [
  { id: '1', startTime: '06:00', endTime: '18:59', startingPrice: 40, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
  { id: '2', startTime: '19:00', endTime: '23:59', startingPrice: 40, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
  { id: '3', startTime: '00:00', endTime: '05:59', startingPrice: 40, includedDistance: 7, unitPricePerKm: 5, distanceInterval: 1, priceIncrease: 5 },
];

export const DEFAULT_BILLING_RULES: BillingRules = {
  templateName: '某滴代驾计费模版',
  slots: DEFAULT_SLOTS,
  returnFeeStartKm: 0,
  returnFeePerKm: 0,
  returnFeeIntervalKm: 1,
  returnFeeIncreaseYuan: 0,
  freeWaitingTime: 10,
  waitingChargePerMin: 1,
  waitingIntervalMin: 1,
  waitingIncreaseYuan: 1,
};

export const DEFAULT_SETTINGS: ChauffeurSettings = {
  billingTemplateName: '某滴代驾计费模版',
  voiceBroadcast: '开单语音播报',
  accountBalance: 0.00,
  startServiceSMS: false,
  endServiceSMS: false,
  smsContent: '【DD代驾】您好，代驾司机已为您开始服务，当前车辆位置与行驶数据由系统实时记录，保障您的安全。',
  homepageColorway: 'green',
  deviationMitigation: false,
  deviationKm: 1.0,
  deviationWaitSec: 30,
  wechatQrCode: '',
  alipayQrCode: '',
  vipExpiry: '',
  customAppName: '',
  onlineOrdersEnabled: false,
  city: '',
  isBanned: false,
};

export function checkVipActive(vipExpiry?: string): boolean {
  if (!vipExpiry) return false;
  if (vipExpiry === '永久有效') return true;
  try {
    const expDate = new Date(vipExpiry);
    const now = new Date();
    expDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return expDate.getTime() > now.getTime();
  } catch {
    return false;
  }
}

