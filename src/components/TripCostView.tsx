import React, { useState } from 'react';
import { ArrowLeft, Landmark, Car, HelpCircle, Flame } from 'lucide-react';
import { TripState } from '../types';

interface TripCostViewProps {
  trip: TripState;
  onNavigateBack: () => void;
  onGoToCollection: (updatedTrip: TripState) => void;
}

export default function TripCostView({
  trip,
  onNavigateBack,
  onGoToCollection
}: TripCostViewProps) {
  // Input binders for extra pad fees (Screenshot 1: 高速费, 停车费, 其他费用)
  const [bridgeFeeStr, setBridgeFeeStr] = useState('');
  const [parkingFeeStr, setParkingFeeStr] = useState('');
  const [otherFeeStr, setOtherFeeStr] = useState('');

  // Number converters
  const bridgeFee = Number(bridgeFeeStr) || 0;
  const parkingFee = Number(parkingFeeStr) || 0;
  const otherFee = Number(otherFeeStr) || 0;

  // Real-time calculated Grand Total
  const grandTotal = Number((trip.calculatedBaseFee + bridgeFee + parkingFee + otherFee).toFixed(2));

  const handleProceed = () => {
    // Commit the inputs and progress
    const finalizedTripState: TripState = {
      ...trip,
      extraBridgeFee: bridgeFee,
      extraParkingFee: parkingFee,
      extraOtherFee: otherFee,
      calculatedTotalFee: grandTotal,
      currentStatus: 'payment_pending'
    };
    onGoToCollection(finalizedTripState);
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-full bg-slate-100 select-none">
      
      {/* 1. Top Bar Navigation Panel */}
      <div className="bg-[#273046] h-14 min-h-14 flex items-center justify-between px-4 text-white shadow-md z-10">
        <button 
          onClick={onNavigateBack}
          className="p-1 px-1.5 rounded-lg hover:bg-white/10 text-white transition-colors flex items-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-100" />
        </button>
        <span className="font-semibold text-base tracking-wide text-center flex-1 pr-6 text-gray-100">行程结束</span>
        <div></div>
      </div>

      {/* Main calculation summary card container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* Base invoice stats card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs text-center relative overflow-hidden">
          
          <div className="text-gray-500 text-[13px] font-medium mb-1 tracking-wide font-sans">
            行程费用
          </div>

          {/* Big Currency Fee number (matching Screenshot 1: 40.00元) */}
          <div className="text-5xl font-extrabold text-[#1DA39B] my-3 font-sans flex items-center justify-center">
            <span>{grandTotal.toFixed(2)}</span>
            <span className="text-xl font-bold ml-1.5 align-bottom">元</span>
          </div>

          {/* Slices of summary stats in grid row */}
          <div className="flex items-center justify-center space-x-2.5 text-xs text-gray-500 border-t border-gray-50 pt-4 mt-2">
            <span>全程 <strong className="text-gray-800 font-bold">{trip.currentDistance.toFixed(2)}</strong> 公里</span>
            <span className="text-gray-300">|</span>
            <span>等候 <strong className="text-gray-800 font-bold">{trip.currentWaitingTime}</strong> 分钟</span>
            <span className="text-gray-300">|</span>
            <span className="text-[#1DA39B] font-semibold cursor-pointer hover:underline flex items-center space-x-0.5">
              <span>计费规则</span>
              <span className="text-[10px]">▶</span>
            </span>
          </div>
        </div>

        {/* 3 extra expenses prompt and form inputs */}
        <div className="space-y-3">
          <div className="text-xs text-gray-500 font-semibold px-1.5 flex items-center space-x-1.5 border-l-4 border-[#1DA39B]">
            <span>填写您自己垫付的额外费用</span>
          </div>

          <div className="space-y-3">
            
            {/* 1. Bridge Fee input */}
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-xs">
              <span className="text-sm font-bold text-gray-800">高速费/路桥费</span>
              <div className="flex items-center bg-slate-50 border border-gray-100 rounded-xl px-3 py-1.5 shadow-inner">
                <input
                  type="text"
                  pattern="[0-9]*"
                  placeholder="请输入金额"
                  value={bridgeFeeStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setBridgeFeeStr(val);
                  }}
                  className="w-24 text-right bg-transparent text-sm font-semibold focus:outline-hidden text-gray-900 placeholder-gray-300"
                />
                <span className="text-xs text-gray-400 ml-1.5 font-bold">元</span>
              </div>
            </div>

            {/* 2. Parking Fee input */}
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-xs">
              <span className="text-sm font-bold text-gray-800">停车费</span>
              <div className="flex items-center bg-slate-50 border border-gray-100 rounded-xl px-3 py-1.5 shadow-inner">
                <input
                  type="text"
                  pattern="[0-9]*"
                  placeholder="请输入金额"
                  value={parkingFeeStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setParkingFeeStr(val);
                  }}
                  className="w-24 text-right bg-transparent text-sm font-semibold focus:outline-hidden text-gray-900 placeholder-gray-300"
                />
                <span className="text-xs text-gray-400 ml-1.5 font-bold">元</span>
              </div>
            </div>

            {/* 3. Other Fees input */}
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-xs">
              <span className="text-sm font-bold text-gray-800">其他费用</span>
              <div className="flex items-center bg-slate-50 border border-gray-100 rounded-xl px-3 py-1.5 shadow-inner">
                <input
                  type="text"
                  pattern="[0-9]*"
                  placeholder="请输入金额"
                  value={otherFeeStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setOtherFeeStr(val);
                  }}
                  className="w-24 text-right bg-transparent text-sm font-semibold focus:outline-hidden text-gray-900 placeholder-gray-300"
                />
                <span className="text-xs text-gray-400 ml-1.5 font-bold">元</span>
              </div>
            </div>

          </div>

          {/* Subtitle helper showing math decomposition */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-700 leading-relaxed">
            <span className="font-semibold block mb-0.5">费用结算明细计费：</span>
            <span>
              基础代驾 ¥{trip.calculatedBaseFee.toFixed(2)}
              {bridgeFee > 0 && ` + 过路 ¥${bridgeFee.toFixed(2)}`}
              {parkingFee > 0 && ` + 停车 ¥${parkingFee.toFixed(2)}`}
              {otherFee > 0 && ` + 其他 ¥${otherFee.toFixed(2)}`}
              {` = 应收结账合计 ¥${grandTotal.toFixed(2)} 元`}
            </span>
          </div>
        </div>

      </div>

      {/* Action triggers button at bottom */}
      <div className="p-4 bg-white border-t border-gray-200/60 shadow-lg select-none">
        <button
          onClick={handleProceed}
          className="w-full py-4 bg-[#1da39b] hover:bg-teal-600 text-white font-bold rounded-2xl shadow-xl shadow-teal-500/20 active:scale-98 transition-all text-center text-sm flex items-center justify-center space-x-1"
        >
          <span>去收款</span>
        </button>
      </div>

    </div>
  );
}
