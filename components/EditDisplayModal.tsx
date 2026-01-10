import {
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppTheme } from '../constants/theme';

export const AVAILABLE_JOB_FIELDS = [
  { key: 'employment_status', label: 'Employment Status' },
  { key: 'shift', label: 'Shift Schedule' },
  { key: 'rate', label: 'Pay Rate' },
  { key: 'rate_type', label: 'Pay Type' },
  { key: 'payroll', label: 'Payroll Schedule' },
  { key: 'breaks', label: 'Unpaid Breaks' },
];

interface EditDisplayModalProps {
  visible: boolean;
  onClose: () => void;
  selectedKeys: string[];
  onSave: (keys: string[]) => void;
}

export default function EditDisplayModal({
  visible,
  onClose,
  selectedKeys,
  onSave,
}: EditDisplayModalProps) {
  const theme = useAppTheme();
  const [currentSelection, setCurrentSelection] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setCurrentSelection(selectedKeys || []);
    }
  }, [visible, selectedKeys]);

  const toggleField = (key: string) => {
    if (currentSelection.includes(key)) {
      setCurrentSelection(currentSelection.filter(k => k !== key));
    } else {
      setCurrentSelection([...currentSelection, key]);
    }
  };

  const handleDone = () => {
    // Sort based on the defined order in AVAILABLE_JOB_FIELDS
    const sortedSelection = AVAILABLE_JOB_FIELDS
      .filter(field => currentSelection.includes(field.key))
      .map(field => field.key);
      
    onSave(sortedSelection);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: 24,
            overflow: 'hidden',
            maxHeight: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }}
          onPress={() => {}}
        >
          {/* Header */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' }}>
              Edit Profile Display
            </Text>
          </View>

          <ScrollView style={{ paddingVertical: 8 }}>
            {AVAILABLE_JOB_FIELDS.map((field) => {
              const isSelected = currentSelection.includes(field.key);
              return (
                <TouchableOpacity
                  key={field.key}
                  onPress={() => toggleField(field.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    paddingHorizontal: 24,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border + '30'
                  }}
                >
                  {/* Label (Left) */}
                  <Text style={{ fontSize: 16, fontWeight: isSelected ? '700' : '500', color: theme.colors.text }}>
                    {field.label}
                  </Text>

                  {/* Checkmark (Right) */}
                  <View style={{ width: 24, alignItems: 'flex-end' }}>
                    {isSelected && (
                      <HugeiconsIcon icon={Tick02Icon} size={20} color={theme.colors.primary} strokeWidth={3} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            <TouchableOpacity 
              onPress={handleDone} 
              style={{ 
                width: '100%', 
                padding: 16, 
                backgroundColor: theme.colors.primary, 
                borderRadius: 16, 
                alignItems: 'center', 
                justifyContent: 'center',
                shadowColor: theme.colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}