import {
    CheckmarkCircle02Icon,
    Delete02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import ModalHeader from './ModalHeader'; // Using shared component

export default function SignatureModal({ visible, onClose, onOK }: any) {
    const theme = useAppTheme();
    const ref = useRef<SignatureViewRef>(null);

    const handleOK = (signature: string) => {
        onOK(signature);
        onClose();
    };

    const handleClear = () => {
        ref.current?.clearSignature();
    };

    const handleConfirm = () => {
        ref.current?.readSignature();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    
                    <ModalHeader title="Sign Here" onClose={onClose} />
                    
                    <View style={styles.padContainer}>
                        <SignatureScreen
                            ref={ref}
                            onOK={handleOK}
                            webStyle={`.m-signature-pad--footer {display: none; margin: 0px;} .m-signature-pad {box-shadow: none; border: none;} body,html {width: 100%; height: 100%;}`}
                            backgroundColor="transparent"
                            penColor={theme.colors.text}
                        />
                    </View>

                    <View style={styles.footer}>
                        <Button 
                            title="Clear" 
                            onPress={handleClear}
                            style={{ flex: 1, backgroundColor: theme.colors.danger + '15' }}
                            textStyle={{ color: theme.colors.danger }}
                            icon={<HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />}
                        />
                        <Button 
                            title="Save Signature" 
                            variant="primary"
                            onPress={handleConfirm}
                            style={{ flex: 1 }}
                            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#fff" />}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    card: { height: 450, borderRadius: 20, overflow: 'hidden' },
    padContainer: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f0f0', margin: 16, borderRadius: 12, overflow: 'hidden' },
    footer: { flexDirection: 'row', padding: 16, paddingTop: 0, gap: 12 }
});