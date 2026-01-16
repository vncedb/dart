import React, { useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import ModalHeader from './ModalHeader';

interface SignatureModalProps {
    visible: boolean;
    onClose: () => void;
    onOK: (signature: string) => void;
}

export default function SignatureModal({ visible, onClose, onOK }: SignatureModalProps) {
    const theme = useAppTheme();
    const ref = useRef<SignatureViewRef>(null);

    const handleOK = (signature: string) => {
        onOK(signature);
        onClose();
    };

    const handleClear = () => {
        ref.current?.clearSignature();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <ModalHeader title="Sign Here" position="center" />
                
                <View style={{ flex: 1 }}>
                    <SignatureScreen
                        ref={ref}
                        onOK={handleOK}
                        webStyle={`
                            .m-signature-pad--footer {display: none; margin: 0px;} 
                            body,html {width: 100%; height: 100%;}
                        `} 
                        backgroundColor={'#fff'} 
                        descriptionText="Sign above"
                    />
                </View>

                <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                    <Button 
                        title="Clear" 
                        variant="neutral" 
                        onPress={handleClear} 
                        style={{ flex: 1 }} 
                    />
                    <View style={{ width: 12 }} />
                    <Button 
                        title="Save Signature" 
                        variant="primary" 
                        onPress={() => ref.current?.readSignature()} 
                        style={{ flex: 1 }} 
                    />
                </View>
                
                {/* Cancel button separately or in footer? Usually specific action in footer is enough, 
                    but let's add a Close button for safety if user wants to abort */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                     <Button title="Cancel" variant="ghost" onPress={onClose} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    footer: { padding: 16, flexDirection: 'row', borderTopWidth: 1 },
});