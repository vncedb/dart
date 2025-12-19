import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

// Your API Key
const API_KEY = 'test_WVcuFqayebdWuLFtFlTLJZnkdKn'; // Ensure this matches your RevenueCat Dashboard

export const initRevenueCat = async () => {
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: API_KEY });
  } else {
    await Purchases.configure({ apiKey: API_KEY });
  }
};

// Fetch available offerings (products)
export const getProOfferings = async (): Promise<PurchasesPackage[]> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length !== 0) {
      return offerings.current.availablePackages;
    }
  } catch (e) {
    console.error('Error fetching offerings:', e);
  }
  return [];
};

// Purchase a specific package
export const purchasePackage = async (rcPackage: PurchasesPackage): Promise<CustomerInfo> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(rcPackage);
    return customerInfo;
  } catch (e: any) {
    if (e.userCancelled) {
      throw new Error('User cancelled');
    }
    throw e;
  }
};

// Check if user is currently subscribed (entitlement active)
export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    // Replace 'pro' with your actual Entitlement Identifier from RevenueCat dashboard
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch (e) {
    return false;
  }
};

// Restore previous purchases
export const restorePurchases = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch (e) {
    console.error('Error restoring purchases:', e);
    throw e;
  }
};