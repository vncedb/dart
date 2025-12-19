import { Calendar03Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';

interface DateTimeInputProps {
  type: 'date' | 'time';
  value: Date | string; 
  onChange: (value: string) => void;
  label?: string;
  onPress?: () => void; // <--- NEW PROP
}

export default function DateTimeInput({ type, value, onChange, label, onPress }: DateTimeInputProps) {
  const [show, setShow] = useState(false);

  const getDateObj = () => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value.includes(':')) {
      const [h, m] = value.split(':');
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m));
      return d;
    }
    return new Date();
  };

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      if (type === 'time') {
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        onChange(`${hours}:${minutes}`);
      } else {
        onChange(selectedDate.toISOString().split('T')[0]);
      }
    }
  };

  const getDisplayText = () => {
    if (typeof value === 'string') return value;
    if (type === 'time') return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return value.toLocaleDateString();
  };

  // If onPress is provided, use it (Analog Clock). Otherwise, show system picker.
  const handlePress = () => {
    if (onPress) {
        onPress();
    } else {
        setShow(true);
    }
  };

  return (
    <View className="flex-1">
      <TouchableOpacity 
        onPress={handlePress}
        className="flex-row items-center gap-2 p-4 bg-white border dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700"
      >
        <HugeiconsIcon icon={type === 'time' ? Clock01Icon : Calendar03Icon} size={20} color="#94a3b8" />
        <Text className="flex-1 font-bold text-slate-900 dark:text-white">
          {getDisplayText()}
        </Text>
      </TouchableOpacity>

      {/* Only render system picker if NO custom onPress is provided */}
      {show && !onPress && Platform.OS === 'android' && (
        <DateTimePicker value={getDateObj()} mode={type} display="default" onChange={handleChange} />
      )}

      {show && !onPress && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <View className="justify-end flex-1 bg-black/40">
            <View className="p-4 bg-white dark:bg-slate-900 rounded-t-3xl">
              <View className="flex-row justify-between mb-4">
                <Text className="font-bold text-slate-400">Select {label}</Text>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text className="text-lg font-bold text-indigo-600">Done</Text>
                </TouchableOpacity>
              </View>
              <View className="items-center">
                <DateTimePicker value={getDateObj()} mode={type} display="spinner" onChange={handleChange} textColor={Platform.OS === 'ios' ? '#6366f1' : undefined} />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}