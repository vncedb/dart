import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export default function Header({ title, onBack, rightElement }: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View className="z-10 flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
      <TouchableOpacity 
        onPress={handleBack} 
        className="p-2 -ml-2 rounded-full active:bg-slate-100 dark:active:bg-slate-800"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
      </TouchableOpacity>

      <Text 
        className="flex-1 mx-4 font-sans text-xl font-bold text-center text-slate-900 dark:text-white" 
        numberOfLines={1} 
        ellipsizeMode="tail"
      >
        {title}
      </Text>

      <View className="items-end justify-center w-10">
        {rightElement || <View style={{ width: 24 }} />}
      </View>
    </View>
  );
}