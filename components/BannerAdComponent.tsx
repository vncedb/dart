// filepath: components/BannerAdComponent.tsx
import React from 'react';
import { Platform, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const androidAdUnitId = 'ca-app-pub-2545384747577514/1081490525';
const iosAdUnitId = 'ca-app-pub-2545384747577514/9754187469';

// Use Test ID in development, and Real ID in production
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : Platform.OS === 'android' 
    ? androidAdUnitId 
    : iosAdUnitId;

export default function BannerAdComponent() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 5 }}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.error('Ad failed to load: ', error);
        }}
      />
    </View>
  );
}