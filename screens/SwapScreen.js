import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
  Keyboard
} from 'react-native';

import { ArrowDown, ChevronRight, X, Copy, Check, Clock, Info, ShieldCheck, Zap } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import useStore from '../store/useStore';
import SwapTrackerModal from '../components/SwapTrackerModal';

const ASSETS = [
  { symbol: 'NGN', name: 'Nigerian Naira', isFiat: true, logo: 'https://cdn.countryflags.com/thumbs/nigeria/flag-round-250.png' },
  { symbol: 'USDT_TRC20', name: 'Tether (TRC20)', isFiat: false, logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  { symbol: 'USDT_BEP20', name: 'Tether (BEP20)', isFiat: false, logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  { symbol: 'USDT_POLYGON', name: 'Tether (Polygon)', isFiat: false, logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  { symbol: 'USDT_ERC20', name: 'Tether (ERC20)', isFiat: false, logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  { symbol: 'BTC', name: 'Bitcoin', isFiat: false, logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
  { symbol: 'ETH', name: 'Ethereum', isFiat: false, logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
  { symbol: 'TRX', name: 'Tron', isFiat: false, logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' },
  { symbol: 'BNB', name: 'Binance Coin', isFiat: false, logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
  { symbol: 'POL', name: 'Polygon', isFiat: false, logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png' }
];

const OTC_ASSETS = ['NGN', 'USDT_TRC20', 'USDT_BEP20', 'USDT_POLYGON', 'USDT_ERC20', 'BTC'];
const ROUTER_ASSETS = ['ETH', 'TRX', 'BNB', 'POL'];

const formatAssetDisplay = (sym) => {
  if (!sym) return { symbol: '', badge: null };
  if (sym === 'USDT_TRC20') return { symbol: 'USDT', badge: 'TRC20' };
  if (sym === 'USDT_BEP20') return { symbol: 'USDT', badge: 'BEP20' };
  if (sym === 'USDT_POLYGON') return { symbol: 'USDT', badge: 'Polygon' };
  if (sym === 'USDT_ERC20') return { symbol: 'USDT', badge: 'ERC20' };
  return { symbol: sym, badge: null };
};

export default function SwapScreen({ route, navigation }) {
  const [payAmount, setPayAmount] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef(null);

  // Router order modal states
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [activeDepositOrder, setActiveDepositOrder] = useState(null);
  const [depositStatus, setDepositStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(1200); // 20 mins
  const [copied, setCopied] = useState(false);

  // Router quote states
  const [routerQuote, setRouterQuote] = useState(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);

  // Sell source selection: 'wallet' (in-app balance) vs 'external' (QR deposit)
  const [sellSource, setSellSource] = useState('wallet');

  // Live on-chain tracker modal
  const [trackerModalVisible, setTrackerModalVisible] = useState(false);
  const [activeTrackerOrder, setActiveTrackerOrder] = useState(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 100, animated: true });
        }, 50);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 50);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const rawInitial = route.params?.initialAsset;
  const initialSymbol = rawInitial === 'USDT' ? 'USDT_TRC20' : (rawInitial || 'USDT_TRC20');
  const initialAssetObj = ASSETS.find(a => a.symbol === initialSymbol) || ASSETS[1];

  const [payAsset, setPayAsset] = useState(initialAssetObj);
  const [receiveAsset, setReceiveAsset] = useState(ASSETS[0]);
  const [showSelector, setShowSelector] = useState({ isOpen: false, type: 'pay' });

  const balances = useStore(state => state.balances);
  const liveRates = useStore(state => state.rates);
  const { swap, sellToNgn, buyCrypto, swapWalletCrypto, getRouterQuote, checkRouterStatus, loading } = useStore();

  useEffect(() => {
    const getLiveRates = async () => {
      try {
        const axios = require('axios');
        const res = await axios.get('http://156.232.88.218:8001/api/v1/crypto/rates');
        const backendRates = res.data.rates;
        useStore.setState((state) => ({
          rates: {
            ...state.rates,
            ...backendRates
          }
        }));
      } catch (err) {
        console.error("Failed to fetch unified rates:", err);
      }
    };
    getLiveRates();
  }, []);

  // Determine swap category
  const isInternalOtc = OTC_ASSETS.includes(payAsset.symbol) && OTC_ASSETS.includes(receiveAsset.symbol);
  const isRouterSell = ROUTER_ASSETS.includes(payAsset.symbol) && (receiveAsset.symbol === 'NGN' || receiveAsset.symbol.startsWith('USDT'));
  const isBuyMode = (payAsset.symbol === 'NGN' || payAsset.symbol.startsWith('USDT')) && ROUTER_ASSETS.includes(receiveAsset.symbol);

  // Sync selected asset with navigation params dynamically
  useEffect(() => {
    if (route.params?.initialAsset) {
      const sym = route.params.initialAsset === 'USDT' ? 'USDT_TRC20' : route.params.initialAsset;
      const found = ASSETS.find(a => a.symbol === sym);
      if (found) {
        setPayAsset(found);
      }
    }
  }, [route.params?.initialAsset]);

  const fromBalance = balances[payAsset.symbol] || 0;
  const parsedPay = parseFloat(payAmount || 0);

  // Set default sell source based on in-app balance
  useEffect(() => {
    if (isRouterSell) {
      if (fromBalance > 0) {
        setSellSource('wallet');
      } else {
        setSellSource('external');
      }
    }
  }, [isRouterSell, payAsset.symbol, fromBalance]);

  // Fetch live router quote when buying crypto or external sell
  useEffect(() => {
    let active = true;
    if ((isBuyMode || (isRouterSell && sellSource === 'external')) && parsedPay > 0) {
      setFetchingQuote(true);
      const timer = setTimeout(async () => {
        const q = await getRouterQuote(payAsset.symbol, receiveAsset.symbol, parsedPay);
        if (active) {
          setRouterQuote(q);
          setFetchingQuote(false);
        }
      }, 400);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setRouterQuote(null);
      setFetchingQuote(false);
    }
  }, [payAsset.symbol, receiveAsset.symbol, payAmount, isBuyMode, isRouterSell, sellSource]);

  // Rate calculations
  const payRate = liveRates[payAsset.symbol] || (payAsset.symbol === 'NGN' ? 1 : 1650);
  const receiveRate = liveRates[receiveAsset.symbol] || (receiveAsset.symbol === 'NGN' ? 1 : 1650);

  let receiveAmount = 0;
  if (isInternalOtc) {
    const grossAmount = parsedPay * (payRate / receiveRate);
    receiveAmount = grossAmount > 0 ? grossAmount * 0.99 : 0;
  } else if (isRouterSell && sellSource === 'wallet') {
    // In-app wallet crypto swap directly to NGN: spot rate with 1% platform fee, 0 network gas fee
    const grossAmount = parsedPay * (payRate / receiveRate);
    receiveAmount = grossAmount > 0 ? grossAmount * 0.99 : 0;
  } else if (routerQuote && routerQuote.estimated_receive) {
    receiveAmount = routerQuote.estimated_receive;
  } else {
    const grossAmount = parsedPay * (payRate / receiveRate);
    receiveAmount = grossAmount > 0 ? grossAmount * 0.99 : 0;
  }

  // Validity checks
  const isBalanceSufficient = (isRouterSell && sellSource === 'external') ? true : parsedPay <= fromBalance;
  const isPairDifferent = payAsset.symbol !== receiveAsset.symbol;
  const isBelowMin = isBuyMode && routerQuote?.min_amount > 0 && parsedPay < routerQuote.min_amount;
  const isValid = parsedPay > 0 && isBalanceSufficient && isPairDifferent && !isBelowMin;

  // Countdown and status polling timer for active deposit order
  useEffect(() => {
    let interval = null;
    let pollInterval = null;

    if (depositModalVisible && activeDepositOrder) {
      setCountdown(1200);
      interval = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      pollInterval = setInterval(async () => {
        const st = await checkRouterStatus(activeDepositOrder.reference_id);
        if (st?.status) {
          setDepositStatus(st.status);
          if (st.status === 'finished') {
            clearInterval(pollInterval);
            Alert.alert(
              'Deposit Confirmed 🎉',
              `Your on-chain deposit has been confirmed! ₦${(activeDepositOrder.expected_ngn || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} has been credited to your Naira wallet balance.`
            );
            setTimeout(() => {
              setDepositModalVisible(false);
              setActiveDepositOrder(null);
              setPayAmount('');
            }, 2500);
          }
        }
      }, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [depositModalVisible, activeDepositOrder]);

  const handleSwap = async () => {
    if (!isValid || loading) return;

    if (payAsset.symbol === receiveAsset.symbol) {
      Alert.alert('Invalid Pair', 'Please select two different assets to swap.');
      return;
    }

    // 1. Internal OTC Swap (NGN <-> USDT variants, BTC)
    if (isInternalOtc) {
      const res = await swap(payAsset.symbol, receiveAsset.symbol, parsedPay);
      if (res?.success) {
        Alert.alert(
          'Swap Successful 🎉',
          `Successfully swapped ${parsedPay} ${payAsset.symbol} to ${receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${receiveAsset.symbol}. Your wallet balance has been updated.`
        );
        setPayAmount('');
      } else {
        const err = res?.error || 'Swap could not be completed. Please try again.';
        Alert.alert('Swap Failed', err);
      }
      return;
    }

    // 2. Sell Crypto for Naira (In-App Wallet Balance vs External QR Deposit)
    if (isRouterSell) {
      if (sellSource === 'wallet') {
        const res = await swapWalletCrypto(payAsset.symbol, parsedPay);
        if (res?.success) {
          Alert.alert(
            'Swap Successful 🎉',
            `Successfully swapped ${parsedPay} ${payAsset.symbol} for ₦${(res.data?.received || receiveAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} NGN. Your Naira wallet balance has been credited instantly.`
          );
          setPayAmount('');
        } else {
          const err = res?.error || 'Swap could not be completed. Please try again.';
          Alert.alert('Swap Failed', err);
        }
        return;
      } else {
        const res = await sellToNgn(payAsset.symbol, parsedPay);
        if (res?.success) {
          setActiveDepositOrder(res.data);
          setDepositStatus('waiting');
          setDepositModalVisible(true);
        } else {
          const err = res?.error || 'Could not initiate swap. Please try again.';
          Alert.alert('Order Failed', err);
        }
        return;
      }
    }

    // 3. Buy Crypto (NGN / USDT -> ETH, TRX, BNB, POL deposited on-chain into user's wallet)
    if (isBuyMode) {
      const res = await buyCrypto(payAsset.symbol, receiveAsset.symbol, parsedPay);
      if (res?.success) {
        setActiveTrackerOrder({
          reference_id: res.data?.reference_id || res.data?.router_id,
          amount_paid: parsedPay,
          from_currency: payAsset.symbol,
          expected_receive: res.data?.expected_crypto || receiveAmount,
          to_currency: receiveAsset.symbol,
          recipient_address: res.data?.recipient_address,
          initial_status: 'waiting'
        });
        setTrackerModalVisible(true);
        setPayAmount('');
      } else {
        const err = res?.error || 'Swap could not be completed.';
        Alert.alert('Swap Failed', err);
      }
      return;
    }

    Alert.alert('Notice', 'Cross-currency swaps are processed directly via on-chain settlement.');
  };

  const copyToClipboard = async (text) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDirection = () => {
    setPayAsset(receiveAsset);
    setReceiveAsset(payAsset);
    setPayAmount('');
  };

  const openSelector = (type) => setShowSelector({ isOpen: true, type });

  const selectAsset = (asset) => {
    if (showSelector.type === 'pay') {
      if (asset.symbol === receiveAsset.symbol) toggleDirection();
      else setPayAsset(asset);
    } else {
      if (asset.symbol === payAsset.symbol) toggleDirection();
      else setReceiveAsset(asset);
    }
    setShowSelector({ isOpen: false, type: 'pay' });
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getButtonText = () => {
    if (!parsedPay || parsedPay <= 0) return 'Enter Amount';
    if (payAsset.symbol === receiveAsset.symbol) return 'Select Different Assets';
    if (!isBalanceSufficient) return `Insufficient ${formatAssetDisplay(payAsset.symbol).symbol} Balance`;
    if (isBelowMin) return `Min Swap: ₦${Math.ceil(routerQuote.min_amount).toLocaleString()}`;
    if (isRouterSell && sellSource === 'external') return 'Generate Deposit Address & Lock Rate';
    return 'Confirm Swap';
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        style={{ flex: 1 }}
        className="bg-black"
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: isKeyboardVisible ? 'flex-start' : 'center',
            paddingHorizontal: 20,
            paddingTop: isKeyboardVisible ? 12 : 20,
            paddingBottom: isKeyboardVisible ? 80 : 30
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-bold mb-2 text-center text-white">Instant Swap & Convert</Text>
          <Text className="text-xs text-neutral-400 mb-5 text-center">
            {isInternalOtc ? 'Instant OTC Swap • 100% Backed Liquidity' :
             isRouterSell && sellSource === 'wallet' ? 'Instant In-App Swap • Zero Gas Fee' :
             isRouterSell && sellSource === 'external' ? 'Convert External Crypto ➔ Naira Bank Balance' :
             isBuyMode ? 'Convert to Real On-Chain Crypto' :
             'Multi-Network Settlement Router'}
          </Text>

          {/* SELL SOURCE SELECTOR (When Selling ETH, TRX, BNB, POL to NGN) */}
          {isRouterSell && (
            <View className="flex-row bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 mb-4">
              <TouchableOpacity
                onPress={() => setSellSource('wallet')}
                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${sellSource === 'wallet' ? 'bg-neutral-800 shadow-md' : ''}`}
              >
                <Zap color={sellSource === 'wallet' ? '#10b981' : '#737373'} size={14} />
                <Text className={`text-xs font-semibold ml-1.5 ${sellSource === 'wallet' ? 'text-white' : 'text-neutral-400'}`}>
                  In-App Balance ({fromBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSellSource('external')}
                className={`flex-1 py-2.5 rounded-xl items-center ${sellSource === 'external' ? 'bg-neutral-800 shadow-md' : ''}`}
              >
                <Text className={`text-xs font-semibold ${sellSource === 'external' ? 'text-white' : 'text-neutral-400'}`}>
                  External Deposit (QR)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* YOU PAY CARD */}
          <View className={`bg-neutral-900 p-6 rounded-[2rem] border ${(!isBalanceSufficient) ? 'border-red-500/50' : 'border-neutral-800'} mb-2`}>
            <Text className="text-xs text-neutral-400 font-medium uppercase mb-3">You Pay</Text>
            <View className="flex-row justify-between items-center h-16">
              <TextInput
                scrollEnabled={false}
                value={payAmount}
                onChangeText={setPayAmount}
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
                keyboardType="numeric"
                className="flex-1 text-4xl font-bold text-white h-full"
                placeholder="0.00"
                placeholderTextColor="#525252"
                style={{ includeFontPadding: false, paddingVertical: 0 }}
              />
              <TouchableOpacity onPress={() => openSelector('pay')} className="flex-row items-center bg-neutral-950 px-3.5 py-2 rounded-full border border-neutral-800 ml-4">
                <Image source={{ uri: payAsset.logo }} className="w-5 h-5 rounded-full mr-2 bg-white" />
                <Text className="text-white font-semibold text-sm mr-1">{formatAssetDisplay(payAsset.symbol).symbol}</Text>
                {formatAssetDisplay(payAsset.symbol).badge && (
                  <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 mr-1.5">
                    <Text className="text-[10px] font-bold text-emerald-400">{formatAssetDisplay(payAsset.symbol).badge}</Text>
                  </View>
                )}
                <ChevronRight color="#525252" size={14} style={{ transform: [{ rotate: '90deg' }] }} />
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center mt-2">
              <Text className={`text-xs ${(!isBalanceSufficient) ? 'text-red-400' : 'text-neutral-500'}`}>
                {isRouterSell && sellSource === 'external' ? 'Send from MetaMask, Trust Wallet, etc.' : `Balance: ${fromBalance.toLocaleString()} ${formatAssetDisplay(payAsset.symbol).symbol}`}
              </Text>
              {!(isRouterSell && sellSource === 'external') && (
                <TouchableOpacity onPress={() => setPayAmount(fromBalance.toString())}>
                  <Text className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">MAX</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SWAP DIRECTION BUTTON */}
          <View className="z-10 items-center -my-4">
            <TouchableOpacity onPress={toggleDirection} className="w-14 h-14 bg-emerald-600 rounded-full items-center justify-center border-4 border-black shadow-xl">
              <ArrowDown color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {/* YOU RECEIVE CARD */}
          <View className="bg-neutral-900 p-6 rounded-[2rem] border border-neutral-800 mt-2">
            <Text className="text-xs text-neutral-400 font-medium uppercase mb-3">You Receive</Text>
            <View className="flex-row justify-between items-center h-16">
              {fetchingQuote ? (
                <View className="flex-1 justify-center">
                  <ActivityIndicator color="#10b981" />
                </View>
              ) : (
                <Text className="flex-1 text-4xl font-bold text-emerald-400 h-full" style={{ includeFontPadding: false, paddingVertical: 0, textAlignVertical: 'center' }} numberOfLines={1}>
                  {receiveAmount ? receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0.00'}
                </Text>
              )}
              <TouchableOpacity onPress={() => openSelector('receive')} className="flex-row items-center bg-neutral-950 px-3.5 py-2 rounded-full border border-neutral-800 ml-4">
                <Image source={{ uri: receiveAsset.logo }} className="w-5 h-5 rounded-full mr-2 bg-white" />
                <Text className="text-white font-semibold text-sm mr-1">{formatAssetDisplay(receiveAsset.symbol).symbol}</Text>
                {formatAssetDisplay(receiveAsset.symbol).badge && (
                  <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 mr-1.5">
                    <Text className="text-[10px] font-bold text-emerald-400">{formatAssetDisplay(receiveAsset.symbol).badge}</Text>
                  </View>
                )}
                <ChevronRight color="#525252" size={14} style={{ transform: [{ rotate: '90deg' }] }} />
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center mt-4">
              <Text className="text-xs text-neutral-500">
                Rate: 1 {formatAssetDisplay(payAsset.symbol).symbol} ≈ {parsedPay > 0 && receiveAmount > 0 ? (receiveAmount / parsedPay).toLocaleString(undefined, { maximumFractionDigits: 6 }) : ((payRate / receiveRate) * 0.99).toLocaleString(undefined, { maximumFractionDigits: 6 })} {formatAssetDisplay(receiveAsset.symbol).symbol}
              </Text>
              <View className="bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Text className="text-[10px] text-emerald-400 font-semibold">1% Fee Included</Text>
              </View>
            </View>
          </View>

          {/* TRANSPARENT TRANSACTION & GAS FEE BREAKDOWN (FOR ON-CHAIN BUY) */}
          {isBuyMode && routerQuote && (
            <View className="bg-neutral-900/90 p-4 rounded-2xl border border-neutral-800 mt-3">
              <View className="flex-row justify-between items-center mb-2.5">
                <Text className="text-xs font-semibold text-neutral-300">Transaction Breakdown</Text>
                <View className="bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Text className="text-[10px] text-emerald-400 font-medium">On-Chain Delivery</Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center py-1.5 border-b border-neutral-800/60">
                <Text className="text-xs text-neutral-400">Pay Amount</Text>
                <Text className="text-xs text-white font-medium">₦{parsedPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>

              <View className="flex-row justify-between items-center py-1.5 border-b border-neutral-800/60">
                <Text className="text-xs text-neutral-400">Platform Fee (1%)</Text>
                <Text className="text-xs text-neutral-300">₦{(routerQuote.fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>

              <View className="flex-row justify-between items-center py-1.5 border-b border-neutral-800/60">
                <Text className="text-xs text-neutral-400">Network & Bridge Gas</Text>
                <Text className="text-xs text-amber-400 font-medium">
                  ~${(routerQuote.network_fee_usd || 0).toFixed(2)} (₦{(routerQuote.network_fee_ngn || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                </Text>
              </View>

              <View className="flex-row justify-between items-center py-1.5">
                <Text className="text-xs font-bold text-white">Estimated Received</Text>
                <View className="items-end">
                  <Text className="text-xs font-bold text-emerald-400">
                    {(routerQuote.estimated_receive || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} {formatAssetDisplay(receiveAsset.symbol).symbol}
                  </Text>
                  {routerQuote.estimated_ngn_value ? (
                    <Text className="text-[10px] text-neutral-400">
                      ≈ ₦{routerQuote.estimated_ngn_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Text>
                  ) : null}
                </View>
              </View>

              {routerQuote.min_amount > 0 && parsedPay < routerQuote.min_amount && (
                <View className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 mt-2">
                  <Text className="text-[11px] text-amber-400">
                    ⚠️ Minimum required swap amount for {formatAssetDisplay(receiveAsset.symbol).symbol} is ₦{routerQuote.min_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}.
                  </Text>
                </View>
              )}

              <Text className="text-[10px] text-neutral-500 mt-2 leading-4">
                ℹ️ Cross-chain delivery involves fixed blockchain validator & bridge gas. Swapping larger amounts significantly reduces the relative percentage impact of network gas fees.
              </Text>
            </View>
          )}

          {/* IN-APP WALLET SWAP PERK (FOR IN-APP SWAPS) */}
          {(isInternalOtc || (isRouterSell && sellSource === 'wallet')) && (
            <View className="bg-neutral-900/90 p-3.5 rounded-2xl border border-neutral-800 mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <ShieldCheck color="#10b981" size={16} />
                <Text className="text-xs text-neutral-300 font-medium ml-2">Internal Wallet Settlement</Text>
              </View>
              <View className="bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Text className="text-[10px] text-emerald-400 font-semibold">Zero Gas Fee • Instant</Text>
              </View>
            </View>
          )}

          {/* CONFIRM BUTTON */}
          <TouchableOpacity
            onPress={handleSwap}
            disabled={!isValid || loading}
            className={`p-4 rounded-xl items-center mt-6 ${!isValid ? 'bg-neutral-900 border border-neutral-800' : 'bg-emerald-500 shadow-lg shadow-emerald-500/20'}`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-lg ${!isValid ? 'text-neutral-600' : 'text-white'}`}>
                {getButtonText()}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ASSET SELECTOR MODAL */}
      <Modal visible={showSelector.isOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-neutral-900 rounded-t-[2rem] h-2/3 p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-white">Select Asset</Text>
              <TouchableOpacity onPress={() => setShowSelector({ isOpen: false })} className="p-2 bg-neutral-800 rounded-full">
                <X color="#9ca3af" size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1">
              {ASSETS.map(asset => {
                const assetDisplay = formatAssetDisplay(asset.symbol);
                return (
                  <TouchableOpacity
                    key={asset.symbol}
                    onPress={() => selectAsset(asset)}
                    className="flex-row justify-between items-center p-4 rounded-2xl mb-2 bg-neutral-950 border border-neutral-800/50"
                  >
                    <View className="flex-row items-center">
                      <Image source={{ uri: asset.logo }} className="w-10 h-10 rounded-full mr-4 bg-white" />
                      <View>
                        <View className="flex-row items-center">
                          <Text className="text-white font-semibold">{assetDisplay.symbol}</Text>
                          {assetDisplay.badge && (
                            <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 ml-2">
                              <Text className="text-[10px] font-bold text-emerald-400">{assetDisplay.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-neutral-500 text-xs">{asset.name}</Text>
                      </View>
                    </View>
                    <Text className="text-white font-semibold">
                      {(balances[asset.symbol] || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DEPOSIT / SELL MODAL WITH QR CODE */}
      <Modal visible={depositModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/80">
          <View className="bg-neutral-900 rounded-t-[2.5rem] p-6 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-lg font-bold text-white">Send {formatAssetDisplay(payAsset.symbol).symbol}</Text>
                <Text className="text-xs text-neutral-400">Lock Rate & Convert to Naira</Text>
              </View>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)} className="p-2 bg-neutral-800 rounded-full">
                <X color="#9ca3af" size={18} />
              </TouchableOpacity>
            </View>

            {activeDepositOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* QR Code Container */}
                <View className="bg-white p-5 rounded-3xl items-center self-center my-3 shadow-xl">
                  <QRCode
                    value={activeDepositOrder.payin_address || ''}
                    size={170}
                    color="#000"
                    backgroundColor="#fff"
                  />
                </View>

                {/* Amount to send */}
                <View className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 my-2 items-center">
                  <Text className="text-xs text-neutral-400">Exact Deposit Amount</Text>
                  <Text className="text-xl font-bold text-emerald-400 mt-1">
                    {activeDepositOrder.amount} {formatAssetDisplay(payAsset.symbol).symbol}
                  </Text>
                  <Text className="text-xs text-neutral-500 mt-1">
                    Credited Amount: ₦{(activeDepositOrder.expected_ngn || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Copyable Address */}
                <View className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 my-2">
                  <Text className="text-xs text-neutral-400 mb-1">One-Time Deposit Address</Text>
                  <Text className="text-white text-xs font-mono mb-3" numberOfLines={2}>
                    {activeDepositOrder.payin_address}
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(activeDepositOrder.payin_address)}
                    className="flex-row items-center justify-center bg-emerald-600/20 py-2.5 rounded-xl border border-emerald-500/30"
                  >
                    {copied ? <Check color="#34d399" size={16} /> : <Copy color="#34d399" size={16} />}
                    <Text className="text-emerald-400 text-xs font-semibold ml-2">
                      {copied ? 'Address Copied!' : 'Copy Deposit Address'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Live Status and Timer */}
                <View className="flex-row justify-between items-center bg-neutral-950 p-4 rounded-2xl border border-neutral-800 my-2">
                  <View className="flex-row items-center">
                    <View className={`w-3 h-3 rounded-full mr-2.5 ${depositStatus === 'finished' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                    <Text className="text-white text-xs font-semibold">
                      {depositStatus === 'waiting' ? 'Waiting for on-chain deposit...' :
                       depositStatus === 'confirming' ? 'Deposit detected! Confirming...' :
                       depositStatus === 'exchanging' ? 'Converting to settlement...' :
                       depositStatus === 'sending' ? 'Crediting Naira balance...' :
                       depositStatus === 'finished' ? 'Deposit Completed!' :
                       'Processing deposit...'}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Clock color="#737373" size={13} />
                    <Text className="text-neutral-400 text-xs font-mono ml-1.5">{formatCountdown(countdown)}</Text>
                  </View>
                </View>

                <Text className="text-[11px] text-neutral-500 text-center my-3">
                  Send the exact amount from MetaMask, TrustWallet, or Binance. Once confirmed on the blockchain, your Naira balance will update automatically.
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      {/* LIVE ON-CHAIN SWAP TRACKER MODAL */}
      <SwapTrackerModal
        visible={trackerModalVisible}
        onClose={() => setTrackerModalVisible(false)}
        order={activeTrackerOrder}
      />
    </SafeAreaView>
  );
}
