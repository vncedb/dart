// filepath: components/ActionMenu.tsx
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef } from 'react';
import { Modal, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

export interface ActionMenuItem {
    label?: string;
    icon?: any;
    color?: string;
    destructive?: boolean;
    isActive?: boolean;
    isDivider?: boolean;
    onPress?: () => void;
}

interface ActionMenuProps {
    visible: boolean;
    onClose: () => void;
    actions: ActionMenuItem[];
    anchor?: { x: number; y: number };
}

export default function ActionMenu({ visible, onClose, actions, anchor }: ActionMenuProps) {
    const theme = useAppTheme();

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 40 || gestureState.vy > 0.5) {
                    onClose();
                }
            },
        })
    ).current;

    if (!visible) return null;

    const renderPopoverContent = () => (
        <View style={[styles.popoverContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {actions.map((action, index) => {
                if (action.isDivider) {
                    return <View key={`div-${index}`} style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />;
                }

                const color = action.destructive ? theme.colors.danger : (action.color || theme.colors.text);
                const isActive = action.isActive;
                return (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.popoverItem,
                            index < actions.length - 1 && !actions[index+1]?.isDivider && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                            isActive && { backgroundColor: theme.colors.primary + '10' }
                        ]}
                        onPress={() => { if (action.onPress) action.onPress(); onClose(); }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            {action.icon && <HugeiconsIcon icon={action.icon} size={16} color={color} />}
                            <Text style={[styles.menuText, { color, fontFamily: isActive ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold' }]}>{action.label}</Text>
                        </View>
                        {isActive && <HugeiconsIcon icon={Tick02Icon} size={18} color={theme.colors.primary} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (anchor && Platform.OS !== 'android') {
        return (
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.overlay}>
                        <View style={[styles.popover, { top: anchor.y, right: 24 }]}>
                            {renderPopoverContent()}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.bottomSheetOverlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.floatingSheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.dragHeader} {...panResponder.panHandlers}>
                                <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
                            </View>
                            
                            <View style={styles.sheetContent}>
                                {actions.map((action, index) => {
                                    if (action.isDivider) {
                                        return <View key={`div-${index}`} style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 6, opacity: 0.6 }} />;
                                    }

                                    const color = action.destructive ? theme.colors.danger : (action.color || theme.colors.text);
                                    const iconBg = action.destructive ? theme.colors.danger + '10' : (action.isActive ? theme.colors.primary + '10' : theme.colors.background);
                                    
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.sheetItem,
                                                action.isActive && { backgroundColor: theme.colors.primary + '08' }
                                            ]}
                                            onPress={() => { if (action.onPress) action.onPress(); onClose(); }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.menuItemLeft}>
                                                {action.icon && (
                                                    <View style={[styles.iconWrapper, { backgroundColor: iconBg, borderColor: theme.colors.border, borderWidth: action.isActive || action.destructive ? 0 : 1 }]}>
                                                        <HugeiconsIcon icon={action.icon} size={16} color={color} />
                                                    </View>
                                                )}
                                                <Text style={[styles.sheetText, { color, fontFamily: action.isActive ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold' }]}>
                                                    {action.label}
                                                </Text>
                                            </View>
                                            {action.isActive && <HugeiconsIcon icon={Tick02Icon} size={18} color={theme.colors.primary} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
    popover: { position: 'absolute', width: 220 },
    popoverContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    popoverItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 14 },
    menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuText: { fontSize: 13 },
    
    bottomSheetOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        justifyContent: 'flex-end',
        paddingHorizontal: 20
    },
    
    floatingSheet: { 
        width: '100%', 
        marginBottom: Platform.OS === 'ios' ? 40 : 24, 
        borderRadius: 24, 
        borderWidth: 1,
    },
    
    dragHeader: { width: '100%', paddingVertical: 14, alignItems: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    dragHandle: { width: 36, height: 4, borderRadius: 2, opacity: 0.8 },
    sheetContent: { paddingHorizontal: 8, paddingBottom: 8 },
    sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, marginBottom: 2 },
    iconWrapper: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sheetText: { fontSize: 14, letterSpacing: -0.2 },
});