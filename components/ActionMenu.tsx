import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActionItem {
  label: string;
  icon: any;
  onPress: () => void;
  color?: string; // Optional custom color (e.g., red for delete)
}

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  actions: ActionItem[];
  position?: { top?: number; right?: number; left?: number; bottom?: number }; // Custom positioning
}

export default function ActionMenu({ visible, onClose, actions, position = { top: 50, right: 24 } }: ActionMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Invisible backdrop to catch clicks outside */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View className="flex-1 bg-black/10">
          <View 
            style={[
              { position: 'absolute', width: 200, borderRadius: 16, overflow: 'hidden' }, 
              position
            ]}
            className="bg-white border shadow-2xl dark:bg-slate-800 border-slate-100 dark:border-slate-700"
          >
            {actions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => { onClose(); action.onPress(); }}
                className={`flex-row items-center p-4 active:bg-slate-50 dark:active:bg-slate-700/50 ${index < actions.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}
              >
                <HugeiconsIcon icon={action.icon} size={20} color={action.color || "#64748b"} />
                <Text 
                  style={{ color: action.color }} 
                  className={`ml-3 font-bold text-slate-700 dark:text-white ${action.color ? '' : ''}`}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}