import {
  ArrowRight01Icon,
  Briefcase01Icon,
  Clock01Icon,
  HourglassIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Button from './Button';
import DurationPicker from './DurationPicker';
import TimePicker from './TimePicker';

interface OvertimeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number) => void;
  theme: any;
}

const OVERTIME_COLOR = '#f59e0b';

export default function OvertimeModal({
  visible,
  onClose,
  onConfirm,
  theme,
}: OvertimeModalProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const currentTimeLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, []);

  const handleClose = () => {
    setInlineError('');
    onClose();
  };

  const confirmOvertime = (hours: number) => {
    if (hours <= 0) {
      setInlineError('Enter a valid overtime value greater than zero.');
      return;
    }

    handleClose();
    setTimeout(() => onConfirm(hours), 100);
  };

  const handleDurationConfirm = (h: number, m: number) => {
    confirmOvertime(h + m / 60);
  };

  const handleQuickDuration = (hours: number) => {
    setInlineError('');
    confirmOvertime(hours);
  };

  const handleTimeConfirm = (h: number, m: number, p?: 'AM' | 'PM') => {
    const now = new Date();
    const targetDate = new Date(now);
    let hour = h;

    if (p === 'PM' && h < 12) hour += 12;
    if (p === 'AM' && h === 12) hour = 0;

    targetDate.setHours(hour, m, 0, 0);

    const diff = (targetDate.getTime() - now.getTime()) / 3600000;
    if (diff <= 0) {
      setInlineError('Choose a checkout time later than your current time.');
      return;
    }

    setInlineError('');
    confirmOvertime(diff);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalFrame}>
          <View
            style={[
              styles.container,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                shadowColor: theme.dark ? '#000' : OVERTIME_COLOR,
              },
            ]}
          >
            <View style={styles.headerContent}>
              <View style={[styles.iconWrapper, { backgroundColor: `${OVERTIME_COLOR}16` }]}>
                <HugeiconsIcon icon={Briefcase01Icon} size={30} color={OVERTIME_COLOR} />
              </View>
              <Text style={[styles.title, { color: theme.colors.text }]}>Log Overtime</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Your shift has already reached its scheduled end. Choose how much additional time you expect to render.
              </Text>
            </View>

            <View style={styles.quickRow}>
              {[0.5, 1, 2].map((hours) => (
                <TouchableOpacity
                  key={hours}
                  activeOpacity={0.78}
                  onPress={() => handleQuickDuration(hours)}
                  style={[styles.quickChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.quickChipText, { color: theme.colors.text }]}>
                    {hours === 0.5 ? '30 min' : `${hours} hr${hours > 1 ? 's' : ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionList}>
              <TouchableOpacity
                onPress={() => {
                  setInlineError('');
                  setShowDurationPicker(true);
                }}
                activeOpacity={0.78}
                style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={[styles.actionIconBox, { backgroundColor: theme.colors.primary + '10' }]}>
                  <HugeiconsIcon icon={HourglassIcon} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.actionTextContent}>
                  <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Set duration</Text>
                  <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>Choose the exact total overtime duration.</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={theme.colors.icon} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setInlineError('');
                  setShowTimePicker(true);
                }}
                activeOpacity={0.78}
                style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={[styles.actionIconBox, { backgroundColor: `${OVERTIME_COLOR}14` }]}>
                  <HugeiconsIcon icon={Clock01Icon} size={20} color={OVERTIME_COLOR} />
                </View>
                <View style={styles.actionTextContent}>
                  <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Set checkout time</Text>
                  <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>Set your actual time out based on {currentTimeLabel}.</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={theme.colors.icon} />
              </TouchableOpacity>
            </View>

            {inlineError ? (
              <View style={[styles.errorCard, { backgroundColor: theme.colors.dangerLight, borderColor: `${theme.colors.danger}30` }]}>
                <Text style={[styles.errorText, { color: theme.colors.danger }]}>{inlineError}</Text>
              </View>
            ) : null}

            <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <Button
                title="Cancel"
                variant="neutral"
                onPress={handleClose}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Pressable>

        <TimePicker
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onConfirm={handleTimeConfirm}
          initialHours={
            new Date().getHours() > 12
              ? new Date().getHours() - 12
              : new Date().getHours() === 0 ? 12 : new Date().getHours()
          }
          initialMinutes={new Date().getMinutes()}
          initialPeriod={new Date().getHours() >= 12 ? 'PM' : 'AM'}
          title="Set Check Out Time"
        />

        <DurationPicker
          visible={showDurationPicker}
          onClose={() => setShowDurationPicker(false)}
          onConfirm={handleDurationConfirm}
          initialHours={0}
          initialMinutes={0}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 999,
  },
  modalFrame: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 16,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
    marginBottom: 22,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_500Medium',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.84,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: -0.1,
  },
  actionList: {
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextContent: {
    flex: 1,
    paddingRight: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  actionSub: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.72,
    lineHeight: 16,
  },
  errorCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
});

