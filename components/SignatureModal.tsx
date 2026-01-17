import { Cancel01Icon, CheckmarkCircle02Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import { useAppTheme } from '../constants/theme';

export default function SignatureModal({ visible, onClose, onOK }: any) {
    const theme = useAppTheme();
    const ref = useRef<any>();

    const handleOK = (signature: string) => {
        onOK(signature);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Sign Here</Text>
                        <TouchableOpacity onPress={onClose}>
                            <HugeiconsIcon icon={Cancel01Icon} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.padContainer}>
                        <SignatureScreen
                            ref={ref}
                            onOK={handleOK}
                            webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`}
                            backgroundColor="transparent"
                            penColor={theme.colors.text}
                        />
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => ref.current?.clear()} style={[styles.btn, { backgroundColor: theme.colors.danger + '15' }]}>
                            <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                            <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>Clear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => ref.current?.readSignature()} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    card: { height: 400, borderRadius: 20, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
    title: { fontSize: 18, fontWeight: '700' },
    padContainer: { flex: 1, backgroundColor: '#fff' },
    footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderColor: '#eee' },
    btn: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }
});