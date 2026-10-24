import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, LabeledInput, PrimaryButton } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const { register, loading, error: authError } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Enter your name';
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'At least 8 characters, with a letter and a number';
    }
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await register(email, password, name.trim()); // on success, App.tsx switches to the app stack
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={typography.title}>Create account</Text>
        <Text style={[typography.secondary, styles.subtitle]}>Start organizing your tasks</Text>

        <ErrorBanner message={authError} />

        <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="Your name" error={fieldErrors.name} />
        <LabeledInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" error={fieldErrors.email} />
        <LabeledInput label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry error={fieldErrors.password} />
        <LabeledInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" secureTextEntry error={fieldErrors.confirmPassword} />

        <PrimaryButton label="Register" onPress={submit} loading={loading} />

        <View style={styles.footer}>
          <Text style={typography.secondary}>Already have an account? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Login
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl, justifyContent: 'center', flexGrow: 1 },
  subtitle: { marginBottom: spacing.xl, marginTop: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  link: { color: colors.primary, fontWeight: '600' },
});
