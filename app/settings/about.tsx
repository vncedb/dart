// Automated versioning and themed logos
import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';

export default function AboutScreen() {
    const theme = useAppTheme();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Automated Versioning from app.json / package.json via Expo Constants
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';
    
    // Automated Date (or hardcoded release date if preferred)
    const buildDate = "2024.01.28"; 

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="About" />
            
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center', paddingBottom: 100 }}>
                {/* Logo Box - Themed Images */}
                <View style={{ 
                    marginBottom: 24, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    shadowColor: theme.colors.primary,
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                    elevation: 10
                }}>
                    <Image 
                        source={
                            isDark 
                                ? require('../../assets/images/icon-transparent-white.png') 
                                : require('../../assets/images/icon-transparent.png')
                        } 
                        style={{ width: 100, height: 100 }} 
                        resizeMode="contain" 
                    />
                </View>

                <Text style={{ fontSize: 28, fontWeight: '900', color: theme.colors.text, marginBottom: 8 }}>DART</Text>
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 48, textAlign: 'center', fontWeight: '500' }}>
                    Daily Accomplishment Report Tracker
                </Text>

                {/* Details Card */}
                <View style={{ 
                    width: '100%', 
                    backgroundColor: theme.colors.card, 
                    borderRadius: 24, 
                    borderWidth: 1, 
                    borderColor: theme.colors.border, 
                    padding: 24,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ color: theme.colors.textSecondary, fontWeight: '500' }}>Version</Text>
                        <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{appVersion}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginBottom: 16 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ color: theme.colors.textSecondary, fontWeight: '500' }}>Build Number</Text>
                        <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{buildNumber}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginBottom: 16 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: theme.colors.textSecondary, fontWeight: '500' }}>Build Date</Text>
                        <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{buildDate}</Text>
                    </View>
                </View>

                {/* Developer Info */}
                <View style={{ marginTop: 48, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                        Developed by Project Vdb
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                        © 2024 All Rights Reserved
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}