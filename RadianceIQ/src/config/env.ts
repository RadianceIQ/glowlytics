interface EnvConfig {
  CLERK_PUBLISHABLE_KEY: string;
  API_BASE_URL: string;
  REVENUECAT_API_KEY: string;
  POSTHOG_API_KEY: string;
}

const resolvedApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// Warn if production build is accidentally pointed at localhost
if (!__DEV__ && resolvedApiUrl.includes('localhost')) {
  console.error('[ENV] API_BASE_URL points to localhost in a production build — API calls will fail');
}

export const env: EnvConfig = {
  CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  API_BASE_URL: resolvedApiUrl,
  REVENUECAT_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '',
  POSTHOG_API_KEY:
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
};
