import {
  ArrowRight01Icon,
  BiometricAccessIcon,
  Delete02Icon,
  InformationCircleIcon,
  Logout03Icon,
  Mail01Icon,
  Moon02Icon,
  Notification01Icon,
  PaintBoardIcon,
  SecurityLockIcon,
  SmartPhone02Icon,
  Sun03Icon,
  Tick02Icon,
  UserCircleIcon,
  VolumeHighIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

// Theme Options
type ThemeOption = 'system' | 'light' | 'dark';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, signOut } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [themePreference, setThemePreference] = useState<ThemeOption>('system');
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const isGuest = user?.is_guest;
  const isMounted = useRef(true);

  // Load just the Toggle states on mount
  // Theme state is now handled globally, we just sync the UI here
  useEffect(() => {
    isMounted.current = true;
    const loadToggles = async () => {
        try {
          const storedSettings = await AsyncStorage.getItem('appSettings');
          if (storedSettings && isMounted.current) {
            const parsed = JSON.parse(storedSettings);
            if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
            if (parsed.biometricEnabled !== undefined) setBiometricEnabled(parsed.biometricEnabled);
            if (parsed.themePreference) setThemePreference(parsed.themePreference);
          }
        } catch (e) {
          console.error("Failed to load settings", e);
        }
    };
    loadToggles();
    return () => { isMounted.current = false; };
  }, []);

  const saveSetting = async (key: string, value: any) => {
    try {
      const stored = await AsyncStorage.getItem('appSettings');
      const settings = stored ? JSON.parse(stored) : {};
      settings[key] = value;
      await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  };

  // --- ACTIONS ---

  const handleThemeChange = (newTheme: ThemeOption) => {
    // 1. Update UI immediately
    setThemePreference(newTheme);
    setThemeModalVisible(false);
    
    // 2. Persist
    saveSetting('themePreference', newTheme);
    
    // 3. Apply
    if (setColorScheme) {
        // NativeWind handles the transition
        setColorScheme(newTheme);
    }
  };

  const toggleSound = (val: boolean) => {
    setSoundEnabled(val);
    saveSetting('soundEnabled', val);
  };

  const toggleBiometric = (val: boolean) => {
    setBiometricEnabled(val);
    saveSetting('biometricEnabled', val);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@projectvdb.com?subject=DART Support Request');
  };

  const handleClearCache = async () => {
    setAlertConfig({
      visible: true,
      type: 'confirm',
      title: 'Clear Cache',
      message: 'This will free up space by deleting temporary files. Your reports and data will be safe.',
      confirmText: 'Clear Cache',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        setIsLoading(true);
        setLoadingMessage('Cleaning up...');
        try {
            // Safe Access for TypeScript
            const fs = FileSystem as any;
            const cacheDir = fs.cacheDirectory;
            
            if (cacheDir) {
                await fs.deleteAsync(cacheDir, { idempotent: true });
            }
            
            if (isMounted.current) {
                setTimeout(() => {
                    if (!isMounted.current) return;
                    setIsLoading(false);
                    setAlertConfig({
                        visible: true,
                        type: 'success',
                        title: 'Success',
                        message: 'Cache cleared successfully.',
                        onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
                    });
                }, 1000);
            }
        } catch (e) {
            console.error(e);
            if (isMounted.current) setIsLoading(false);
        }
      },
      onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
    });
  };

  const handleSignOut = () => {
    setAlertConfig({
      visible: true,
      type: 'confirm',
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        await signOut();
      },
      onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
    });
  };

  // --- COMPONENTS ---

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
      {title}
    </Text>
  );

  const SettingItem = ({ 
    icon, 
    label, 
    subLabel,
    onPress, 
    rightElement, 
    destructive 
  }: any) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.itemContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: destructive ? '#FEE2E2' : theme.colors.background }]}>
        <HugeiconsIcon 
            icon={icon} 
            size={22} 
            color={destructive ? '#EF4444' : theme.colors.text} 
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.itemLabel, { color: destructive ? '#EF4444' : theme.colors.text }]}>
            {label}
        </Text>
        {subLabel && <Text style={[styles.itemSubLabel, { color: theme.colors.textSecondary }]}>{subLabel}</Text>}
      </View>
      <View>
        {rightElement || (onPress && (
            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.textSecondary} />
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      {/* Dynamic Status Bar based on current scheme */}
      <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={isLoading} message={loadingMessage} />
      
      <Header title="Settings" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        
        {/* --- TOP SECTION: PROFILE / SIGN IN --- */}
        {isGuest ? (
            <TouchableOpacity 
                onPress={() => router.push('/auth')}
                activeOpacity={0.9}
                style={[styles.guestCard, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
            >
                <View style={styles.guestContent}>
                    <View style={styles.guestIconCircle}>
                        <HugeiconsIcon icon={UserCircleIcon} size={32} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.guestTitle}>Sign In / Create Account</Text>
                        <Text style={styles.guestSubtitle}>Sync your data and access it anywhere.</Text>
                    </View>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="#fff" />
                </View>
            </TouchableOpacity>
        ) : (
            <View style={[styles.profileCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={[styles.avatarCircle, { backgroundColor: theme.colors.primary + '20' }]}>
                    {user?.user_metadata?.avatar_url ? (
                        <HugeiconsIcon icon={UserCircleIcon} size={28} color={theme.colors.primary} />
                    ) : (
                        <HugeiconsIcon icon={UserCircleIcon} size={28} color={theme.colors.primary} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.profileName, { color: theme.colors.text }]}>
                        {user?.email || 'User'}
                    </Text>
                    <Text style={[styles.profileStatus, { color: theme.colors.success }]}>
                        ● Signed In
                    </Text>
                </View>
            </View>
        )}

        {/* --- PREFERENCES --- */}
        <SectionHeader title="PREFERENCES" />
        
        <SettingItem 
            icon={Notification01Icon}
            label="Notifications"
            onPress={() => router.push('/settings/notifications')}
        />
        
        <SettingItem 
            icon={PaintBoardIcon}
            label="Appearance"
            subLabel={themePreference === 'system' ? 'System Default' : (themePreference === 'dark' ? 'Dark Mode' : 'Light Mode')}
            onPress={() => setThemeModalVisible(true)}
        />
        
        <SettingItem 
            icon={VolumeHighIcon}
            label="Sound Effects"
            rightElement={
                <Switch 
                    value={soundEnabled} 
                    onValueChange={toggleSound}
                    trackColor={{ false: '#767577', true: theme.colors.primary }}
                    thumbColor={'#fff'}
                />
            }
        />

        {/* --- ACCOUNT & SECURITY --- */}
        <SectionHeader title="ACCOUNT & SECURITY" />
        
        <SettingItem 
            icon={BiometricAccessIcon}
            label="Biometrics"
            subLabel="Require FaceID/TouchID to open"
            rightElement={
                <Switch 
                    value={biometricEnabled} 
                    onValueChange={toggleBiometric}
                    trackColor={{ false: '#767577', true: theme.colors.primary }}
                    thumbColor={'#fff'}
                />
            }
        />

        {!isGuest && (
            <SettingItem 
                icon={SecurityLockIcon} 
                label="Account & Security"
                onPress={() => router.push('/settings/account-security')}
            />
        )}

        {/* --- DATA & SUPPORT --- */}
        <SectionHeader title="DATA & SUPPORT" />
        
        <SettingItem 
            icon={InformationCircleIcon} 
            label="Privacy Policy"
            onPress={() => router.push('/settings/privacy-policy')}
        />
        
        <SettingItem 
            icon={Mail01Icon}
            label="Contact Support"
            onPress={handleContactSupport}
        />
        
        <SettingItem 
            icon={Delete02Icon}
            label="Clear Cache"
            onPress={handleClearCache}
        />

        {/* --- SIGN OUT --- */}
        {!isGuest && (
            <View style={{ marginTop: 24 }}>
                <TouchableOpacity 
                    onPress={handleSignOut}
                    style={[styles.signOutButton, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                >
                    <HugeiconsIcon icon={Logout03Icon} size={20} color="#EF4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* --- FOOTER --- */}
        <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                Developed by Project Vdb
            </Text>
            <Text style={[styles.footerSubText, { color: theme.colors.textSecondary }]}>
                DART v1.0.0
            </Text>
        </View>

      </ScrollView>

      {/* --- THEME MODAL --- */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setThemeModalVisible(false)}
        >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Choose Appearance</Text>
                
                {[
                    { key: 'system', label: 'System Default', icon: SmartPhone02Icon },
                    { key: 'light', label: 'Light Mode', icon: Sun03Icon },
                    { key: 'dark', label: 'Dark Mode', icon: Moon02Icon },
                ].map((opt) => (
                    <TouchableOpacity
                        key={opt.key}
                        style={[
                            styles.modalOption, 
                            themePreference === opt.key && { backgroundColor: theme.colors.primary + '10' }
                        ]}
                        onPress={() => handleThemeChange(opt.key as ThemeOption)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <HugeiconsIcon 
                                icon={opt.icon} 
                                size={22} 
                                color={theme.colors.text} 
                            />
                            <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>{opt.label}</Text>
                        </View>
                        {themePreference === opt.key && (
                            <HugeiconsIcon icon={Tick02Icon} size={20} color={theme.colors.primary} />
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSubLabel: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  guestCard: {
    borderRadius: 20,
    padding: 4,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  guestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  guestIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  guestSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 48, 
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  profileStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 48,
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerSubText: {
    fontSize: 12,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});