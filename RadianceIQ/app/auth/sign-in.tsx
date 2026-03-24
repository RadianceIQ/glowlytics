import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useOAuth, useSignIn } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';
import { trackEvent } from '../../src/services/analytics';

WebBrowser.maybeCompleteAuthSession();

const CALM_EASING = Easing.out(Easing.cubic);

export default function SignInScreen() {
  const router = useRouter();
  const { startOAuthFlow: startAppleOAuth } = useOAuth({ strategy: 'oauth_apple' });
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successAnimating, setSuccessAnimating] = useState(false);

  // Staggered entrance animations
  const orbOpacity = useSharedValue(0);
  const orbScale = useSharedValue(0.85);
  const brandOpacity = useSharedValue(0);
  const brandTranslateY = useSharedValue(20);
  const welcomeOpacity = useSharedValue(0);
  const welcomeTranslateY = useSharedValue(20);
  const oauthOpacity1 = useSharedValue(0);
  const oauthTranslateY1 = useSharedValue(20);
  const oauthOpacity2 = useSharedValue(0);
  const oauthTranslateY2 = useSharedValue(20);
  const dividerOpacity = useSharedValue(0);
  const dividerScaleX = useSharedValue(0.6);
  const emailOpacity = useSharedValue(0);
  const emailTranslateY = useSharedValue(20);
  const passwordOpacity = useSharedValue(0);
  const passwordTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(20);
  const footerOpacity = useSharedValue(0);

  // Error shake
  const errorTranslateX = useSharedValue(0);

  // Success animation
  const contentOpacity = useSharedValue(1);
  const successOrbScale = useSharedValue(1);

  useEffect(() => {
    // Logo orb
    orbOpacity.value = withTiming(1, { duration: 600, easing: CALM_EASING });
    orbScale.value = withTiming(1, { duration: 600, easing: CALM_EASING });

    // Brand name
    brandOpacity.value = withDelay(200, withTiming(1, { duration: 500, easing: CALM_EASING }));
    brandTranslateY.value = withDelay(200, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Welcome
    welcomeOpacity.value = withDelay(350, withTiming(1, { duration: 500, easing: CALM_EASING }));
    welcomeTranslateY.value = withDelay(350, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // OAuth buttons
    oauthOpacity1.value = withDelay(500, withTiming(1, { duration: 500, easing: CALM_EASING }));
    oauthTranslateY1.value = withDelay(500, withTiming(0, { duration: 500, easing: CALM_EASING }));
    oauthOpacity2.value = withDelay(620, withTiming(1, { duration: 500, easing: CALM_EASING }));
    oauthTranslateY2.value = withDelay(620, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Divider
    dividerOpacity.value = withDelay(740, withTiming(1, { duration: 400, easing: CALM_EASING }));
    dividerScaleX.value = withDelay(740, withTiming(1, { duration: 400, easing: CALM_EASING }));

    // Email
    emailOpacity.value = withDelay(900, withTiming(1, { duration: 500, easing: CALM_EASING }));
    emailTranslateY.value = withDelay(900, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Password
    passwordOpacity.value = withDelay(1020, withTiming(1, { duration: 500, easing: CALM_EASING }));
    passwordTranslateY.value = withDelay(1020, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Sign-in button
    buttonOpacity.value = withDelay(1140, withTiming(1, { duration: 500, easing: CALM_EASING }));
    buttonTranslateY.value = withDelay(1140, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Footer
    footerOpacity.value = withDelay(1300, withTiming(1, { duration: 400, easing: CALM_EASING }));
  }, []);

  // Trigger shake on error
  useEffect(() => {
    if (error) {
      errorTranslateX.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 80 }),
      );
    }
  }, [error]);

  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value * successOrbScale.value }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value * contentOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));
  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: welcomeOpacity.value * contentOpacity.value,
    transform: [{ translateY: welcomeTranslateY.value }],
  }));
  const oauth1Style = useAnimatedStyle(() => ({
    opacity: oauthOpacity1.value * contentOpacity.value,
    transform: [{ translateY: oauthTranslateY1.value }],
  }));
  const oauth2Style = useAnimatedStyle(() => ({
    opacity: oauthOpacity2.value * contentOpacity.value,
    transform: [{ translateY: oauthTranslateY2.value }],
  }));
  const dividerStyle = useAnimatedStyle(() => ({
    opacity: dividerOpacity.value * contentOpacity.value,
    transform: [{ scaleX: dividerScaleX.value }],
  }));
  const emailStyle = useAnimatedStyle(() => ({
    opacity: emailOpacity.value * contentOpacity.value,
    transform: [{ translateY: emailTranslateY.value }],
  }));
  const passwordStyle = useAnimatedStyle(() => ({
    opacity: passwordOpacity.value * contentOpacity.value,
    transform: [{ translateY: passwordTranslateY.value }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value * contentOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));
  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value * contentOpacity.value,
  }));
  const errorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorTranslateX.value }],
  }));

  const triggerSuccessAnimation = useCallback(() => {
    setSuccessAnimating(true);
    contentOpacity.value = withTiming(0, { duration: 400 });
    successOrbScale.value = withTiming(1.2, { duration: 500, easing: CALM_EASING });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleOAuthSignIn = useCallback(
    async (strategy: 'oauth_apple' | 'oauth_google') => {
      try {
        setError(null);
        const isApple = strategy === 'oauth_apple';
        setOauthLoading(isApple ? 'apple' : 'google');
        trackEvent('auth_sign_in_started', { method: isApple ? 'oauth_apple' : 'oauth_google' });

        const startFlow = isApple ? startAppleOAuth : startGoogleOAuth;
        const { createdSessionId, setActive: oauthSetActive } = await startFlow();

        if (createdSessionId) {
          await oauthSetActive?.({ session: createdSessionId });
          trackEvent('auth_sign_in_completed', { method: isApple ? 'oauth_apple' : 'oauth_google' });
          triggerSuccessAnimation();
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'An error occurred during sign in.';
        if (!message.includes('cancel')) {
          trackEvent('auth_sign_in_failed', { method: strategy, error: message });
          setError(message);
        }
      } finally {
        setOauthLoading(null);
      }
    },
    [startAppleOAuth, startGoogleOAuth, triggerSuccessAnimation],
  );

  const handleEmailSignIn = useCallback(async () => {
    if (!isLoaded || !signIn) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      trackEvent('auth_sign_in_started', { method: 'email' });

      const result = await signIn.create({
        identifier: trimmedEmail,
        password,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        trackEvent('auth_sign_in_completed', { method: 'email' });
        triggerSuccessAnimation();
      } else {
        setError('Additional verification required. Please try again.');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid email or password.';
      trackEvent('auth_sign_in_failed', { method: 'email', error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, setActive, email, password, triggerSuccessAnimation]);

  const isDisabled = loading || oauthLoading !== null || successAnimating;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <View style={styles.brandContainer}>
            <Animated.View style={orbStyle}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
            <Animated.Text style={[styles.brandName, brandStyle]}>Glowlytics</Animated.Text>
            <Animated.Text style={[styles.brandTagline, welcomeStyle]}>Welcome back</Animated.Text>
          </View>

          {/* Error message */}
          {error ? (
            <Animated.View style={[styles.errorContainer, errorStyle]}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          {/* OAuth Buttons */}
          <Animated.View style={[styles.oauthSection, oauth1Style]}>
            <TouchableOpacity
              style={styles.appleButton}
              onPress={() => handleOAuthSignIn('oauth_apple')}
              disabled={isDisabled}
              activeOpacity={0.8}
            >
              {oauthLoading === 'apple' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={oauth2Style}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => handleOAuthSignIn('oauth_google')}
              disabled={isDisabled}
              activeOpacity={0.8}
            >
              {oauthLoading === 'google' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View style={[styles.divider, dividerStyle]}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          {/* Email / Password */}
          <Animated.View style={[styles.inputContainer, emailStyle]}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isDisabled}
            />
          </Animated.View>

          <Animated.View style={[styles.inputContainer, passwordStyle]}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={Colors.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              editable={!isDisabled}
            />
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => router.push('/auth/forgot-password')}
            >
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={buttonStyle}>
            <TouchableOpacity
              style={[styles.signInButton, isDisabled && styles.buttonDisabled]}
              onPress={handleEmailSignIn}
              disabled={isDisabled}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.signInButtonText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, footerStyle]}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => router.replace('/auth/sign-up')}
              >
                Sign up
              </Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.md,
  },

  // Branding
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  brandName: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
    letterSpacing: 0.5,
  },
  brandTagline: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },

  // Error
  errorContainer: {
    backgroundColor: 'rgba(209, 67, 67, 0.08)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(209, 67, 67, 0.18)',
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },

  // OAuth
  oauthSection: {
    marginBottom: 0,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    height: 56,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  appleIcon: {
    fontSize: FontSize.xl,
    color: Colors.textOnDark,
  },
  appleButtonText: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    height: 56,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  googleIcon: {
    fontSize: FontSize.xl,
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansBold,
  },
  googleButtonText: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textDim,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    marginHorizontal: Spacing.md,
  },

  // Form
  inputContainer: {
    gap: Spacing.xs,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    height: 52,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },
  forgotLinkText: {
    color: Colors.secondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: Colors.background,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  footerText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
  },
  footerLink: {
    color: Colors.secondary,
    fontFamily: FontFamily.sansSemiBold,
  },
});
