import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, LabeledInput, PrimaryButton } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { login, loading, error: authError } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async () => {
    const errors: { email?: string; password?: string } = {};
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
    if (password.length === 0) errors.password = 'Password is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await login(email, password); // on success, App.tsx switches to the app stack
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={typography.title}>TaskFlow Pro</Text>
        <Text style={[typography.secondary, styles.subtitle]}>Sign in to manage your tasks</Text>

        <ErrorBanner message={authError} />

        <LabeledInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          error={fieldErrors.email}
        />
        <LabeledInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          error={fieldErrors.password}
        />

        <PrimaryButton label="Login" onPress={submit} loading={loading} />

        <View style={styles.footer}>
          <Text style={typography.secondary}>Don't have an account? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
            Register
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
