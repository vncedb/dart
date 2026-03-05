// filepath: components/ModernAlert.tsx
import {
  Alert01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

type AlertType = 'success' | 'error' | 'confirm' | 'info' | 'warning';

interface ModernAlertProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  onDismiss?: () => void;
}

export default function ModernAlert({ 
  visible, 
  type, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  onDismiss,
  confirmText = "Okay",
  cancelText = "Cancel"
}: ModernAlertProps) {
  
  const theme = useAppTheme();

  const handleDismiss = () => {
      if (onDismiss) onDismiss();
      else if (onCancel) onCancel();
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return <HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} color={theme.colors.success} strokeWidth={2.5} />;
      case 'error': return <HugeiconsIcon icon={Alert01Icon} size={28} color={theme.colors.danger} strokeWidth={2.5} />;
      case 'confirm': return <HugeiconsIcon icon={InformationCircleIcon} size={28} color={theme.colors.primary} strokeWidth={2.5} />;
      case 'info': return <HugeiconsIcon icon={InformationCircleIcon} size={28} color={theme.colors.icon} strokeWidth={2.5} />;
      case 'warning': return <HugeiconsIcon icon={Alert01Icon} size={28} color={theme.colors.warning} strokeWidth={2.5} />; 
      default: return <HugeiconsIcon icon={InformationCircleIcon} size={28} color={theme.colors.primary} strokeWidth={2.5} />;
    }
  };

  const getBgColor = () => {
      switch (type) {
          case 'success': return theme.colors.successLight || `${theme.colors.success}30`;
          case 'error': return theme.colors.dangerLight || `${theme.colors.danger}30`;
          case 'warning': return theme.colors.warning + '30';
          default: return theme.colors.primaryLight || `${theme.colors.primary}30`;
      }
  };

  const getButtonColor = () => {
      if (type === 'error') return theme.colors.danger;
      if (type === 'success') return theme.colors.success;
      if (type === 'warning') return theme.colors.warning; 
      return theme.colors.primary;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} onPress={handleDismiss}>
        <View style={{ backgroundColor: theme.colors.card, shadowColor: "#000", shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 }} className="relative items-center w-full max-w-sm p-6 rounded-[24px]">

          <View style={{ backgroundColor: getBgColor() }} className="items-center justify-center mb-5 rounded-full w-14 h-14">
            {getIcon()}
          </View>

          <Text style={{ color: theme.colors.text }} className="mb-2 font-sans text-xl font-bold text-center">{title}</Text>
          <Text style={{ color: theme.colors.textSecondary }} className="mb-8 font-sans text-sm leading-5 text-center">{message}</Text>

          <View className="flex-row w-full gap-3">
            {onCancel && (
              <TouchableOpacity 
                onPress={onCancel}
                style={{ backgroundColor: theme.colors.border + '50' }} // Light transparent background for cancel
                className="items-center flex-1 py-3.5 rounded-2xl"
              >
                <Text style={{ color: theme.colors.text }} className="font-sans font-bold text-center">{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={onConfirm || handleDismiss}
              style={{ backgroundColor: getButtonColor() }}
              className="items-center flex-1 py-3.5 shadow-sm rounded-2xl"
            >
              <Text className="font-sans font-bold text-center text-white">{confirmText}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Pressable>
    </Modal>
  );
}