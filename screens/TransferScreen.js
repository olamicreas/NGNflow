import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  Image
} from 'react-native';

import { Building, Send, Wallet, Globe, CheckCircle2, ChevronDown, X, AlertCircle, ShieldCheck } from 'lucide-react-native';
import useStore from '../store/useStore';

const CRYPTO_ASSETS = [
  { symbol: 'USDT', name: 'Tether USD', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  { symbol: 'BTC', name: 'Bitcoin', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
  { symbol: 'ETH', name: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
  { symbol: 'BNB', name: 'BNB Chain', logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
  { symbol: 'TRX', name: 'Tron', logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' },
  { symbol: 'POL', name: 'Polygon', logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png' }
];

const USDT_NETWORKS = [
  { id: 'TRC20', label: 'TRC20 (Tron)', key: 'USDT_TRC20', badge: 'Tron' },
  { id: 'BEP20', label: 'BEP20 (BSC)', key: 'USDT_BEP20', badge: 'BSC' },
  { id: 'Polygon', label: 'Polygon POS', key: 'USDT_POLYGON', badge: 'Polygon' },
  { id: 'ERC20', label: 'ERC20 (Ethereum)', key: 'USDT_ERC20', badge: 'Ethereum' }
];

const MIN_AMOUNTS = {
  USDT: 10.0,
  BTC: 0.0002,
  ETH: 0.005,
  BNB: 0.015,
  TRX: 20.0,
  POL: 10.0
};

export default function TransferScreen({ navigation, route }) {
  const [tab, setTab] = useState('crypto');
  const [amount, setAmount] = useState('');

  // Selected crypto
  const [selectedAsset, setSelectedAsset] = useState('USDT');
  const [usdtNetwork, setUsdtNetwork] = useState('TRC20');
  const [address, setAddress] = useState('');

  // Bank transfer states
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountName, setAccountName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showCryptoPicker, setShowCryptoPicker] = useState(false);

  const balances = useStore(state => state.balances);

  // Sync selected asset with navigation params dynamically
  useEffect(() => {
    if (route?.params?.initialAsset) {
      const sym = route.params.initialAsset;
      if (sym.startsWith('USDT')) {
        setSelectedAsset('USDT');
        if (sym === 'USDT_BEP20') setUsdtNetwork('BEP20');
        else if (sym === 'USDT_POLYGON') setUsdtNetwork('Polygon');
        else if (sym === 'USDT_ERC20') setUsdtNetwork('ERC20');
        else setUsdtNetwork('TRC20');
      } else if (['BTC', 'ETH', 'TRX', 'BNB', 'POL'].includes(sym)) {
        setSelectedAsset(sym);
      }
    }
  }, [route?.params?.initialAsset]);

  // Determine current active balance key & network
  const getActiveCurrencyKey = () => {
    if (selectedAsset === 'USDT') {
      const net = USDT_NETWORKS.find(n => n.id === usdtNetwork);
      return net ? net.key : 'USDT_TRC20';
    }
    return selectedAsset;
  };

  const getActiveNetworkName = () => {
    if (selectedAsset === 'USDT') return usdtNetwork;
    if (selectedAsset === 'BTC') return 'Bitcoin';
    if (selectedAsset === 'ETH') return 'ERC20';
    if (selectedAsset === 'TRX') return 'TRC20';
    if (selectedAsset === 'BNB') return 'BEP20';
    if (selectedAsset === 'POL') return 'Polygon';
    return selectedAsset;
  };

  const currentCurrencyKey = getActiveCurrencyKey();
  const currentNetwork = getActiveNetworkName();
  const currentAvailableBalance = balances[currentCurrencyKey] || 0;
  const currentMinAmount = MIN_AMOUNTS[selectedAsset] || 0;

  const parsedAmount = parseFloat(amount || 0);
  const isBelowMin = parsedAmount > 0 && parsedAmount < currentMinAmount;
  const isExceedingBalance = parsedAmount > currentAvailableBalance;

  const banks = useStore(state => state.banks);
  const transferCrypto = useStore(state => state.transferCrypto);
  const withdrawFiat = useStore(state => state.withdrawFiat);
  const resolveAccount = useStore(state => state.resolveAccount);
  const fetchBanks = useStore(state => state.fetchBanks);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    if (banks.length > 0 && !selectedBank) {
      setSelectedBank(banks.find(b => b.code === '058') || banks[0]);
    }
  }, [banks]);

  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      handleResolve();
    } else {
      setAccountName('');
    }
  }, [accountNumber, selectedBank]);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const name = await resolveAccount(accountNumber, selectedBank.code);
      setAccountName(name || 'Invalid Account');
    } catch (e) {
      setAccountName('Invalid Account');
    }
    setResolving(false);
  };

  const handleTransfer = async () => {
    if (!amount || parsedAmount <= 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid amount to send.');
    }

    if (tab === 'crypto') {
      if (!address || !address.trim()) {
        return Alert.alert('Missing Address', 'Please paste a valid destination wallet address.');
      }

      if (parsedAmount < currentMinAmount) {
        return Alert.alert(
          'Below Minimum Amount',
          `The minimum on-chain withdrawal for ${selectedAsset} is ${currentMinAmount} ${selectedAsset}.\n\nPlease enter at least ${currentMinAmount} ${selectedAsset} to proceed.`
        );
      }

      if (parsedAmount > currentAvailableBalance) {
        return Alert.alert(
          'Insufficient Balance',
          `You entered ${parsedAmount} ${selectedAsset}, but your available balance is only ${currentAvailableBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedAsset}.`
        );
      }

      setLoading(true);
      const success = await transferCrypto(currentCurrencyKey, currentNetwork, address.trim(), parsedAmount);
      setLoading(false);

      if (success) {
        Alert.alert(
          'Transfer Broadcasted 🚀',
          `Successfully sent ${parsedAmount} ${selectedAsset} (${currentNetwork}) to ${address.slice(0, 6)}...${address.slice(-4)}.\n\nYour transaction has been submitted to the blockchain.`
        );
        navigation.goBack();
      } else {
        const err = useStore.getState().error || 'Transfer could not be processed.';
        Alert.alert('Transfer Failed', err);
      }
    } else {
      if (!accountNumber || accountNumber.length < 10 || accountName === 'Invalid Account' || !accountName) {
        return Alert.alert('Invalid Account', 'Please ensure recipient bank account details are verified.');
      }
      setLoading(true);
      const success = await withdrawFiat(parsedAmount, selectedBank.code, accountNumber);
      setLoading(false);

      if (success) {
        Alert.alert('Withdrawal Successful 🎉', `Withdrew ₦${parsedAmount.toLocaleString()} to ${accountName} successfully.`);
        navigation.goBack();
      } else {
        Alert.alert('Withdrawal Failed', useStore.getState().error || 'Withdrawal could not be completed.');
      }
    }
  };

  const [bankSearch, setBankSearch] = useState('');

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={20} style={{ flex: 1 }} className="bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold mb-6 text-center text-white">Send & Withdraw</Text>

        {/* Tab Selector */}
        <View className="flex-row bg-neutral-900 rounded-2xl p-1.5 mb-6 border border-neutral-800">
          <TouchableOpacity
            onPress={() => setTab('crypto')}
            className={`flex-1 py-3 items-center rounded-xl ${tab === 'crypto' ? 'bg-neutral-800 shadow' : ''}`}
          >
            <Text className={`font-bold text-sm ${tab === 'crypto' ? 'text-white' : 'text-neutral-500'}`}>Crypto Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('fiat')}
            className={`flex-1 py-3 items-center rounded-xl ${tab === 'fiat' ? 'bg-neutral-800 shadow' : ''}`}
          >
            <Text className={`font-bold text-sm ${tab === 'fiat' ? 'text-white' : 'text-neutral-500'}`}>Naira (Bank)</Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View className="items-center mb-6">
          <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Amount to Send</Text>
          <View className="flex-row items-center justify-center px-4">
            <Text className="text-3xl text-emerald-500 mr-2">{tab === 'fiat' ? '₦' : ''}</Text>
            <TextInput
              scrollEnabled={false}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              className="text-4xl font-bold text-white text-center min-w-[50%] max-w-[80%] h-16"
              placeholder="0.00"
              placeholderTextColor="#525252"
              adjustsFontSizeToFit={true}
              numberOfLines={1}
            />
          </View>

          {/* Balance & Max Button */}
          <View className="flex-row items-center mt-3">
            <Text className={`text-xs ${isExceedingBalance ? 'text-red-400 font-semibold' : 'text-neutral-500'}`}>
              Available: {tab === 'fiat' ? `₦${(balances.NGN || 0).toLocaleString()}` : `${Number(currentAvailableBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedAsset}`}
              {tab === 'crypto' && selectedAsset === 'USDT' ? ` (${usdtNetwork})` : ''}
            </Text>
            {tab === 'crypto' && currentAvailableBalance > 0 && (
              <TouchableOpacity onPress={() => setAmount(currentAvailableBalance.toString())} className="ml-2 bg-emerald-500/10 px-2 py-0.5 rounded">
                <Text className="text-[10px] font-bold text-emerald-400">MAX</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Live Minimum / Gas Free Badge */}
          {tab === 'crypto' && (
            <View className="mt-2.5">
              {isBelowMin ? (
                <View className="bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/25 flex-row items-center">
                  <AlertCircle color="#f59e0b" size={13} />
                  <Text className="text-[11px] text-amber-400 font-semibold ml-1.5">
                    Below minimum transfer: {currentMinAmount} {selectedAsset} required
                  </Text>
                </View>
              ) : selectedAsset === 'USDT' ? (
                <View className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Text className="text-[11px] text-emerald-400 font-medium text-center">
                    Min: 10 USDT • Zero network gas required
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Crypto Form */}
        {tab === 'crypto' ? (
          <View className="bg-neutral-900 rounded-[2rem] p-6 border border-neutral-800">
            {/* Asset Row */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Select Asset</Text>
              <TouchableOpacity
                onPress={() => setShowCryptoPicker(true)}
                className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex-row items-center justify-between"
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center mr-3 border border-emerald-500/20">
                    <Wallet color="#10b981" size={16} />
                  </View>
                  <View>
                    <View className="flex-row items-center">
                      <Text className="text-white font-bold text-base mr-2">{selectedAsset}</Text>
                      {selectedAsset === 'USDT' && (
                        <View className="bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                          <Text className="text-[10px] font-bold text-emerald-400">{usdtNetwork}</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-neutral-500 text-xs">
                      {CRYPTO_ASSETS.find(a => a.symbol === selectedAsset)?.name || selectedAsset}
                    </Text>
                  </View>
                </View>
                <ChevronDown color="#737373" size={18} />
              </TouchableOpacity>
            </View>

            {/* USDT Chain Selector (Pill Row) */}
            {selectedAsset === 'USDT' && (
              <View className="mb-4 bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800">
                <Text className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                  Choose USDT Network
                </Text>
                <View className="flex-row space-x-2">
                  {USDT_NETWORKS.map(net => {
                    const isSelected = usdtNetwork === net.id;
                    const netBal = balances[net.key] || 0;
                    return (
                      <TouchableOpacity
                        key={net.id}
                        onPress={() => setUsdtNetwork(net.id)}
                        className={`flex-1 py-2 px-1 rounded-xl items-center border ${isSelected ? 'bg-neutral-800 border-emerald-500' : 'bg-neutral-900 border-neutral-800/80'}`}
                      >
                        <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                          {net.id}
                        </Text>
                        <Text className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-neutral-500'}`}>
                          {Number(netBal).toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Destination Address */}
            <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Destination Address</Text>
            <TextInput
              scrollEnabled={false}
              value={address}
              onChangeText={setAddress}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3.5 text-white font-mono text-xs mb-2"
              placeholder={`Paste ${selectedAsset === 'USDT' ? usdtNetwork : selectedAsset} address...`}
              placeholderTextColor="#525252"
            />
          </View>
        ) : (
          /* Fiat Form */
          <View className="bg-neutral-900 rounded-[2rem] p-6 border border-neutral-800">
            <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Select Bank</Text>
            <TouchableOpacity
              onPress={() => setShowBankPicker(true)}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex-row items-center justify-between mb-4"
            >
              <View className="flex-row items-center flex-1 mr-2">
                <Building color="#f97316" size={16} className="mr-3" />
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                  {selectedBank ? selectedBank.name : 'Select a Bank'}
                </Text>
              </View>
              <ChevronDown color="#525252" size={18} />
            </TouchableOpacity>

            <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Account Number</Text>
            <TextInput
              scrollEnabled={false}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
              maxLength={10}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-white font-medium"
              placeholder="Enter 10-digit NUBAN"
              placeholderTextColor="#525252"
            />

            {accountNumber.length === 10 && (
              <View className="mt-4 flex-row items-center bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                {resolving ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <>
                    <CheckCircle2 color={accountName === 'Invalid Account' ? '#ef4444' : '#10b981'} size={18} className="mr-2" />
                    <Text className={`font-bold text-sm ${accountName === 'Invalid Account' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {accountName}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleTransfer}
          disabled={loading || isBelowMin || isExceedingBalance}
          className={`mt-6 p-4 rounded-xl items-center flex-row justify-center ${loading || isBelowMin || isExceedingBalance ? 'bg-neutral-900 border border-neutral-800' : 'bg-emerald-500 shadow-lg shadow-emerald-500/20'}`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`font-bold text-lg ${isBelowMin || isExceedingBalance ? 'text-neutral-600' : 'text-white'}`}>
              {isBelowMin ? `Min: ${currentMinAmount} ${selectedAsset}` : isExceedingBalance ? 'Insufficient Balance' : 'Send Now'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Bank Picker Modal */}
        <Modal visible={showBankPicker} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/80">
            <View className="bg-neutral-900 h-2/3 rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-white">Select Bank</Text>
                <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                  <X color="#fff" size={24} />
                </TouchableOpacity>
              </View>
              <TextInput
                scrollEnabled={false}
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search bank name..."
                placeholderTextColor="#525252"
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white font-medium mb-4 h-14"
              />
              <FlatList
                data={banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))}
                keyExtractor={item => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedBank(item);
                      setShowBankPicker(false);
                      setBankSearch('');
                    }}
                    className="p-4 border-b border-neutral-800 flex-row items-center"
                  >
                    <Text className="text-white font-semibold">{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Clean Crypto Asset Picker Modal */}
        <Modal visible={showCryptoPicker} animationType="fade" transparent>
          <View className="flex-1 justify-center items-center bg-black/80 p-6">
            <View className="bg-neutral-900 w-full rounded-[2rem] p-6 border border-neutral-800 max-h-[80%]">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-white">Select Asset</Text>
                <TouchableOpacity onPress={() => setShowCryptoPicker(false)}>
                  <X color="#fff" size={22} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {CRYPTO_ASSETS.map(asset => {
                  let totalAssetBalance = 0;
                  if (asset.symbol === 'USDT') {
                    totalAssetBalance =
                      (balances['USDT_TRC20'] || 0) +
                      (balances['USDT_BEP20'] || 0) +
                      (balances['USDT_POLYGON'] || 0) +
                      (balances['USDT_ERC20'] || 0);
                  } else {
                    totalAssetBalance = balances[asset.symbol] || 0;
                  }

                  return (
                    <TouchableOpacity
                      key={asset.symbol}
                      onPress={() => {
                        setSelectedAsset(asset.symbol);
                        setShowCryptoPicker(false);
                      }}
                      className="p-4 border-b border-neutral-800/60 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center">
                        <Image source={{ uri: asset.logo }} className="w-8 h-8 rounded-full mr-3 bg-white" />
                        <View>
                          <Text className="text-white font-bold text-base">{asset.symbol}</Text>
                          <Text className="text-neutral-500 text-xs">{asset.name}</Text>
                        </View>
                      </View>
                      <Text className="text-white font-semibold text-sm">
                        {Number(totalAssetBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <View style={{ flex: 1 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
