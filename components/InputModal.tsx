import React, { useEffect, useState } from "react";
import { Modal, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../constants/theme";
import Button from "./Button";

interface InputModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}

export default function InputModal({
  visible,
  onClose,
  onConfirm,
  title,
  initialValue = "",
  placeholder = "",
  confirmLabel = "Save",
}: InputModalProps) {
  const theme = useAppTheme();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const handleConfirm = () => {
    onConfirm(value);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent, 
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            style={[
              styles.input,
              { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border, 
                  color: theme.colors.text 
              },
            ]}
            autoFocus
          />
          
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title={confirmLabel}
              onPress={handleConfirm}
              variant="primary"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 15 }
    })
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row", 
    gap: 12 
  }
});