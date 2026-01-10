import {
    Camera01Icon,
    Location01Icon,
    Mail01Icon,
    Notification03Icon,
    Settings02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header'; // Universal Header

export default function NotificationPermissionScreen() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => { checkPermissions(); }, []);

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPushEnabled(status === 'granted');
  };

  const togglePushNotifications = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      setPushEnabled(status === 'granted');
      if (status !== 'granted') Alert.alert("Permission Required", "Please enable notifications in settings.", [{ text: "Settings", onPress: () => Linking.openSettings() }]);
    } else {
      setPushEnabled(false);
    }
  };

  const SettingRow = ({ icon, title, subtitle, value, onValueChange, last }: any) => (
    <View className={`flex-row items-center justify-between p-4 bg-white dark:bg-slate-800 ${!last ? 'border-b border-slate-100 dark:border-slate-700/50' : ''}`}>
        <View className="flex-row items-center flex-1 gap-3 pr-2">
            <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700"><HugeiconsIcon icon={icon} size={20} color="#6366f1" /></View>
            <View className="flex-1"><Text className="text-base font-bold text-slate-900 dark:text-white">{title}</Text>{subtitle && <Text className="text-xs font-medium text-slate-400">{subtitle}</Text>}</View>
        </View>
        <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#cbd5e1', true: '#6366f1' }} thumbColor={'#ffffff'} />
    </View>
  );

  const PermissionRow = ({ icon, title, subtitle, last }: any) => (
    <TouchableOpacity onPress={() => Linking.openSettings()} className={`flex-row items-center justify-between p-4 bg-white dark:bg-slate-800 ${!last ? 'border-b border-slate-100 dark:border-slate-700/50' : ''}`}>
        <View className="flex-row items-center flex-1 gap-3 pr-2">
            <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700"><HugeiconsIcon icon={icon} size={20} color="#64748b" /></View>
            <View className="flex-1"><Text className="text-base font-bold text-slate-900 dark:text-white">{title}</Text><Text className="text-xs font-medium text-slate-400">{subtitle}</Text></View>
        </View>
        <Text className="text-sm font-bold text-slate-400">Manage</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
      <Header title="Notifications" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6">
            <Text className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">App Notifications</Text>
            <View className="overflow-hidden bg-white border shadow-sm dark:bg-slate-800 rounded-3xl border-slate-100 dark:border-slate-700/50">
                <SettingRow icon={Notification03Icon} title="Push Notifications" subtitle="Receive alerts" value={pushEnabled} onValueChange={togglePushNotifications} />
                <SettingRow icon={Mail01Icon} title="Email Notifications" subtitle="Receive summaries" value={emailEnabled} onValueChange={setEmailEnabled} last />
            </View>
        </View>
        <View className="mb-6">
            <Text className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">System Permissions</Text>
            <View className="overflow-hidden bg-white border shadow-sm dark:bg-slate-800 rounded-3xl border-slate-100 dark:border-slate-700/50">
                <PermissionRow icon={Camera01Icon} title="Camera Access" subtitle="For scanning QR codes" />
                <PermissionRow icon={Location01Icon} title="Location Services" subtitle="For geotagging reports" />
                <PermissionRow icon={Settings02Icon} title="System Settings" subtitle="Manage other permissions" last />
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}