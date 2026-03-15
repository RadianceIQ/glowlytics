interface EnvConfig {
  CLERK_PUBLISHABLE_KEY: string;
  API_BASE_URL: string;
  REVENUECAT_API_KEY: string;
}

export const env: EnvConfig = {
  CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
  REVENUECAT_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '',
};
