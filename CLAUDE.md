# Glowlytics - Skin Health Tracking App

## Project Structure

```
cornell-hackathon/
  prd.md              # Product requirements document
  progress.txt        # Build progress log
  RadianceIQ/         # Main app (Expo + React Native)
    app/              # Expo Router screens (file-based routing)
      _layout.tsx
      index.tsx       # Entry/splash
      home.tsx
      skin-metrics.tsx
      auth/           # Auth screens (sign-in, sign-up, forgot-password)
      onboarding/     # Onboarding flow (13 screens, progressive disclosure)
      scan/           # Scanning flow (camera → processing → checkin → results)
      report/         # Report screens (premium-gated)
      product/        # Product detail screens
      paywall.tsx     # RevenueCat native paywall (inline component)
      signal/         # Signal detail screens
      (tabs)/         # Tab navigation (today, trend)
      skin-metric/    # Skin metric detail
    src/
      components/     # Reusable UI components (20 files)
      constants/      # Theme (colors, typography)
      config/         # Environment config, Clerk token cache
      hooks/          # Custom hooks (useFaceTracking)
      services/       # Business logic (16 services + 13 test suites)
      store/          # Zustand state (useStore.ts)
      types/          # TypeScript type definitions
      utils/          # Animation utilities
    backend/          # Express + PostgreSQL API
      app.js          # Express app (routes, middleware) — exported for testing
      server.js       # Server entry point (app.listen only)
      db-init.js
      rag.js          # Pinecone RAG pipeline for AAD/ACOG guidelines
      __tests__/      # Backend test suites (vision, rag, integration)
    assets/           # Images, fonts
```

## Tech Stack

- **Framework:** React Native with Expo SDK 54
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router (file-based)
- **State:** Zustand + AsyncStorage
- **Auth:** Clerk (@clerk/clerk-expo v2)
- **Subscriptions:** RevenueCat (react-native-purchases + react-native-purchases-ui v9.12.0, entitlement: "Glow Pro", 3 free scans)
- **Analytics:** PostHog (posthog-react-native, 20 events across auth/onboarding/scan/paywall/engagement)
- **Vision:** Fine-tuned GPT-4o via backend proxy (`ft:gpt-4o-2024-08-06:personal:radianceiq-skin:DHBaOo20`)
- **RAG:** Pinecone vector DB + OpenAI embeddings for AAD/ACOG guidelines
- **Backend:** Express.js + PostgreSQL + OpenAI SDK
- **Domain:** glowlytics.ai
- **Node version:** Use the version compatible with Expo SDK 54

## Commands

```bash
# All commands run from RadianceIQ/
cd RadianceIQ

# Start dev server
npm start

# Type check
npx tsc --noEmit

# Run tests
npm test

# Start backend (separate terminal)
cd backend && node server.js

# Run backend tests
cd backend && npm test
```

## Code Conventions

- TypeScript strict mode for all frontend code
- Screens in `app/` following Expo Router file-based conventions
- Reusable components in `src/components/`
- Business logic and API calls in `src/services/`
- State management via Zustand store (`src/store/useStore.ts`)
- Type definitions in `src/types/index.ts`
- Use targeted Zustand selectors (`useStore((s) => s.field)`) — avoid `useStore()` full subscriptions
- `useStore.getState()` for imperative reads in callbacks (no subscription)

## Scan Flow Architecture

Camera → Processing → Checkin → Results

1. **Camera** (`app/scan/camera.tsx`): Face tracking, quality checks, auto-capture after 2s aligned
2. **Processing** (`app/scan/processing.tsx`): Pre-encodes photo to base64, stores in `pendingPhotoBase64`, shows animation
3. **Checkin** (`app/scan/checkin.tsx`): Collects daily context (sunscreen, new product, sleep, stress), then runs `analyzeWithFallback` with real user answers
4. **Results** (`app/scan/results.tsx`): Displays scores, face mesh, RAG recommendations

Analysis runs **after** checkin — never with hardcoded context. The `pendingPhotoBase64` store field avoids re-encoding the photo.

## Design System

- Dark theme: background `#060B12`, primary accent `#7DE7E1`
- Animations via `react-native-reanimated`
- Onboarding: fade transitions with staggered fade-with-rise entrance (Headspace-inspired)

## Important Context

- Vision API calls fine-tuned GPT-4o via backend proxy (API key server-side only, 30s timeout)
- RAG pipeline queries Pinecone for AAD/ACOG guideline context
- 233 tests (19 suites), 0 TS errors
- Authentication via Clerk is mandatory when CLERK_PUBLISHABLE_KEY is set
- Face tracking thresholds (faceTracking.ts) and photo quality thresholds (photoQuality.ts) both use 20% min fill
- Gamification system: XP, 6 levels, 15 badges, weekly challenges, personal bests
- Premium users' `free_scans_used` counter does not increment — freezes during subscription
- `useFaceTracking` cleans up temp frame photos to prevent storage leaks
- RevenueCat functions guard on `env.REVENUECAT_API_KEY` — all are safe to call without a key
- PostHog analytics guard on `env.POSTHOG_API_KEY` — all no-op when key is empty
- Subscription state persisted in Zustand: tier, is_active, expires_at, product_id, free_scans_used
- Scan gating: camera tab, camera screen, home scan buttons → paywall if free scans exhausted
- Report gating: reports require active subscription
- Profile screen: subscription card with upgrade/manage, Customer Center for active subscribers
