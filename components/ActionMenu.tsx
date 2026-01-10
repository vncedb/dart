import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface ActionItem {
  label: string;
  icon: any;
  onPress: () => void;
  color?: string; 
}

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  actions: ActionItem[];
  position?: { top?: number; right?: number; left?: number; bottom?: number };
}

export default function ActionMenu({ visible, onClose, actions, position = { top: 50, right: 24 } }: ActionMenuProps) {
  const theme = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        {/* Semi-transparent backdrop for better focus */}
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <View 
            style={[
              { 
                position: 'absolute', 
                width: 220, 
                borderRadius: 16, 
                overflow: 'hidden',
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderWidth: 1,
                // Shadow
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 10,
              }, 
              position
            ]}
          >
            {actions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => { onClose(); action.onPress(); }}
                style={{ 
                    borderBottomWidth: index < actions.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start', // Align content to the left
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                }}
                activeOpacity={0.7}
              >
                {/* Icon on the Left */}
                <HugeiconsIcon icon={action.icon} size={20} color={action.color || theme.colors.icon} />

                {/* Label on the Right (with margin) */}
                <Text 
                  style={{ 
                      color: action.color || theme.colors.text,
                      fontSize: 15,
                      fontWeight: '600',
                      marginLeft: 12 
                  }}
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