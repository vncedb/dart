import {
  Alert02Icon,
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

// --- Types ---
export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirmation';

interface ModernAlertProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDismiss: () => void;
}

// --- Unified Configuration ---
const ALERT_CONFIG = {
    success: {
        icon: CheckmarkCircle02Icon,
        color: '#22c55e', // Green-500
        bg: 'bg-green-100 dark:bg-green-900/30',
        btnBg: 'bg-green-600'
    },
    error: {
        icon: AlertCircleIcon,
        color: '#ef4444', // Red-500
        bg: 'bg-red-100 dark:bg-red-900/30',
        btnBg: 'bg-red-600'
    },
    warning: {
        icon: Alert02Icon,
        color: '#f59e0b', // Amber-500
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        btnBg: 'bg-amber-500'
    },
    info: {
        icon: InformationCircleIcon,
        color: '#3b82f6', // Blue-500
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        btnBg: 'bg-blue-600'
    },
    confirmation: {
        icon: InformationCircleIcon,
        color: '#6366f1', // Indigo-500
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        btnBg: 'bg-indigo-600'
    }
};

export function ModernAlert({ 
  visible, 
  type, 
  title, 
  message, 
  confirmText, 
  cancelText,
  onConfirm, 
  onCancel, 
  onDismiss 
}: ModernAlertProps) {
  if (!visible) return null;

  // Fallback to info if type is somehow invalid
  const config = ALERT_CONFIG[type] || ALERT_CONFIG.info;
  const { icon: Icon, color, bg, btnBg } = config;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <View className="items-center justify-center flex-1 px-6 bg-black/60">
        <View className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[24px] p-6 shadow-2xl items-center relative">
          
          {/* Close X Button */}
          <TouchableOpacity 
            onPress={onDismiss}
            className="absolute p-2 rounded-full top-4 right-4 bg-slate-50 dark:bg-slate-700/50"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} color="#94a3b8" />
          </TouchableOpacity>

          {/* Icon Circle */}
          <View className={`w-14 h-14 ${bg} rounded-full items-center justify-center mb-5`}>
            <HugeiconsIcon icon={Icon} size={28} color={color} strokeWidth={2.5} variant="solid" />
          </View>
          
          {/* Text Content */}
          <Text className="mb-2 font-sans text-xl font-bold text-center text-slate-900 dark:text-white">
            {title}
          </Text>
          <Text className="mb-8 font-sans text-sm leading-5 text-center text-slate-500 dark:text-slate-400">
            {message}
          </Text>

          {/* Buttons */}
          <View className="flex-row w-full gap-3">
            {(type === 'confirmation' || type === 'warning' || onCancel) && (
              <TouchableOpacity 
                onPress={onCancel || onDismiss}
                className="items-center flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 rounded-2xl"
              >
                <Text className="font-sans font-bold text-slate-600 dark:text-slate-300">
                    {cancelText || "Cancel"}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={onConfirm || onDismiss}
              className={`flex-1 py-3.5 rounded-2xl items-center shadow-sm ${btnBg}`}
            >
              <Text className="font-sans font-bold text-white">
                {confirmText || "Okay"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- ADDED: ModernToast Component ---
export function ModernToast({ visible, message, type = 'success' }: { visible: boolean, message: string, type?: AlertType }) {
  if (!visible) return null;
  
  const config = ALERT_CONFIG[type] || ALERT_CONFIG.info;
  const { icon: Icon, bg, color } = config;

  return (
    <View className="absolute z-50 self-center w-full max-w-sm px-4 top-14">
        <View className={`flex-row items-center px-4 py-3 shadow-xl rounded-2xl ${bg} border border-white/10 dark:border-black/10`}>
            <HugeiconsIcon icon={Icon} size={20} color={color} variant="solid" />
            <Text className="ml-3 font-sans text-sm font-bold text-slate-900 dark:text-slate-100">
                {message}
            </Text>
        </View>
    </View>
  );
}

// --- Input Error ---
export function InputError({ message }: { message?: string }) {
  return (
    <View className={`flex-row items-center mt-1 ml-1 h-5 ${!message ? 'opacity-0' : 'opacity-100'}`}>
      <HugeiconsIcon icon={AlertCircleIcon} size={14} color="#ef4444" />
      <Text className="ml-1 font-sans text-xs font-medium text-red-500">{message || "Placeholder"}</Text>
    </View>
  );
}