import {
    Camera01Icon,
    Cancel01Icon,
    Delete02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAppTheme } from '../constants/theme';

const { height } = Dimensions.get('window');

interface EditAvatarModalProps {
    visible: boolean;
    onClose: () => void;
    onPickImage: () => void;
    onRemoveImage: () => void;
}

export default function EditAvatarModal({
    visible,
    onClose,
    onPickImage,
    onRemoveImage
}: EditAvatarModalProps) {
    const theme = useAppTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 90 })
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(height);
        }
    }, [visible]);

    const closeModal = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { 
                toValue: height, 
                duration: 250, 
                easing: Easing.out(Easing.cubic), 
                useNativeDriver: true 
            })
        ]).start(() => {
            if (callback) callback();
            onClose();
        });
    };

    if (!visible) return null;

    return (
        <Modal visible={true} transparent animationType="none" onRequestClose={() => closeModal()}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => closeModal()} />
                </Animated.View>

                <Animated.View style={[styles.modalContainerWrapper, { transform: [{ translateY: slideAnim }] }]}>
                    <View style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
                        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                            <View>
                                <Text style={[styles.title, { color: theme.colors.text }]}>Profile Picture</Text>
                                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                    Update your photo or remove it
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => closeModal()} style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}>
                                <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            <TouchableOpacity 
                                onPress={() => closeModal(onPickImage)} 
                                style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                    <HugeiconsIcon icon={Camera01Icon} size={22} color={theme.colors.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Upload New Photo</Text>
                                    <Text style={[styles.actionDesc, { color: theme.colors.textSecondary }]}>Select from gallery</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => closeModal(onRemoveImage)} 
                                style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconBox, { backgroundColor: theme.colors.danger + '15' }]}>
                                    <HugeiconsIcon icon={Delete02Icon} size={22} color={theme.colors.danger} />
                                </View>
                                <View>
                                    <Text style={[styles.actionTitle, { color: theme.colors.danger }]}>Remove Current Photo</Text>
                                    <Text style={[styles.actionDesc, { color: theme.colors.textSecondary }]}>Use default initials</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContainerWrapper: { width: '100%' },
    modalContainer: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
    },
    title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    closeBtn: { padding: 8, borderRadius: 50 },
    content: { padding: 24, gap: 12 },
    actionButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
    iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    actionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    actionDesc: { fontSize: 12, fontWeight: '500' }
});