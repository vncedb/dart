import {
    Alert01Icon,
    CheckmarkCircle02Icon,
    InformationCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

type AlertType = 'success' | 'error' | 'confirm';

interface ModernAlertProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ModernAlert({ 
  visible, 
  type, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "OK",
  cancelText = "Cancel"
}: ModernAlertProps) {
  
  const getIcon = () => {
    switch (type) {
      case 'success': return <HugeiconsIcon icon={CheckmarkCircle02Icon} size={48} color="#22c55e" />;
      case 'error': return <HugeiconsIcon icon={Alert01Icon} size={48} color="#ef4444" />;
      case 'confirm': return <HugeiconsIcon icon={InformationCircleIcon} size={48} color="#6366f1" />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel || onConfirm}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={onCancel}>
        <View className="items-center w-full max-w-sm p-6 scale-100 bg-white shadow-2xl dark:bg-slate-800 rounded-3xl">
          
          <View className={`mb-4 p-4 rounded-full ${type === 'success' ? 'bg-green-100 dark:bg-green-900/30' : type === 'error' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
            {getIcon()}
          </View>

          <Text className="mb-2 text-xl font-bold text-center text-slate-900 dark:text-white">{title}</Text>
          <Text className="mb-6 leading-5 text-center text-slate-500 dark:text-slate-400">{message}</Text>

          <View className="flex-row w-full gap-3">
            {onCancel && (
              <TouchableOpacity 
                onPress={onCancel}
                className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
              >
                <Text className="font-bold text-center text-slate-600 dark:text-slate-300">{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={onConfirm}
              className={`flex-1 py-3.5 rounded-xl ${type === 'error' ? 'bg-red-500' : 'bg-indigo-600'}`}
            >
              <Text className="font-bold text-center text-white">{confirmText}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Pressable>
    </Modal>
  );
}