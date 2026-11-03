import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { updateProfile } from '../../lib/auth';
import CityPicker from '../../components/CityPicker';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [alias, setAlias] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fecha en formato de El Salvador: DD/MM/AAAA
  const parseDob = (dob: string): Date | null => {
    const parts = dob.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return null;
    const [day, month, year] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    const valid =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return valid && date <= new Date() ? date : null;
  };

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSave = async () => {
    if (!alias.trim() && !fullName.trim()) {
      Alert.alert('Error', 'Please enter at least a name or alias');
      return;
    }

    if (!cityId) {
      Alert.alert('Error', 'Please select your department');
      return;
    }

    setLoading(true);
    try {
      let age: number | null = null;
      let formattedDob: string | null = null;

      if (dateOfBirth) {
        const birthDate = parseDob(dateOfBirth);
        if (!birthDate) {
          Alert.alert('Error', 'Fecha no válida. Usa el formato DD/MM/AAAA, por ejemplo 18/08/1997');
          setLoading(false);
          return;
        }
        age = calculateAge(birthDate);
        const [d, m, y] = dateOfBirth.split('/');
        formattedDob = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      await updateProfile(user!.id, {
        alias: alias.trim() || null,
        full_name: fullName.trim() || null,
        age,
        date_of_birth: formattedDob,
        city_id: cityId,
      });

      await refreshProfile();
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not save profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDateInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    }
    setDateOfBirth(formatted);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-add" size={36} color={Colors.surface} />
          </View>
          <Text style={styles.title}>Set Up Your Profile</Text>
          <Text style={styles.subtitle}>
            Tell us a bit about yourself so we can personalize your experience.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Alias / Username</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="at-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. eco_warrior"
                placeholderTextColor={Colors.textLight}
                value={alias}
                onChangeText={setAlias}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor={Colors.textLight}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={Colors.textLight}
                value={dateOfBirth}
                onChangeText={formatDateInput}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          <CityPicker value={cityId} onChange={setCityId} />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              if (!cityId) {
                Alert.alert('Error', 'Please select your department');
                return;
              }
              updateProfile(user!.id, { alias: 'Recycler', city_id: cityId }).then(() => {
                refreshProfile();
                router.replace('/(tabs)');
              });
            }}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 56,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
