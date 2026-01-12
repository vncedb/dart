import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Menu01Icon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppTheme } from '../constants/theme';

const { height } = Dimensions.get('window');

export const AVAILABLE_JOB_FIELDS = [
  { key: 'employment_status', label: 'Employment Status' },
  { key: 'shift', label: 'Shift Schedule' },
  { key: 'rate', label: 'Pay Rate' },
  { key: 'rate_type', label: 'Pay Type' },
  { key: 'payroll', label: 'Payroll Schedule' },
  { key: 'breaks', label: 'Unpaid Breaks' },
];

interface JobField {
  key: string;
  label: string;
  isActive: boolean;
}

interface EditDisplayModalProps {
  visible: boolean;
  onClose: () => void;
  selectedKeys: string[];
  onSave: (keys: string[]) => void;
}

export default function EditDisplayModal({
  visible,
  onClose,
  selectedKeys,
  onSave,
}: EditDisplayModalProps) {
  const theme = useAppTheme();
  const [data, setData] = useState<JobField[]>([]);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current; 

  useEffect(() => {
    if (visible) {
      const selectedSet = new Set(selectedKeys);
      const activeItems = selectedKeys
        .map(key => AVAILABLE_JOB_FIELDS.find(f => f.key === key))
        .filter(Boolean)
        .map(item => ({ ...item!, isActive: true }));
      const inactiveItems = AVAILABLE_JOB_FIELDS
        .filter(item => !selectedSet.has(item.key))
        .map(item => ({ ...item, isActive: false }));
      setData([...activeItems, ...inactiveItems]);

      // Enter Animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
        })
      ]).start();
    } else {
        // Reset when invisible
        fadeAnim.setValue(0);
        slideAnim.setValue(height);
    }
  }, [visible, selectedKeys]);

  const closeModal = (callback?: () => void) => {
    // Smooth Exit Animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start(() => {
      if (callback) callback();
      onClose();
    });
  };

  const toggleItem = (key: string) => {
    setData(prev => prev.map(item => 
      item.key === key ? { ...item, isActive: !item.isActive } : item
    ));
  };

  const handleSave = () => {
    const newOrder = data
      .filter(item => item.isActive)
      .map(item => item.key);
    
    // Animate out THEN save to prevent visual jump
    closeModal(() => onSave(newOrder));
  };

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<JobField>) => {
    return (
      <ScaleDecorator activeScale={1.02}>
        <View style={{ paddingHorizontal: 24, marginBottom: 10 }}>
          <View
            style={[
              styles.itemRow,
              { 
                backgroundColor: isActive ? theme.colors.card : theme.colors.background,
                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                borderWidth: 1,
                elevation: isActive ? 4 : 0,
                shadowColor: "#000",
                shadowOpacity: isActive ? 0.1 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }
            ]}
          >
            <TouchableOpacity
              onPressIn={drag}
              hitSlop={{ top: 15, bottom: 15, left: 20, right: 20 }}
              style={styles.dragHandle}
            >
              <HugeiconsIcon icon={Menu01Icon} size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contentContainer}
              onPress={() => toggleItem(item.key)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.itemLabel, 
                { 
                  color: theme.colors.text,
                  opacity: item.isActive ? 1 : 0.5,
                  fontWeight: item.isActive ? '600' : '500'
                }
              ]}>
                {item.label}
              </Text>

              <View style={[
                styles.checkBox, 
                { 
                  borderColor: item.isActive ? theme.colors.primary : theme.colors.border,
                  backgroundColor: item.isActive ? theme.colors.primary : 'transparent'
                }
              ]}>
                {item.isActive && (
                  <HugeiconsIcon icon={Tick02Icon} size={12} color="#FFF" strokeWidth={4} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScaleDecorator>
    );
  }, [theme, data]);

  // Don't render if not visible (helps with animation reset)
  if (!visible) return null;

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={() => closeModal()}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeModal()} />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.modalContainerWrapper, 
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <View>
                <Text style={[styles.title, { color: theme.colors.text }]}>Customize Details</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Drag handle to reorder</Text>
              </View>
              <TouchableOpacity onPress={() => closeModal()} style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}>
                <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <DraggableFlatList
              data={data}
              onDragEnd={({ data }) => setData(data)}
              keyExtractor={(item) => item.key}
              renderItem={renderItem}
              containerStyle={{ flex: 1 }} 
              contentContainerStyle={{ paddingVertical: 20 }}
              showsVerticalScrollIndicator={false}
              activationDistance={5}
            />

            <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainerWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '70%', 
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, height: 58 },
  dragHandle: { height: '100%', paddingLeft: 16, paddingRight: 12, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%', paddingRight: 16 },
  itemLabel: { flex: 1, fontSize: 15 },
  checkBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 24, borderTopWidth: 1 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 8 },
  saveButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});