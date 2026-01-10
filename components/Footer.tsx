import React from 'react';
import { KeyboardAvoidingView, Platform, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Footer({ children, style }: FooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={{ 
        borderTopWidth: 1, 
        borderTopColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'transparent'
      }}
    >
      <View 
        style={[
          { 
            paddingHorizontal: 24, 
            paddingTop: 16, 
            paddingBottom: Math.max(insets.bottom, 20),
            backgroundColor: 'transparent' // Or theme color if passed
          }, 
          style
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}