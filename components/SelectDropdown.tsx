import { ArrowDown01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

interface Option {
    label: string;
    value: any;
    icon?: React.ReactNode;
    description?: string;
}

interface SelectDropdownProps {
    label?: string;
    value: any;
    options: Option[];
    onChange: (value: any) => void;
    placeholder?: string;
}

export default function SelectDropdown({ label, value, options, onChange, placeholder = 'Select' }: SelectDropdownProps) {
    const theme = useAppTheme();
    const [visible, setVisible] = useState(false);

    const selectedOption = options.find(o => o.value === value);

    const handleSelect = (val: any) => {
        onChange(val);
        setVisible(false);
    };

    return (
        <View style={styles.wrapper}>
            {label && <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>}
            
            <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => setVisible(true)} 
                style={[styles.trigger, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
                <View style={{flexDirection:'row', alignItems:'center', gap: 10, flex: 1}}>
                    {selectedOption?.icon}
                    <View>
                        <Text style={[styles.valueText, { color: selectedOption ? theme.colors.text : theme.colors.textSecondary }]}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </Text>
                    </View>
                </View>
                <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="none" onRequestClose={() => setVisible(false)}>
                <View style={styles.overlay}>
                    {/* Backdrop */}
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)}>
                        <Animated.View 
                            entering={FadeIn}
                            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} 
                        />
                    </Pressable>

                    {/* Floating Dialog */}
                    <Animated.View 
                        entering={ZoomIn.duration(200)} 
                        exiting={ZoomOut.duration(150)} 
                        style={[
                            styles.dialog, 
                            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }
                        ]}
                    >
                        <View style={styles.dialogHeader}>
                            <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>
                                {label || placeholder}
                            </Text>
                        </View>

                        <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ padding: 8 }}>
                            {options.map((opt, i) => {
                                const isSelected = opt.value === value;
                                return (
                                    <TouchableOpacity 
                                        key={i} 
                                        onPress={() => handleSelect(opt.value)}
                                        style={[
                                            styles.optionItem, 
                                            isSelected && { backgroundColor: theme.colors.primary + '10' }
                                        ]}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                            {opt.icon}
                                            <View style={{ flex: 1 }}>
                                                <Text style={[
                                                    styles.optionLabel, 
                                                    { color: isSelected ? theme.colors.primary : theme.colors.text }
                                                ]}>
                                                    {opt.label}
                                                </Text>
                                                {opt.description && (
                                                    <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
                                                        {opt.description}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                        {isSelected && (
                                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color={theme.colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { marginBottom: 20 },
    label: { fontSize: 11, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    trigger: { 
        height: 56, 
        borderRadius: 12, 
        borderWidth: 1, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16 
    },
    valueText: { fontSize: 15, fontWeight: '600' },
    
    // Dialog Styles
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    dialog: { 
        width: '100%', 
        maxWidth: 340, 
        borderRadius: 16, 
        borderWidth: 1,
        elevation: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        overflow: 'hidden'
    },
    dialogHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    dialogTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 },
    
    optionItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        borderRadius: 10, 
        marginBottom: 4,
    },
    optionLabel: { fontSize: 14, fontWeight: '600' },
    optionDesc: { fontSize: 11, marginTop: 2, lineHeight: 14 }
});