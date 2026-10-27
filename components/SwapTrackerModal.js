import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  X,
  Copy,
  Check
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import useStore from '../store/useStore';

export default function SwapTrackerModal({ visible, onClose, order }) {
  const [trackerData, setTrackerData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const { checkRouterStatus, fetchUserData, token } = useStore();

  const refId = order?.reference_id || order?.router_id;

  useEffect(() => {
    let interval = null;
    let isActive = true;

    if (visible && refId) {
      const fetchStatus = async () => {
        try {
          const res = await checkRouterStatus(refId);
          if (isActive && res) {
            setTrackerData(prev => ({
              ...prev,
              ...res,
              from_currency: res.from_currency || order.from_currency,
              to_currency: res.to_currency || order.to_currency,
              amount_paid: res.amount_paid || order.amount_paid,
              expected_receive: res.expected_receive || order.expected_receive,
              recipient_address: res.recipient_address || order.recipient_address
            }));

            if (res.status === 'finished') {
              fetchUserData(token);
            }
          }
        } catch (err) {
          console.error('[SwapTrackerModal] status check failed', err);
        }
      };

      fetchStatus();
      interval = setInterval(fetchStatus, 3500);
    }

    return () => {
      isActive = false;
      if (interval) clearInterval(interval);
    };
  }, [visible, refId]);

  if (!order) return null;

  const currentStatus = trackerData?.status || order?.initial_status || 'waiting';
  const fromCurr = trackerData?.from_currency || order?.from_currency || 'NGN';
  const toCurr = trackerData?.to_currency || order?.to_currency || 'Crypto';
  const amountPaid = trackerData?.amount_paid || order?.amount_paid || 0;
  const expectedReceive = trackerData?.expected_receive || order?.expected_receive || 0;
  const recipientAddr = trackerData?.recipient_address || order?.recipient_address || '';
  const payoutHash = trackerData?.payout_hash;

  const copyHash = async (text) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openExplorer = () => {
    if (!payoutHash) return;
    let url = '';
    if (toCurr === 'BNB' || toCurr === 'USDT_BEP20') {
      url = `https://bscscan.com/tx/${payoutHash}`;
    } else if (toCurr === 'ETH' || toCurr === 'USDT_ERC20') {
      url = `https://etherscan.io/tx/${payoutHash}`;
    } else if (toCurr === 'TRX' || toCurr === 'USDT_TRC20') {
      url = `https://tronscan.org/#/transaction/${payoutHash}`;
    } else if (toCurr === 'POL' || toCurr === 'USDT_POLYGON') {
      url = `https://polygonscan.com/tx/${payoutHash}`;
    }
    if (url) Linking.openURL(url);
  };

  // Step state calculations
  const isFinished = currentStatus === 'finished';
  const isFailed = currentStatus === 'failed' || currentStatus === 'refunded';

  const step1Done = true; // Order Created
  const step2Done = ['confirming', 'exchanging', 'sending', 'finished'].includes(currentStatus);
  const step2Active = currentStatus === 'waiting';

  const step3Done = ['sending', 'finished'].includes(currentStatus);
  const step3Active = currentStatus === 'confirming' || currentStatus === 'exchanging';

  const step4Done = currentStatus === 'finished';
  const step4Active = currentStatus === 'sending';

  const step5Done = currentStatus === 'finished';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/85">
        <View className="bg-neutral-900 rounded-t-[2.5rem] p-6 max-h-[90%] border-t border-neutral-800">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <View className="flex-row items-center">
                <Text className="text-xl font-bold text-white mr-2">Live Swap Tracker</Text>
                <View className={`px-2 py-0.5 rounded-full ${isFinished ? 'bg-emerald-500/20 border border-emerald-500/30' : isFailed ? 'bg-red-500/20 border border-red-500/30' : 'bg-amber-500/20 border border-amber-500/30'}`}>
                  <Text className={`text-[10px] font-bold uppercase ${isFinished ? 'text-emerald-400' : isFailed ? 'text-red-400' : 'text-amber-400'}`}>
                    {isFinished ? 'Completed' : isFailed ? 'Failed' : 'Processing'}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-neutral-400 mt-0.5">Real-time On-Chain Settlement</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 bg-neutral-800 rounded-full">
              <X color="#9ca3af" size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Asset Transfer Banner */}
            <View className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 my-2">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-neutral-500">You Paid</Text>
                  <Text className="text-base font-bold text-white mt-0.5">
                    {fromCurr === 'NGN' ? `₦${Number(amountPaid).toLocaleString()}` : `${amountPaid} ${fromCurr}`}
                  </Text>
                </View>

                <View className="w-8 h-8 rounded-full bg-neutral-900 items-center justify-center border border-neutral-800">
                  <ArrowRight color="#10b981" size={16} />
                </View>

                <View className="items-end">
                  <Text className="text-xs text-neutral-500">Credited Amount</Text>
                  <Text className="text-base font-bold text-emerald-400 mt-0.5">
                    {toCurr === 'NGN' ? `₦${Number(expectedReceive).toLocaleString()}` : `${expectedReceive} ${toCurr}`}
                  </Text>
                </View>
              </View>

              {recipientAddr ? (
                <View className="mt-3 pt-3 border-t border-neutral-800/80 flex-row justify-between items-center">
                  <Text className="text-[11px] text-neutral-500">Destination Address</Text>
                  <Text className="text-[11px] font-mono text-neutral-300">
                    {recipientAddr.slice(0, 8)}...{recipientAddr.slice(-6)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* FAILED STATE ALERT */}
            {isFailed && (
              <View className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 my-3 flex-row items-center">
                <AlertCircle color="#ef4444" size={20} />
                <View className="ml-3 flex-1">
                  <Text className="text-xs font-bold text-red-400">Swap Unsuccessful</Text>
                  <Text className="text-[11px] text-neutral-400 mt-0.5">
                    Your funds have been refunded back to your wallet balance.
                  </Text>
                </View>
              </View>
            )}

            {/* STEP PROGRESSION TRACKER */}
            <View className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 my-2">
              <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                Blockchain Settlement Progress
              </Text>

              {/* Step 1 */}
              <View className="flex-row items-start mb-4">
                <View className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500 items-center justify-center mr-3 mt-0.5">
                  <Check color="#10b981" size={14} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-white">Order Created & Liquidity Allocated</Text>
                  <Text className="text-[11px] text-neutral-400 mt-0.5">Exchange rate locked and liquidity funded</Text>
                </View>
              </View>

              {/* Step 2 */}
              <View className="flex-row items-start mb-4">
                <View className={`w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5 ${step2Done ? 'bg-emerald-500/20 border border-emerald-500' : step2Active ? 'bg-amber-500/20 border border-amber-500 animate-pulse' : 'bg-neutral-900 border border-neutral-800'}`}>
                  {step2Done ? <Check color="#10b981" size={14} /> : step2Active ? <ActivityIndicator size="small" color="#f59e0b" /> : <Clock color="#525252" size={12} />}
                </View>
                <View className="flex-1">
                  <Text className={`text-xs font-bold ${step2Done ? 'text-white' : step2Active ? 'text-amber-400' : 'text-neutral-500'}`}>
                    Network Deposit Detected
                  </Text>
                  <Text className="text-[11px] text-neutral-400 mt-0.5">
                    {step2Done ? 'Deposit detected and verified' : step2Active ? 'Waiting for blockchain network confirmation...' : 'Pending verification'}
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View className="flex-row items-start mb-4">
                <View className={`w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5 ${step3Done ? 'bg-emerald-500/20 border border-emerald-500' : step3Active ? 'bg-amber-500/20 border border-amber-500 animate-pulse' : 'bg-neutral-900 border border-neutral-800'}`}>
                  {step3Done ? <Check color="#10b981" size={14} /> : step3Active ? <ActivityIndicator size="small" color="#f59e0b" /> : <Clock color="#525252" size={12} />}
                </View>
                <View className="flex-1">
                  <Text className={`text-xs font-bold ${step3Done ? 'text-white' : step3Active ? 'text-amber-400' : 'text-neutral-500'}`}>
                    Exchanging & Cross-Chain Routing
                  </Text>
                  <Text className="text-[11px] text-neutral-400 mt-0.5">
                    {step3Done ? `Exchanged to ${toCurr}` : step3Active ? `Routing liquidity to ${toCurr}...` : 'Pending exchange'}
                  </Text>
                </View>
              </View>

              {/* Step 4 */}
              <View className="flex-row items-start mb-4">
                <View className={`w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5 ${step4Done ? 'bg-emerald-500/20 border border-emerald-500' : step4Active ? 'bg-amber-500/20 border border-amber-500 animate-pulse' : 'bg-neutral-900 border border-neutral-800'}`}>
                  {step4Done ? <Check color="#10b981" size={14} /> : step4Active ? <ActivityIndicator size="small" color="#f59e0b" /> : <Clock color="#525252" size={12} />}
                </View>
                <View className="flex-1">
                  <Text className={`text-xs font-bold ${step4Done ? 'text-white' : step4Active ? 'text-amber-400' : 'text-neutral-500'}`}>
                    Broadcasting to Your Wallet
                  </Text>
                  <Text className="text-[11px] text-neutral-400 mt-0.5">
                    {step4Done ? 'Sent on blockchain' : step4Active ? 'Publishing transfer on blockchain network...' : 'Pending broadcast'}
                  </Text>
                </View>
              </View>

              {/* Step 5 */}
              <View className="flex-row items-start">
                <View className={`w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5 ${step5Done ? 'bg-emerald-500/20 border border-emerald-500' : 'bg-neutral-900 border border-neutral-800'}`}>
                  {step5Done ? <Check color="#10b981" size={14} /> : <Clock color="#525252" size={12} />}
                </View>
                <View className="flex-1">
                  <Text className={`text-xs font-bold ${step5Done ? 'text-emerald-400' : 'text-neutral-500'}`}>
                    Delivered & Credited 🎉
                  </Text>
                  <Text className="text-[11px] text-neutral-400 mt-0.5">
                    {step5Done ? `Your ${expectedReceive} ${toCurr} is in your wallet!` : 'Wallet balance updates once confirmed'}
                  </Text>
                </View>
              </View>
            </View>

            {/* BLOCKCHAIN TX HASH (IF DELIVERED) */}
            {payoutHash ? (
              <View className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 my-2">
                <Text className="text-[11px] text-neutral-500 mb-1">Blockchain Transaction Hash</Text>
                <Text className="text-xs font-mono text-white mb-2" numberOfLines={1}>
                  {payoutHash}
                </Text>
                <View className="flex-row space-x-2">
                  <TouchableOpacity
                    onPress={() => copyHash(payoutHash)}
                    className="flex-1 bg-neutral-900 py-2 rounded-xl border border-neutral-800 flex-row items-center justify-center"
                  >
                    {copied ? <Check color="#34d399" size={14} /> : <Copy color="#a3a3a3" size={14} />}
                    <Text className="text-xs text-neutral-300 font-semibold ml-1.5">
                      {copied ? 'Copied!' : 'Copy Hash'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={openExplorer}
                    className="flex-1 bg-emerald-600/20 py-2 rounded-xl border border-emerald-500/30 flex-row items-center justify-center"
                  >
                    <ExternalLink color="#34d399" size={14} />
                    <Text className="text-xs text-emerald-400 font-semibold ml-1.5">
                      View Explorer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* PEACE OF MIND NOTE */}
            <View className="bg-neutral-950/60 p-3.5 rounded-2xl border border-neutral-800/60 my-2 flex-row items-center">
              <ShieldCheck color="#10b981" size={16} />
              <Text className="text-[11px] text-neutral-400 ml-2.5 flex-1 leading-4">
                You can safely close this screen. Your swap will process on-chain in the background and you will receive a notification when complete.
              </Text>
            </View>

            {/* BOTTOM BUTTON */}
            <TouchableOpacity
              onPress={onClose}
              className={`p-4 rounded-xl items-center my-3 ${isFinished ? 'bg-emerald-500' : 'bg-neutral-800 border border-neutral-700'}`}
            >
              <Text className="font-bold text-sm text-white">
                {isFinished ? 'Done' : 'Minimize & Track in Background'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
