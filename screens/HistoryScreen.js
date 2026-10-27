import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { ArrowUpRight, ArrowDownLeft, Clock, RefreshCw, X, Zap } from 'lucide-react-native';
import useStore from '../store/useStore';
import SwapTrackerModal from '../components/SwapTrackerModal';

const formatHistoryAsset = (curr) => {
  if (!curr) return { symbol: '', badge: null };
  if (curr === 'USDT_TRC20') return { symbol: 'USDT', badge: 'TRC20' };
  if (curr === 'USDT_BEP20') return { symbol: 'USDT', badge: 'BEP20' };
  if (curr === 'USDT_POLYGON') return { symbol: 'USDT', badge: 'Polygon' };
  if (curr === 'USDT_ERC20') return { symbol: 'USDT', badge: 'ERC20' };
  return { symbol: curr, badge: null };
};

export default function HistoryScreen() {
  const transactions = useStore(state => state.transactions);
  const [selectedTx, setSelectedTx] = useState(null);
  const [trackerVisible, setTrackerVisible] = useState(false);
  const [activeTrackerOrder, setActiveTrackerOrder] = useState(null);

  const getIcon = (type) => {
    if (type === 'deposit') return <ArrowDownLeft color="#10b981" size={20} />;
    if (type === 'swap') return <RefreshCw color="#3b82f6" size={20} />;
    return <ArrowUpRight color="#f97316" size={20} />;
  };

  const getColorClass = (type) => {
    if (type === 'deposit') return 'bg-emerald-500/10';
    if (type === 'swap') return 'bg-blue-500/10';
    return 'bg-orange-500/10';
  };

  const getTextColor = (type) => {
    if (type === 'deposit') return 'text-emerald-500';
    if (type === 'swap') return 'text-blue-500';
    return 'text-white';
  };
  
  const getPrefix = (type) => {
    if (type === 'deposit') return '+';
    if (type === 'withdrawal') return '-';
    return '';
  };

  const handleTxPress = (tx) => {
    if (tx.reference_id && (tx.type === 'swap' || tx.type === 'deposit')) {
      let meta = {};
      try {
        meta = JSON.parse(tx.metadata_json || '{}');
      } catch (e) {}

      setActiveTrackerOrder({
        reference_id: tx.reference_id,
        amount_paid: meta.amount_paid || tx.amount,
        from_currency: meta.from_currency || tx.currency,
        expected_receive: meta.expected_crypto || meta.expected_ngn || tx.amount,
        to_currency: meta.to_currency || tx.currency,
        recipient_address: meta.recipient_address,
        initial_status: tx.status === 'completed' ? 'finished' : 'waiting'
      });
      setTrackerVisible(true);
      return;
    }
    setSelectedTx(tx);
  };

  return (
    <View className="flex-1 bg-black px-5 pt-20">
      <Text className="text-2xl font-bold text-center text-white mb-8">Transaction History</Text>
      
      {(!transactions || transactions.length === 0) ? (
        <View className="flex-1 justify-center items-center -mt-20">
           <View className="w-24 h-24 bg-neutral-900 rounded-full items-center justify-center mb-6">
             <Clock color="#525252" size={40} />
           </View>
           <Text className="text-white text-xl font-bold mb-2">No Transactions Yet</Text>
           <Text className="text-neutral-400 text-center px-8">Your recent deposits, withdrawals, and swaps will appear here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {transactions.map((tx, index) => {
            const isPending = tx.status === 'pending';
            const isRouterSwap = !!tx.reference_id;
            const assetInfo = formatHistoryAsset(tx.currency);

            return (
              <TouchableOpacity 
                key={tx.id || index} 
                onPress={() => handleTxPress(tx)}
                className={`flex-row items-center justify-between bg-neutral-900 p-4 rounded-2xl mb-3 border ${isPending ? 'border-amber-500/40 bg-neutral-900/95' : 'border-neutral-800'}`}
              >
                <View className="flex-row items-center flex-1">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${getColorClass(tx.type)}`}>
                    {getIcon(tx.type)}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center flex-wrap">
                      <Text className="text-white font-bold text-base capitalize mr-1.5">{tx.type} {assetInfo.symbol}</Text>
                      {assetInfo.badge && (
                        <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 mr-1.5">
                          <Text className="text-[10px] font-bold text-emerald-400">{assetInfo.badge}</Text>
                        </View>
                      )}
                      {isPending && (
                        <View className="bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex-row items-center">
                          <View className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 animate-pulse" />
                          <Text className="text-[10px] font-bold text-amber-400">Live</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-neutral-400 text-xs mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                <View className="items-end flex-shrink ml-2 max-w-[45%]">
                  <Text 
                    className={`font-bold text-base ${getTextColor(tx.type)}`}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {getPrefix(tx.type)}{tx.amount} {assetInfo.symbol}
                  </Text>
                  <Text className={`text-xs mt-0.5 capitalize font-medium ${isPending ? 'text-amber-400' : tx.status === 'completed' ? 'text-emerald-500' : 'text-neutral-500'}`}>
                    {isPending ? 'Processing...' : tx.status}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Transaction Details Modal (For standard txs) */}
      <Modal visible={!!selectedTx} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="bg-neutral-900 rounded-t-3xl p-6 min-h-[50%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-white">Transaction Details</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)} className="p-2 bg-neutral-800 rounded-full">
                <X color="#fff" size={20} />
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="items-center justify-center mb-8">
                  <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${getColorClass(selectedTx.type)}`}>
                    {getIcon(selectedTx.type)}
                  </View>
                  <View className="flex-row items-center justify-center">
                    <Text className={`text-3xl font-bold ${getTextColor(selectedTx.type)} mr-2`}>
                      {getPrefix(selectedTx.type)}{selectedTx.amount} {formatHistoryAsset(selectedTx.currency).symbol}
                    </Text>
                    {formatHistoryAsset(selectedTx.currency).badge && (
                      <View className="bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                        <Text className="text-xs font-bold text-emerald-400">{formatHistoryAsset(selectedTx.currency).badge}</Text>
                      </View>
                    )}
                  </View>
                  <View className="bg-neutral-800 px-3 py-1 rounded-full mt-2">
                    <Text className="text-neutral-300 capitalize font-medium">{selectedTx.status}</Text>
                  </View>
                </View>

                <View className="space-y-4">
                  <View className="flex-row justify-between items-center py-3 border-b border-neutral-800">
                    <Text className="text-neutral-400">Type</Text>
                    <Text className="text-white capitalize font-medium">{selectedTx.type}</Text>
                  </View>

                  <View className="flex-row justify-between items-center py-3 border-b border-neutral-800">
                    <Text className="text-neutral-400">Asset & Network</Text>
                    <View className="flex-row items-center">
                      <Text className="text-white font-medium mr-1.5">{formatHistoryAsset(selectedTx.currency).symbol}</Text>
                      {formatHistoryAsset(selectedTx.currency).badge && (
                        <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          <Text className="text-[10px] font-bold text-emerald-400">{formatHistoryAsset(selectedTx.currency).badge}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <View className="flex-row justify-between items-center py-3 border-b border-neutral-800">
                    <Text className="text-neutral-400">Date</Text>
                    <Text className="text-white font-medium">{new Date(selectedTx.created_at).toLocaleString()}</Text>
                  </View>

                  <View className="flex-row justify-between items-center py-3 border-b border-neutral-800">
                    <Text className="text-neutral-400">Reference ID</Text>
                    <Text className="text-white font-medium text-xs w-1/2 text-right" numberOfLines={2}>
                      {selectedTx.reference_id || 'N/A'}
                    </Text>
                  </View>

                  {selectedTx.metadata_json && (
                    <View className="mt-4 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <Text className="text-neutral-400 mb-2">Additional Metadata</Text>
                      {Object.entries(JSON.parse(selectedTx.metadata_json)).map(([key, value]) => (
                        <View key={key} className="flex-row justify-between mt-2">
                          <Text className="text-neutral-500 capitalize">{key.replace('_', ' ')}</Text>
                          <Text className="text-white font-medium ml-4 shrink">{value.toString()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Live Swap Tracker Modal (For on-chain swaps) */}
      <SwapTrackerModal
        visible={trackerVisible}
        onClose={() => setTrackerVisible(false)}
        order={activeTrackerOrder}
      />
    </View>
  );
}
