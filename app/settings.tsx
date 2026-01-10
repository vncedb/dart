import {
  ArrowRight01Icon,
  Download02Icon,
  FileValidationIcon,
  Logout02Icon,
  Mail01Icon,
  Moon02Icon,
  Notification03Icon,
  Shield01Icon,
  VolumeHighIcon
} from '@hugeicons/core-free-icons';

import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Footer from '../components/Footer'; // Universal Footer
import Header from '../components/Header'; // Universal Header
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import { useAppTheme } from '../constants/theme';
import { supabase } from '../lib/supabase';

type AppSettings = {
  soundEnabled: boolean;
  biometricEnabled: boolean;
};

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  
  const [settings, setSettings] = useState<AppSettings>({
    soundEnabled: true,
    biometricEnabled: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  // Load Settings
  React.useEffect(() => {
      const load = async () => {
        try {
          const stored = await AsyncStorage.getItem('appSettings');
          if (stored) setSettings(JSON.parse(stored));
          const compatible = await LocalAuthentication.hasHardwareAsync();
          setBiometricSupported(compatible);
        } catch (e) { console.log(e); }
      };
      load();
  }, []);

  const saveSetting = async (key: keyof AppSettings, value: boolean) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      
      if (key === 'biometricEnabled' && value) {
         const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity' });
         if (!result.success) {
            const reverted = { ...settings, biometricEnabled: false };
            setSettings(reverted);
            await AsyncStorage.setItem('appSettings', JSON.stringify(reverted));
            setAlertConfig({ visible: true, type: 'error', title: 'Failed', message: 'Authentication failed.', onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
         }
      }
    } catch (e) { console.log(e); }
  };

  const handleSignOut = () => {
    setAlertConfig({
        visible: true, type: 'warning', title: 'Sign Out?', message: 'Are you sure?', confirmText: 'Sign Out', cancelText: 'Cancel',
        onConfirm: async () => {
            setAlertConfig((p:any) => ({...p, visible: false}));
            setIsLoading(true); setLoadingText('Signing out...');
            await supabase.auth.signOut();
            setTimeout(() => { setIsLoading(false); router.replace('/'); }, 800);
        },
        onCancel: () => setAlertConfig((p:any) => ({...p, visible: false})),
        onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false}))
    });
  };

  const LinkItem = ({ icon: Icon, label, route, iconColor }: any) => (
    <TouchableOpacity 
      onPress={() => router.push(route)} 
      style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <HugeiconsIcon icon={Icon} size={20} color={iconColor || theme.colors.primary} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>{label}</Text>
      </View>
      <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.border} />
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={{ marginBottom: 12, marginLeft: 4, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.textSecondary }}>{title}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <LoadingOverlay visible={isLoading} message={loadingText} />
      <ModernAlert {...alertConfig} />

      <Header title="Settings" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        
        {/* Account & Security */}
        <View style={{ paddingBottom: 24 }}>
            <SectionTitle title="Account & Security" />
            <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
                <LinkItem icon={Notification03Icon} label="Notifications" route="/settings/notifications" />
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16 }} />
                <LinkItem icon={Shield01Icon} label="Account Security" route="/settings/account-security" />
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16 }} />
                <LinkItem icon={FileValidationIcon} label="Privacy Policy" route="/settings/privacy-policy" iconColor={theme.colors.accent} />
            </View>
        </View>

        {/* Preferences */}
        <View style={{ paddingBottom: 24 }}>
            <SectionTitle title="Preferences" />
            <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
                {/* Dark Mode */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                            <HugeiconsIcon icon={Moon02Icon} size={20} color={theme.colors.primary} />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>Dark Mode</Text>
                    </View>
                    <Switch value={colorScheme === 'dark'} onValueChange={toggleColorScheme} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor="#fff"/>
                </View>
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16 }} />
                {/* Sound */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                            <HugeiconsIcon icon={VolumeHighIcon} size={20} color={theme.colors.warning} />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>Sound Effects</Text>
                    </View>
                    <Switch value={settings.soundEnabled} onValueChange={(val) => saveSetting('soundEnabled', val)} trackColor={{ false: theme.colors.border, true: theme.colors.warning }} thumbColor="#fff"/>
                </View>
            </View>
        </View>

        {/* Support */}
        <View>
          <SectionTitle title="Support" />
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:dart.vdb@gmail.com')} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                 <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <HugeiconsIcon icon={Mail01Icon} size={20} color="#3b82f6" />
                 </View>
                 <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>Contact Support</Text>
               </View>
               <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.border} />
            </TouchableOpacity>
            
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16 }} />
            
            <TouchableOpacity style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                 <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <HugeiconsIcon icon={Download02Icon} size={20} color={theme.colors.icon} />
                 </View>
                 <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
               </View>
               <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.colors.iconBg }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.textSecondary }}>UP TO DATE</Text>
               </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={handleSignOut} 
            style={{ 
                marginTop: 32, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: 16, 
                borderWidth: 1, 
                borderColor: theme.colors.dangerSoft, 
                backgroundColor: theme.colors.danger + '10', 
                borderRadius: 20 
            }}
          >
             <HugeiconsIcon icon={Logout02Icon} size={20} color={theme.colors.danger} />
             <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: theme.colors.danger }}>Sign Out</Text>
          </TouchableOpacity>
          
          {/* Universal Footer */}
          <Footer>
             <View style={{ alignItems: 'center' }}>
                <TouchableOpacity onPress={() => Linking.openURL('https://www.projectvdb.com')}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary }}>
                        Developed by <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Project Vdb</Text>
                    </Text>
                </TouchableOpacity>
                <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary }}>
                    © {new Date().getFullYear()} DART. All rights reserved.
                </Text>
             </View>
          </Footer>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}