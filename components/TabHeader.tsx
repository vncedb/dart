import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface TabHeaderProps {
  title: string;
  rightIcon?: any; // Icon component
  onRightPress?: () => void;
  rightElement?: React.ReactNode; // For custom elements like "1 Selected"
  subtitle?: string | React.ReactNode;
}

export default function TabHeader({ 
  title, 
  rightIcon, 
  onRightPress, 
  rightElement,
  subtitle 
}: TabHeaderProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
      <View>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle && (
          <View style={{ marginTop: 4 }}>
            {typeof subtitle === 'string' ? (
               <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{subtitle}</Text>
            ) : subtitle}
          </View>
        )}
      </View>

      {/* Right Action Area */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {rightElement}
        
        {rightIcon && onRightPress && (
          <TouchableOpacity 
            onPress={onRightPress} 
            style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            <HugeiconsIcon icon={rightIcon} size={22} color={theme.colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconButton: {
    padding: 10,
    borderRadius: 99,
    borderWidth: 1,
    marginLeft: 12
  },
});