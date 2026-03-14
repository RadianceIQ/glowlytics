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
      scan/           # Scanning flow
      report/         # Report screens
      product/        # Product detail screens
      signal/         # Signal detail screens
      (tabs)/         # Tab navigation
      skin-metric/    # Skin metric detail
    src/
      components/     # Reusable UI components (20 files)
      constants/      # Theme (colors, typography)
      config/         # Environment config, Clerk token cache
      hooks/          # Custom hooks
      services/       # Business logic (13 services + 9 test suites)
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
# or: npx expo start

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

- Use TypeScript for all frontend code; strict mode is enabled
- Screens go in `app/` following Expo Router file-based conventions
- Reusable components go in `src/components/`
- Business logic and API calls go in `src/services/`
- State management through Zustand store in `src/store/useStore.ts`
- Type definitions in `src/types/index.ts`
- Auth configuration in `src/config/` (env.ts, tokenCache.ts, clerk.ts)
- Animation utilities in `src/utils/animations.ts`
- Onboarding flow logic in `src/services/onboardingFlow.ts`

## Design System

- Dark theme: background `#060B12`, primary accent `#7DE7E1`
- Use `react-native-svg` for vector graphics and inline onboarding illustrations
- Animations via `react-native-reanimated`
- Onboarding uses fade transitions with staggered fade-with-rise entrance (Headspace-inspired)

## Onboarding Flow

13 screens, one question per page, progressive disclosure:
1. Welcome → 2. Age Range → 3. Biological Sex → 4. Location → 5. Skin Goal
→ [if female: 6. Menstrual → 7. Cycle Details] →
8. Supplements → 9. Exercise → 10. Shower Frequency → 11. Hand Washing →
12. Camera Permission → 13. Ready

- Flow is dynamic: `buildOnboardingFlow()` in `src/services/onboardingFlow.ts`
- Each screen uses `OnboardingTransition` wrapper for consistent layout + animations
- Option selection via `OnboardingOptionCard`, `OnboardingGridOption`, `OnboardingChip`
- Dot progress indicator adapts to actual flow length

## Important Context

- Scanner hardware data is **mocked** (no physical Bluetooth scanner)
- Vision API calls fine-tuned GPT-4o via backend proxy (API key server-side only)
- RAG pipeline queries Pinecone for AAD/ACOG guideline context
- Production app with Clerk auth, 188 tests (all passing), deterministic scoring, photo persistence
- Authentication via Clerk is mandatory when CLERK_PUBLISHABLE_KEY is set
- Three user journeys: onboarding, daily scan, report viewing
- Vision API returns detected conditions + RAG-enriched recommendations
- Face mesh visualizes model-identified conditions with zone-specific colors
- On-device photo quality checks via expo-face-detector (fill, centering, angle)
- Gamification system: XP, 6 levels, 15 badges, weekly challenges, personal bests
- Product scanning and baseline scan moved to post-onboarding first-launch actions
