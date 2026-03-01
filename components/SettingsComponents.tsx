import { ArrowRight01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Modern Animated Settings Item ---
export const ModernSettingsItem = ({ 
    icon, 
    label, 
    subLabel, 
    onPress, 
    rightElement, 
    destructive, 
    isLast, 
    theme 
}: any) => {
    const scaleValue = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.spring(scaleValue, { toValue: 0.97, useNativeDriver: true, speed: 20 }).start();
    };

    const onPressOut = () => {
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
    };

    return (
        <View>
            <Pressable 
                onPress={onPress}
                onPressIn={onPress ? onPressIn : undefined}
                onPressOut={onPress ? onPressOut : undefined}
                disabled={!onPress}
            >
                <Animated.View style={{ 
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    transform: [{ scale: scaleValue }]
                }}>
                    <View style={{ 
                        width: 36, height: 36, borderRadius: 10, 
                        backgroundColor: destructive ? '#fee2e2' : theme.colors.background, 
                        alignItems: 'center', justifyContent: 'center', marginRight: 12 
                    }}>
                        <HugeiconsIcon icon={icon} size={18} color={destructive ? '#ef4444' : (onPress || rightElement ? theme.colors.primary : theme.colors.textSecondary)} />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontFamily: 'Nunito_600SemiBold', color: destructive ? '#ef4444' : theme.colors.text }}>{label}</Text>
                        {subLabel && <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, marginTop: 2 }}>{subLabel}</Text>}
                    </View>
                    {rightElement ? rightElement : (onPress && <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.textSecondary} />)}
                </Animated.View>
            </Pressable>
            {!isLast && <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginVertical: 4 }} />}
        </View>
    );
};

// --- Dropdown Setting Item ---
export const SettingsDropdownItem = ({ icon, label, options, value, onChange, theme, isLast }: any) => {
    const [visible, setVisible] = useState(false);
    const [layout, setLayout] = useState<any>(null);
    const triggerRef = useRef<View>(null);
    const insets = useSafeAreaInsets();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    const selectedOption = options.find((o: any) => o.value === value);

    const openDropdown = () => {
        triggerRef.current?.measureInWindow((x, y, width, height) => {
            const windowHeight = Dimensions.get('window').height;
            const dropdownHeight = Math.min(options.length * 48 + 10, 280); 
            const spaceBelow = windowHeight - (y + height + insets.bottom + 20);
            const showAbove = spaceBelow < dropdownHeight;

            setLayout({
                x: x + width - 220, // Align right, fixed width
                y: showAbove ? y - dropdownHeight + 10 : y + height - 10,
                width: 220,
                height: dropdownHeight
            });
            setVisible(true);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, damping: 20, stiffness: 300, useNativeDriver: true })
            ]).start();
        });
    };

    const closeDropdown = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true })
        ]).start(() => setVisible(false));
    };

    const handleSelect = (val: any) => {
        onChange(val);
        closeDropdown();
    };

    return (
        <View ref={triggerRef} collapsable={false}>
            <ModernSettingsItem 
                icon={icon} 
                label={label} 
                isLast={isLast}
                theme={theme}
                onPress={openDropdown}
                rightElement={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: theme.colors.primary }}>
                            {selectedOption?.label || 'Select'}
                        </Text>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                    </View>
                }
            />
            
            <Modal visible={visible} transparent animationType="none" onRequestClose={closeDropdown}>
                <Pressable style={styles.overlay} onPress={closeDropdown}>
                    {layout && (
                        <Animated.View 
                            style={[
                                styles.dropdown, 
                                { 
                                    top: layout.y, left: layout.x, width: layout.width, height: layout.height,
                                    backgroundColor: theme.colors.card, borderColor: theme.colors.border,
                                    opacity: fadeAnim, transform: [{ scale: scaleAnim }]
                                }
                            ]}
                        >
                            <ScrollView contentContainerStyle={{ padding: 4 }} showsVerticalScrollIndicator={false}>
                                {options.map((opt: any, i: number) => {
                                    const isSelected = opt.value === value;
                                    return (
                                        <TouchableOpacity 
                                            key={i} 
                                            onPress={() => handleSelect(opt.value)}
                                            style={[styles.dropdownItem, isSelected && { backgroundColor: theme.colors.primary + '15' }]}
                                        >
                                            <Text style={[styles.dropdownText, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                                                {opt.label}
                                            </Text>
                                            {isSelected && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={theme.colors.primary} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </Animated.View>
                    )}
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'transparent' },
    dropdown: { position: 'absolute', borderRadius: 16, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, overflow: 'hidden' },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 2 },
    dropdownText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' }
});