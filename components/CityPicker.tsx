import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchCities } from '../lib/auth';
import { City } from '../lib/database.types';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface CityPickerProps {
  value: string | null;
  onChange: (cityId: string) => void;
  label?: string;
  placeholder?: string;
}

export default function CityPicker({
  value,
  onChange,
  label = 'Department / City',
  placeholder = 'Select your department',
}: CityPickerProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchCities()
      .then((loadedCities) => {
        setCities(loadedCities);
      })
      .catch((error) => {
        setCities([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCity = cities.find((city) => city.id === value);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => {
          setVisible(true);
        }}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
            <Text
              style={[styles.selectorText, !selectedCity && styles.placeholderText]}
              numberOfLines={1}
            >
              {selectedCity?.name ?? placeholder}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Department</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={cities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = item.id === value;
                return (
                  <TouchableOpacity
                    style={[styles.cityRow, selected && styles.cityRowSelected]}
                    onPress={() => {
                      onChange(item.id);
                      setVisible(false);
                    }}
                  >
                    <Text style={[styles.cityName, selected && styles.cityNameSelected]}>
                      {item.name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.xs,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 56,
    gap: Spacing.sm,
  },
  selectorText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cityRowSelected: {
    backgroundColor: Colors.primaryLight,
  },
  cityName: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  cityNameSelected: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});
