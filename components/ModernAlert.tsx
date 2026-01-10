import {
  Alert01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

type AlertType = 'success' | 'error' | 'confirm' | 'info';

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
  confirmText = "OK",
  cancelText = "Cancel"
}: ModernAlertProps) {
  
  const theme = useAppTheme();

  const handleDismiss = () => {
      if (onDismiss) onDismiss();
      else if (onCancel) onCancel();
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return <HugeiconsIcon icon={CheckmarkCircle02Icon} size={48} color={theme.colors.success} />;
      case 'error': return <HugeiconsIcon icon={Alert01Icon} size={48} color={theme.colors.danger} />;
      case 'confirm': return <HugeiconsIcon icon={InformationCircleIcon} size={48} color={theme.colors.primary} />;
      case 'info': return <HugeiconsIcon icon={InformationCircleIcon} size={48} color={theme.colors.icon} />;
      default: return <HugeiconsIcon icon={InformationCircleIcon} size={48} color={theme.colors.primary} />;
    }
  };

  const getBgColor = () => {
      switch (type) {
          case 'success': return theme.colors.successLight;
          case 'error': return theme.colors.dangerLight;
          default: return theme.colors.primaryLight;
      }
  };

  const getButtonColor = () => {
      if (type === 'error') return theme.colors.danger;
      if (type === 'success') return theme.colors.success;
      return theme.colors.primary;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={handleDismiss}>
        <View style={{ backgroundColor: theme.colors.card, shadowColor: "#000", shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 }} className="items-center w-full max-w-sm p-6 scale-100 rounded-3xl">
          
          <View style={{ backgroundColor: getBgColor() }} className="p-4 mb-4 rounded-full">
            {getIcon()}
          </View>

          <Text style={{ color: theme.colors.text }} className="mb-2 text-xl font-bold text-center">{title}</Text>
          <Text style={{ color: theme.colors.textSecondary }} className="mb-6 leading-5 text-center">{message}</Text>

          <View className="flex-row w-full gap-3">
            {onCancel && (
              <TouchableOpacity 
                onPress={onCancel}
                style={{ borderColor: theme.colors.border }}
                className="flex-1 py-3.5 rounded-xl border bg-transparent"
              >
                <Text style={{ color: theme.colors.textSecondary }} className="font-bold text-center">{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={onConfirm || handleDismiss}
              style={{ backgroundColor: getButtonColor() }}
              className="flex-1 py-3.5 rounded-xl"
            >
              <Text className="font-bold text-center text-white">{confirmText}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Pressable>
    </Modal>
  );
}