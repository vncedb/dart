import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'test_WVcuFqayebdWuLFtFlTLJZnkdKn';
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'test_WVcuFqayebdWuLFtFlTLJZnkdKn';

export const initRevenueCat = async () => {
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
  const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
  await Purchases.configure({ apiKey });
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

let lastKnownProStatus: boolean = false;

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    lastKnownProStatus = customerInfo.entitlements.active['pro'] !== undefined;
    return lastKnownProStatus;
  } catch (e) {
    console.warn('[RevenueCat] Failed to check subscription, using cached status:', e);
    return lastKnownProStatus;
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