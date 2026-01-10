import { Cancel01Icon, Search01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function SearchableSelectionModal({ 
  visible, 
  onClose, 
  onSelect, 
  title, 
  options, 
  currentValue, 
  theme,
  placeholder = 'Search...' // Default placeholder
}: any) {
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter((opt: any) => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable 
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} 
        onPress={onClose}
      >
        <Pressable 
            style={{ 
                backgroundColor: theme.colors.card, 
                borderRadius: 24, 
                overflow: 'hidden', 
                borderWidth: 1, 
                borderColor: theme.colors.border,
                maxHeight: '80%',
                width: '100%'
            }}
            onPress={() => {}} // Stop propagation
        >
          {/* Header */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: theme.colors.text }}>
                {title}
            </Text>
          </View>

          {/* Search Bar */}
          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: theme.colors.background, 
                borderRadius: 12, 
                borderWidth: 1, 
                borderColor: theme.colors.border,
                paddingHorizontal: 12,
                height: 44
            }}>
                <HugeiconsIcon icon={Search01Icon} size={18} color={theme.colors.textSecondary} />
                <TextInput 
                    style={{ flex: 1, marginLeft: 8, color: theme.colors.text, fontSize: 14 }}
                    placeholder={placeholder} // Use prop
                    placeholderTextColor={theme.colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <HugeiconsIcon icon={Cancel01Icon} size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
          </View>

          {/* List */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            initialNumToRender={10}
            renderItem={({ item, index }) => (
                <TouchableOpacity 
                    onPress={() => { onSelect(item.value); onClose(); setSearch(''); }} 
                    style={{ 
                        padding: 16, 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                        backgroundColor: currentValue === item.value ? theme.colors.primary + '10' : 'transparent'
                    }}
                >
                    <Text style={{ 
                        fontSize: 16, 
                        fontWeight: currentValue === item.value ? '700' : '500', 
                        color: currentValue === item.value ? theme.colors.primary : theme.colors.text 
                    }}>
                        {item.label}
                    </Text>
                    {currentValue === item.value && (
                        <HugeiconsIcon icon={Tick02Icon} size={20} color={theme.colors.primary} />
                    )}
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.textSecondary }}>No results found.</Text>
                </View>
            }
          />
          
          {/* Footer */}
          <TouchableOpacity 
            onPress={onClose} 
            style={{ 
                padding: 16, 
                borderTopWidth: 1, 
                borderTopColor: theme.colors.border, 
                backgroundColor: theme.colors.background 
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: theme.colors.danger }}>
                Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}