import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HeaderProps {
  title: string | React.ReactNode;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export default function Header({ title, onBack, rightElement }: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={styles.container}>
      
      {/* 1. Title Layer (Absolute Centered) 
          Removed zIndex: -1 to ensure it sits ON TOP of the background 
          but relies on JSX order (rendered first) to sit BEHIND buttons.
      */}
      <View style={styles.titleWrapper} pointerEvents="none">
        {typeof title === 'string' ? (
          <Text 
            style={styles.titleText} 
            numberOfLines={1} 
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        ) : (
          title
        )}
      </View>

      {/* 2. Left Action (Back Button) */}
      <View style={styles.leftContainer}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* 3. Right Action (Custom Element) */}
      <View style={styles.rightContainer}>
        {rightElement}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60, // Standard header height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff', // Ensure this background doesn't cover the title
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9', // slate-100
    position: 'relative', // Establish stacking context
  },
  titleWrapper: {
    ...StyleSheet.absoluteFillObject, // Fill the container
    alignItems: 'center',
    justifyContent: 'center',
    // zIndex removed to prevent hiding behind background
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a', // slate-900
    textAlign: 'center',
    maxWidth: '60%', // Prevent text from overlapping side buttons visually
  },
  leftContainer: {
    alignItems: 'flex-start',
    zIndex: 10, // Ensure buttons are clickable and on top
  },
  rightContainer: {
    alignItems: 'flex-end',
    zIndex: 10, // Ensure buttons are clickable and on top
    minWidth: 40,
  },
  iconButton: {
    padding: 8,
    borderRadius: 9999,
    marginLeft: -8, 
  }
});