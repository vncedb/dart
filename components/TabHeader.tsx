import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';
import { Typography } from '../constants/typography';

interface TabHeaderProps {
  title: string;
  rightIcon?: any; // Legacy prop support
  onRightPress?: () => void; // Legacy prop support
  rightElement?: React.ReactNode; 
  leftElement?: React.ReactNode; // NEW: Supports Close button or Back button
  subtitle?: string | React.ReactNode;
}

export default function TabHeader({ 
  title, 
  rightIcon, 
  onRightPress, 
  rightElement,
  leftElement,
  subtitle 
}: TabHeaderProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        {/* Left Element (e.g., Close Icon) */}
        {leftElement && (
            <View style={{ marginRight: -4 }}>
                {leftElement}
            </View>
        )}

        <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {title}
            </Text>
            {subtitle && (
            <View style={{ marginTop: 4 }}>
                {typeof subtitle === 'string' ? (
                <Text style={[Typography.caption, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
                ) : subtitle}
            </View>
            )}
        </View>
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
    minHeight: 80, // Ensure consistent height with Profile
  },
  headerTitle: {
    ...Typography.h1,
  },
  iconButton: {
    padding: 10,
    borderRadius: 99,
    borderWidth: 1,
    marginLeft: 12
  },
});