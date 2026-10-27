import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, Modal, FlatList, KeyboardAvoidingView, ScrollView } from 'react-native';

import { Building, Send, Wallet, Globe, CheckCircle2, ChevronDown, X } from 'lucide-react-native';
import useStore from '../store/useStore';

export default function TransferScreen({ navigation, route }) {
  const [tab, setTab] = useState('crypto');
  const [amount, setAmount] = useState('');

  const [currency, setCurrency] = useState('USDT');
  const [network, setNetwork] = useState('ERC20');
  const [address, setAddress] = useState('');

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
      if (sym === 'USDT') {
        setCurrency('USDT_ERC20');
        setNetwork('ERC20');
      } else if (sym === 'BTC') {
        setCurrency('BTC');
        setNetwork('BTC');
      } else if (sym === 'ETH') {
        setCurrency('ETH');
        setNetwork('ERC20');
      } else if (sym === 'TRX') {
        setCurrency('TRX');
        setNetwork('TRC20');
      } else if (sym === 'BNB') {
        setCurrency('BNB');
        setNetwork('BEP20');
      } else if (sym === 'POL') {
        setCurrency('POL');
        setNetwork('Polygon');
      } else {
        setCurrency(sym);
      }
    }
  }, [route?.params?.initialAsset]);

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
      console.log("Resolved Name:", name);
      setAccountName(name || 'Invalid Account');
    } catch (e) {
      console.log("Resolve Error:", e);
      setAccountName('Invalid Account');
    }
    setResolving(false);
  };

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) return Alert.alert('Invalid Amount');
    if (tab === 'crypto' && currency.startsWith('USDT') && parseFloat(amount) < 10) {
      return Alert.alert('Minimum Transfer', 'Minimum on-chain withdrawal for USDT is 10.00 USDT ($10.00 USD).');
    }
    setLoading(true);
    if (tab === 'crypto') {
      if (!address) {
        setLoading(false);
        return Alert.alert('Missing Address');
      }
      const success = await transferCrypto(currency, network, address, parseFloat(amount));
      if (success) {
        Alert.alert('Success', `Sent ${amount} ${currency}`);
        navigation.goBack();
      } else {
        Alert.alert('Transfer Failed', useStore.getState().error);
      }
    } else {
      if (!accountNumber || accountNumber.length < 10 || accountName === 'Invalid Account' || !accountName) {
        setLoading(false);
        return Alert.alert('Invalid Account', 'Please ensure account is verified.');
      }
      const success = await withdrawFiat(parseFloat(amount), selectedBank.code, accountNumber);
      if (success) {
        Alert.alert('Success', `Withdrew ₦${amount} successfully!`);
        navigation.goBack();
      } else {
        Alert.alert('Withdrawal Failed', useStore.getState().error);
      }
    }
    setLoading(false);
  };

  const [bankSearch, setBankSearch] = useState('');

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={20} style={{ flex: 1 }} className="bg-black">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1 }} />
<Text className="text-2xl font-bold mb-6 text-center text-white">Transfer</Text>

        <View className="flex-row bg-neutral-900 rounded-xl p-1 mb-8">
          <TouchableOpacity onPress={() => setTab('crypto')} className={`flex-1 py-3 items-center rounded-lg ${tab === 'crypto' ? 'bg-neutral-800' : ''}`}>
            <Text className={`font-bold ${tab === 'crypto' ? 'text-white' : 'text-neutral-500'}`}>Crypto</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('fiat')} className={`flex-1 py-3 items-center rounded-lg ${tab === 'fiat' ? 'bg-neutral-800' : ''}`}>
            <Text className={`font-bold ${tab === 'fiat' ? 'text-white' : 'text-neutral-500'}`}>Fiat (NGN)</Text>
          </TouchableOpacity>
        </View>

        <View className="items-center mb-8">
          <Text className="text-sm font-medium text-neutral-400 uppercase mb-4">Amount to Send</Text>
          <View className="flex-row items-center justify-center px-4">
            <Text className="text-3xl text-emerald-500 mr-2">{tab === 'fiat' ? '₦' : ''}</Text>
            <TextInput scrollEnabled={false}
              value={amount} onChangeText={setAmount} keyboardType="numeric"
              className="text-4xl font-bold text-white text-center min-w-[50%] max-w-[80%] h-16"
              placeholder="0.00" placeholderTextColor="#525252"
              adjustsFontSizeToFit={true}
              numberOfLines={1}
            />
          </View>
          <Text className="text-sm font-medium text-neutral-500 mt-4">Available: {tab === 'fiat' ? `₦${balances.NGN?.toLocaleString()}` : `${balances[currency]} ${currency}`}</Text>
          {tab === 'crypto' && currency.startsWith('USDT') && (
            <View className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mt-2">
              <Text className="text-[11px] text-emerald-400 font-medium">
                Min: 10 USDT • Zero network gas required
              </Text>
            </View>
          )}
        </View>

        {tab === 'crypto' ? (
          <View className="bg-neutral-900 rounded-[2rem] p-6 border border-neutral-800">
            <View className="flex-row justify-between mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Asset</Text>
                <TouchableOpacity onPress={() => setShowCryptoPicker(true)} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Wallet color="#10b981" size={16} className="mr-2" />
                    <Text className="text-white font-bold">{currency}</Text>
                  </View>
                  <ChevronDown color="#525252" size={16} />
                </TouchableOpacity>
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Network</Text>
                <TouchableOpacity onPress={() => setNetwork(network === 'ERC20' ? 'TRC20' : network === 'TRC20' ? 'Polygon' : network === 'Bitcoin' ? 'Lightning' : network === 'Lightning' ? 'Bitcoin' : 'ERC20')} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex-row items-center justify-between">
                  <Text className="text-white font-bold">{network}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Destination Address</Text>
            <TextInput scrollEnabled={false}
              value={address} onChangeText={setAddress}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-white font-medium mb-2"
              placeholder="Paste wallet address" placeholderTextColor="#525252"
            />
          </View>
        ) : (
          <View className="bg-neutral-900 rounded-[2rem] p-6 border border-neutral-800">
            <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Select Bank</Text>
            <TouchableOpacity onPress={() => setShowBankPicker(true)} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Building color="#f97316" size={16} className="mr-3" />
                <Text className="text-white font-semibold">{selectedBank ? selectedBank.name : 'Select a Bank'}</Text>
              </View>
              <ChevronDown color="#525252" size={20} />
            </TouchableOpacity>

            <Text className="text-xs font-semibold text-neutral-400 mb-2 uppercase">Account Number</Text>
            <TextInput scrollEnabled={false}
              value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" maxLength={10}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-white font-medium"
              placeholder="Enter 10-digit NUBAN" placeholderTextColor="#525252"
            />

            {accountNumber.length === 10 && (
              <View className="mt-4 flex-row items-center bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                {resolving ? <ActivityIndicator size="small" color="#10b981" /> : (
                  <>
                    <CheckCircle2 color={accountName === 'Invalid Account' ? '#ef4444' : '#10b981'} size={18} className="mr-2" />
                    <Text className={`font-bold ${accountName === 'Invalid Account' ? 'text-red-400' : 'text-emerald-400'}`}>{accountName}</Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={handleTransfer}
          disabled={loading || parseFloat(balances[tab === 'fiat' ? 'NGN' : currency]) === 0}
          className={`mt-8 p-4 rounded-xl items-center flex-row justify-center ${parseFloat(balances[tab === 'fiat' ? 'NGN' : currency]) === 0 ? 'bg-neutral-800' : 'bg-emerald-500'}`}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="font-bold text-lg text-white">Send Now</Text>}
        </TouchableOpacity>


        <Modal visible={showBankPicker} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/80">
            <View className="bg-neutral-900 h-2/3 rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-white">Select Bank</Text>
                <TouchableOpacity onPress={() => setShowBankPicker(false)}><X color="#fff" size={24} /></TouchableOpacity>
              </View>
              <TextInput scrollEnabled={false}
                value={bankSearch} onChangeText={setBankSearch}
                placeholder="Search bank name..." placeholderTextColor="#525252"
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white font-medium mb-4 h-14"
              />
              <FlatList
                data={banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))}
                keyExtractor={item => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setSelectedBank(item); setShowBankPicker(false); setBankSearch(''); }}
                    className="p-4 border-b border-neutral-800 flex-row items-center"
                  >
                    <Text className="text-white font-semibold">{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        <Modal visible={showCryptoPicker} animationType="fade" transparent>
          <View className="flex-1 justify-center items-center bg-black/80 p-6">
            <View className="bg-neutral-900 w-full rounded-[2rem] p-6 border border-neutral-800">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-white">Select Asset</Text>
                <TouchableOpacity onPress={() => setShowCryptoPicker(false)}><X color="#fff" size={24} /></TouchableOpacity>
              </View>
              {['USDT_TRC20', 'USDT_BEP20', 'USDT_POLYGON', 'USDT_ERC20', 'BTC', 'ETH', 'TRX', 'BNB', 'POL'].map(coin => (
                <TouchableOpacity
                  key={coin}
                  onPress={() => {
                    setCurrency(coin);
                    if (coin === 'USDT_TRC20' || coin === 'TRX') setNetwork('TRC20');
                    else if (coin === 'USDT_BEP20' || coin === 'BNB') setNetwork('BEP20');
                    else if (coin === 'USDT_POLYGON' || coin === 'POL') setNetwork('Polygon');
                    else if (coin === 'BTC') setNetwork('Bitcoin');
                    else setNetwork('ERC20');
                    setShowCryptoPicker(false);
                  }}
                  className="p-4 border-b border-neutral-800 flex-row items-center justify-between"
                >
                  <Text className="text-white font-bold text-lg">{coin}</Text>
                  <Text className="text-neutral-500 font-medium">{(balances[coin] || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} {coin}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
        <View style={{ flex: 1 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
