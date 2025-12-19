import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

interface OtpVerificationModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean | void>;
  onResend: () => Promise<void>;
  title?: string;
  message?: string;
}

export default function OtpVerificationModal({ 
  visible, 
  email, 
  onClose, 
  onVerify, 
  onResend, 
  title = "Verify Account",
  message = "Enter the code sent to"
}: OtpVerificationModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isError, setIsError] = useState(false);
  
  const inputRef = useRef<TextInput>(null);
  const offset = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  useEffect(() => {
    if (visible) {
      setCode('');
      setLoading(false);
      setTimer(60);
      setCanResend(false);
      setIsError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    let interval: any;
    if (visible && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [visible, timer]);

  useEffect(() => {
    if (isError) {
      offset.value = withSequence(
        withTiming(-10, { duration: 50 }), 
        withRepeat(withTiming(10, { duration: 100 }), 3, true), 
        withTiming(0, { duration: 50 })
      );
    }
  }, [isError]);

  const handleVerifyPress = async () => {
    if (code.length < 6) { setIsError(true); return; }
    setLoading(true);
    setIsError(false);
    
    try {
      const result = await onVerify(code);
      if (result === false) setIsError(true);
    } catch (e) {
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResendPress = async () => {
    setCanResend(false);
    setTimer(60);
    await onResend();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 bg-black/60">
        
        {/* CHANGED: Replaced Pressable with View. 
            This spacer takes up the top space but does NOT trigger onClose when clicked. */}
        <View style={{ flex: 1 }} />
        
        <View className="mx-6 bg-white shadow-2xl dark:bg-slate-800 rounded-3xl">
          <View className="flex-row items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
             <View className="w-8" />
             <Text className="text-lg font-bold text-center text-slate-900 dark:text-white">{title}</Text>
             
             {/* The Close Button remains active - this is now the ONLY way to close (besides hardware back button) */}
             <TouchableOpacity onPress={onClose} className="p-1 rounded-full bg-slate-100 dark:bg-slate-700">
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="#64748b" />
             </TouchableOpacity>
          </View>

          <View className="p-6">
            <View className="items-center mb-6">
                <Text className="text-sm font-medium text-center text-slate-500 dark:text-slate-400">{message}</Text>
                <Text className="mt-1 text-lg font-bold text-center text-slate-900 dark:text-white">{email}</Text>
            </View>

            <AnimatedView style={style} className="relative items-center mb-8">
                <View className="flex-row justify-between w-full gap-2">
                    {[0,1,2,3,4,5].map((i) => (
                        <Pressable key={i} onPress={() => inputRef.current?.focus()} className={`items-center justify-end flex-1 h-12 border-b-2 ${isError ? 'border-red-500' : code.length === i ? 'border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                            <Text className={`mb-2 text-2xl font-bold text-center ${isError ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{code[i] || ''}</Text>
                        </Pressable>
                    ))}
                </View>
                <TextInput 
                    ref={inputRef} 
                    value={code} 
                    onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, '').slice(0, 6)); if(isError) setIsError(false); }} 
                    keyboardType="number-pad" 
                    textContentType="oneTimeCode" 
                    maxLength={6} 
                    className="absolute w-full h-full opacity-0" 
                />
            </AnimatedView>

            <TouchableOpacity 
              onPress={handleVerifyPress} 
              disabled={loading} 
              className={`w-full py-4 rounded-xl shadow-lg shadow-indigo-500/20 items-center justify-center ${loading ? 'bg-indigo-400' : 'bg-indigo-600'}`}
            >
              <Text className="text-lg font-bold text-center text-white">
                {loading ? 'Verifying...' : 'Verify Code'}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-4">
                <TouchableOpacity onPress={handleResendPress} disabled={!canResend} className="py-2">
                    <Text className={`text-sm font-bold ${canResend ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {canResend ? "Resend Code" : `Resend code in ${timer}s`}
                    </Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* CHANGED: Replaced Pressable with View. 
            This spacer takes up the bottom space but does NOT trigger onClose when clicked. */}
        <View style={{ flex: 1 }} />

      </KeyboardAvoidingView>
    </Modal>
  );
}