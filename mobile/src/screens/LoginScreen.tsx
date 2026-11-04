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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, LabeledInput, PrimaryButton } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { AuthAtmosphere, TaskFlowMark } from '../components/AuthVisual';
import type { RootStackParamList } from '../navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { login, loading, error: authError } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const submit = async () => {
    const errors: { email?: string; password?: string } = {};
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
    if (password.length === 0) errors.password = 'Password is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await login(email, password); // on success, App.tsx switches to the app stack
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
            A calmer way to get things done.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.helper}>
            Sign in to pick up where you left off.
          </Text>
          <ErrorBanner message={authError} />

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
            placeholder="Enter your password"
            secureTextEntry
            error={fieldErrors.password}
          />
          <PrimaryButton
            label="Sign in"
            onPress={submit}
            loading={loading}
            style={styles.submit}
          />
        </View>

        <View style={styles.footer}>
          <Text style={typography.secondary}>New to TaskFlow? </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.link}>Create an account</Text>
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
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  brandMark: { marginBottom: spacing.md },
  brandName: {
    fontSize: 27,
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
    marginBottom: spacing.xl,
  },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 44,
  },
  link: { color: colors.primary, fontWeight: '700' },
});
