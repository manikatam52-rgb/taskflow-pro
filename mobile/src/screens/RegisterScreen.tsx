import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, LabeledInput, PrimaryButton } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { AuthAtmosphere, TaskFlowMark } from '../components/AuthVisual';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const { register, loading, error: authError } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Enter your name';
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
    if (
      password.length < 8 ||
      !/[a-zA-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      errors.password = 'At least 8 characters, with a letter and a number';
    }
    if (password !== confirmPassword)
      errors.confirmPassword = 'Passwords do not match';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await register(email, password, name.trim()); // on success, App.tsx switches to the app stack
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <AuthAtmosphere />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.brand}>
          <TaskFlowMark style={styles.brandMark} />
          <Text style={styles.brandName}>TaskFlow</Text>
          <Text style={[typography.secondary, styles.subtitle]}>
            Make room for what matters.
          </Text>
        </View>
        <View style={styles.formCard}>
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.helper}>
            Your tasks, priorities, and plans in one place.
          </Text>
          <ErrorBanner message={authError} />
          <LabeledInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="sentences"
            error={fieldErrors.name}
          />
          <LabeledInput
            label="Email address"
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
            placeholder="At least 8 characters"
            secureTextEntry
            error={fieldErrors.password}
          />
          <LabeledInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Enter your password again"
            secureTextEntry
            error={fieldErrors.confirmPassword}
          />
          <PrimaryButton
            label="Create account"
            onPress={submit}
            loading={loading}
            style={styles.submit}
          />
        </View>
        <View style={styles.footer}>
          <Text style={typography.secondary}>Already have an account? </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    padding: spacing.xl,
    justifyContent: 'center',
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', marginBottom: spacing.lg },
  brandMark: { marginBottom: spacing.sm },
  brandName: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: { marginTop: spacing.xs },
  formCard: {
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#172554',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
  },
  link: { color: colors.primary, fontWeight: '700' },
});
