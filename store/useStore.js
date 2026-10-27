import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import axios from 'axios';

const API_URL = 'http://156.232.88.218:8001/api/v1';

const useStore = create((set, get) => ({
  user: null,
  token: null,
  balances: { NGN: 0, ETH: 0, BTC: 0, TRX: 0, USDT_TRON: 0, USDC_ETH: 0 },
  rates: { USDT: 1500, USDT_ERC20: 1500, USDT_TRC20: 1500, USDT_BEP20: 1500, USDT_POLYGON: 1500, BTC: 95000000, ETH: 4500000, TRX: 250, BNB: 850000, POL: 600, NGN: 1 },
  marketData: { BTC: { price: 0, change24h: 0 }, ETH: { price: 0, change24h: 0 }, USDT: { price: 0, change24h: 0 } },
  transactions: [],
  cards: [],
  banks: [],
  notifications: [],
  unreadNotificationsCount: 0,
  loading: false,
  error: null,
  
  init: async () => {
    try {
      await get().loadNotifications();
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        set({ token });
        await get().fetchUserData(token);
        await get().fetchRates();
      }
    } catch (e) { console.error('Init error', e); }
  },

  fetchUserData: async (token) => {
    try {
      const res = await axios.get(`${API_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      const newBalances = { NGN: 0, ETH: 0, BTC: 0, TRX: 0, USDT_TRON: 0, USDC_ETH: 0, USDT: 0 };
      
      // Merge returned balances directly
      if (data.balances) {
        Object.keys(data.balances).forEach(key => {
          newBalances[key] = data.balances[key];
        });
      }
      
      set({ 
        user: data.user, 
        balances: newBalances,
        transactions: data.transactions || []
      });
    } catch (error) {
      console.error('Fetch user data error', error);
      if (error.response?.status === 401) get().logout();
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const formData = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const res = await axios.post(`${API_URL}/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const token = res.data.access_token;
      await SecureStore.setItemAsync('token', token);
      set({ token });
      await get().fetchUserData(token);
      await get().fetchRates();
      set({ loading: false });
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
    }
  },

  register: async (email, password, fullName) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/auth/register?email=${email}&password=${password}&full_name=${fullName}`);
      await get().login(email, password);
    } catch (error) { set({ error: error.response?.data?.detail || error.message, loading: false }); }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    set({ user: null, token: null, balances: { NGN: 0, ETH: 0, BTC: 0, TRX: 0, USDT_TRON: 0, USDC_ETH: 0 }, transactions: [], cards: [] });
  },

  clearError: () => set({ error: null }),

  swap: async (fromAsset, toAsset, amount) => {
    set({ loading: true, error: null });
    try {
      const isFiat = fromAsset === 'NGN' || toAsset === 'NGN';
      const endpoint = isFiat ? `${API_URL}/fiat/swap` : `${API_URL}/crypto/swap`;
      
      const res = await axios.post(`${endpoint}?from_currency=${fromAsset}&to_currency=${toAsset}&amount=${amount}`, {}, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchUserData(get().token);
      set({ loading: false });
      return { success: true, data: res.data };
    } catch (error) {
      let rawMsg = error.response?.data?.detail || error.message || 'Swap could not be processed';
      let sanitized = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
      sanitized = sanitized
        .replace(/changenow/gi, 'liquidity network')
        .replace(/bitnob/gi, 'banking network')
        .replace(/flutterwave/gi, 'settlement network')
        .replace(/tatum/gi, 'network provider')
        .replace(/coingecko/gi, 'market feed');
      set({ error: sanitized, loading: false });
      return { success: false, error: sanitized };
    }
  },

  getRouterQuote: async (fromAsset, toAsset, amount) => {
    try {
      const res = await axios.get(`${API_URL}/router/quote?from_currency=${fromAsset}&to_currency=${toAsset}&amount=${amount || 0}`);
      return res.data;
    } catch (error) {
      console.error('getRouterQuote error', error);
      return null;
    }
  },

  sellToNgn: async (fromAsset, amount) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/router/sell-to-ngn`, {
        from_currency: fromAsset,
        amount: parseFloat(amount)
      }, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      set({ loading: false });
      return { success: true, data: res.data };
    } catch (error) {
      let rawMsg = error.response?.data?.detail || error.message || 'Swap could not be initiated';
      let sanitized = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
      sanitized = sanitized
        .replace(/changenow/gi, 'liquidity network')
        .replace(/bitnob/gi, 'banking network')
        .replace(/flutterwave/gi, 'settlement network')
        .replace(/tatum/gi, 'network provider')
        .replace(/coingecko/gi, 'market feed');
      set({ error: sanitized, loading: false });
      return { success: false, error: sanitized };
    }
  },

  swapWalletCrypto: async (fromAsset, amount) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/router/swap-wallet-crypto`, {
        from_currency: fromAsset,
        amount: parseFloat(amount)
      }, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchUserData(get().token);
      set({ loading: false });
      return { success: true, data: res.data };
    } catch (error) {
      let rawMsg = error.response?.data?.detail || error.message || 'Swap could not be completed';
      let sanitized = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
      sanitized = sanitized
        .replace(/changenow/gi, 'liquidity network')
        .replace(/bitnob/gi, 'banking network')
        .replace(/flutterwave/gi, 'settlement network')
        .replace(/tatum/gi, 'network provider')
        .replace(/coingecko/gi, 'market feed');
      set({ error: sanitized, loading: false });
      return { success: false, error: sanitized };
    }
  },

  buyCrypto: async (fromAsset, toAsset, amount, recipientAddress = null) => {
    set({ loading: true, error: null });
    try {
      const payload = {
        from_currency: fromAsset,
        to_currency: toAsset,
        amount: parseFloat(amount)
      };
      if (recipientAddress) {
        payload.recipient_address = recipientAddress;
      }
      const res = await axios.post(`${API_URL}/router/buy-crypto`, payload, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchUserData(get().token);
      set({ loading: false });
      return { success: true, data: res.data };
    } catch (error) {
      let rawMsg = error.response?.data?.detail || error.message || 'Swap could not be completed';
      let sanitized = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
      sanitized = sanitized
        .replace(/changenow/gi, 'liquidity network')
        .replace(/bitnob/gi, 'banking network')
        .replace(/flutterwave/gi, 'settlement network')
        .replace(/tatum/gi, 'network provider')
        .replace(/coingecko/gi, 'market feed');
      set({ error: sanitized, loading: false });
      return { success: false, error: sanitized };
    }
  },

  checkRouterStatus: async (refId) => {
    try {
      const res = await axios.get(`${API_URL}/router/status/${refId}`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      if (res.data?.status === 'finished') {
        await get().fetchUserData(get().token);
      }
      return res.data;
    } catch (error) {
      return { status: 'unknown' };
    }
  },

  fetchCards: async () => {
    try {
      const res = await axios.get(`${API_URL}/cards/my-cards`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      set({ cards: res.data.cards });
    } catch (error) { console.error('Fetch cards error', error); }
  },

  issueCard: async (amount) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/cards/issue?funding_amount=${amount}`, {}, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchCards(); 
      await get().fetchUserData(get().token); 
      set({ loading: false });
      return true;
    } catch (error) { set({ error: error.response?.data?.detail || error.message, loading: false }); return false; }
  },

  updatePushToken: async (token) => {
    try {
      await axios.post(`${API_URL}/user/push-token`, { push_token: token }, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      // Optionally update local user state
      set(state => ({ user: { ...state.user, push_token: token } }));
    } catch (error) { console.log(error); }
  },

  getFiatDepositAccount: async () => {
    try {
      const res = await axios.get(`${API_URL}/fiat/deposit-account`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      return `${res.data.account_number} (${res.data.bank_name})`;
    } catch (error) {
      console.log("Error getting fiat deposit account", error);
      return "";
    }
  },
  getDepositAddress: async (currency, network) => {
    try {
      const res = await axios.get(`${API_URL}/crypto/deposit-address/${currency}?network=${network}`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      return res.data.address;
    } catch (error) {
      console.log('Error getting deposit address', error);
      if (error.response?.status === 401) get().logout();
      return '';
    }
  },

  deleteCard: async (cardId) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`${API_URL}/cards/delete/${cardId}`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchCards();
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      return false;
    }
  },
  
  submitKYC: async (dob, title, gender) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/user/kyc`, { date_of_birth: dob, title, gender }, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchUserData(get().token);
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      return false;
    }
  },

  fetchRates: async (base, target) => {
    try {
      const res = await axios.get(`${API_URL}/crypto/rates?base_currency=${base}&target_currency=${target}`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      return res.data.rate;
    } catch (error) {
      return null;
    }
  },

  withdrawFiat: async (amount, bankCode, accountNumber) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/fiat/withdraw?amount=${amount}&bank_code=${bankCode}&account_number=${accountNumber}`, {}, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchUserData(get().token);
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      return false;
    }
  },

  transferCrypto: async (currency, network, address, amount) => {
    set({ loading: true, error: null });
    try {
      await axios.post(`${API_URL}/crypto/transfer?currency=${currency}&network=${network}&address=${address}&amount=${amount}`, {}, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      await get().fetchUserData(get().token);
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      return false;
    }
  },

  fetchBanks: async () => {
    try {
      const res = await axios.get(`${API_URL}/fiat/banks`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      const banksList = res.data.banks || res.data || [];
      set({ banks: banksList });
      return banksList;
    } catch (error) {
      return [];
    }
  },

  fetchMarketData: async () => {
    try {
      const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd&include_24hr_change=true');
      const data = res.data;
      set({ 
        marketData: {
          BTC: { price: data.bitcoin.usd, change24h: data.bitcoin.usd_24h_change },
          ETH: { price: data.ethereum.usd, change24h: data.ethereum.usd_24h_change },
          USDT: { price: data.tether.usd, change24h: data.tether.usd_24h_change }
        }
      });
    } catch (error) { console.error('Market data error', error); }
  },

  resolveAccount: async (accountNumber, bankCode) => {
    try {
      const res = await axios.get(`${API_URL}/fiat/resolve-account?account_number=${accountNumber}&bank_code=${bankCode}`, {
        headers: { Authorization: `Bearer ${get().token}` }
      });
      return res.data.account_name;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Could not verify account");
    }
  },

  loadNotifications: async () => {
    try {
      const stored = await AsyncStorage.getItem('@ngnflow_notifications');
      let list = stored ? JSON.parse(stored) : [];

      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        if (presented && presented.length > 0) {
          presented.forEach(item => {
            const id = item.request.identifier || item.id || Date.now().toString();
            const exists = list.some(n => n.id === id);
            if (!exists) {
              list.unshift({
                id,
                title: item.request.content.title || 'Notification',
                body: item.request.content.body || '',
                date: new Date(item.date || Date.now()).toISOString(),
                read: false,
                data: item.request.content.data || {},
              });
            }
          });
          await AsyncStorage.setItem('@ngnflow_notifications', JSON.stringify(list));
        }
      } catch (err) {
        console.log('Error checking presented notifications:', err);
      }

      const unread = list.filter(n => !n.read).length;
      set({ notifications: list, unreadNotificationsCount: unread });
    } catch (e) {
      console.log('Error loading notifications:', e);
    }
  },

  addNotification: async (notif) => {
    try {
      const current = get().notifications;
      const updated = [notif, ...current.filter(n => n.id !== notif.id)];
      const unread = updated.filter(n => !n.read).length;
      set({ notifications: updated, unreadNotificationsCount: unread });
      await AsyncStorage.setItem('@ngnflow_notifications', JSON.stringify(updated));
    } catch (e) {
      console.log('Error saving notification:', e);
    }
  },

  markNotificationAsRead: async (id) => {
    try {
      const updated = get().notifications.map(n => n.id === id ? { ...n, read: true } : n);
      const unread = updated.filter(n => !n.read).length;
      set({ notifications: updated, unreadNotificationsCount: unread });
      await AsyncStorage.setItem('@ngnflow_notifications', JSON.stringify(updated));
    } catch (e) {
      console.log('Error marking notification as read:', e);
    }
  },

  markAllNotificationsAsRead: async () => {
    try {
      const updated = get().notifications.map(n => ({ ...n, read: true }));
      set({ notifications: updated, unreadNotificationsCount: 0 });
      await AsyncStorage.setItem('@ngnflow_notifications', JSON.stringify(updated));
    } catch (e) {
      console.log('Error marking all notifications as read:', e);
    }
  },

  clearNotifications: async () => {
    try {
      set({ notifications: [], unreadNotificationsCount: 0 });
      await AsyncStorage.removeItem('@ngnflow_notifications');
    } catch (e) {
      console.log('Error clearing notifications:', e);
    }
  },
}));

export default useStore;
