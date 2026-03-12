# RadianceIQ - Skin Health Tracking App

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
      onboarding/     # Onboarding flow
      scan/           # Scanning flow
      report/         # Report screens
      product/        # Product detail screens
      signal/         # Signal detail screens
      (tabs)/         # Tab navigation
      skin-metric/    # Skin metric detail
    src/
      components/     # Reusable UI components (13 files)
      constants/      # Theme (colors, typography)
      config/         # Environment config, Clerk token cache
      hooks/          # Custom hooks
      services/       # Business logic (10 services + 6 test suites)
      store/          # Zustand state (useStore.ts)
      types/          # TypeScript type definitions
      utils/          # Animation utilities
    backend/          # Express + PostgreSQL API
      server.js       # API routes + Vision proxy + RAG endpoints
      db-init.js
      rag.js          # Pinecone RAG pipeline for AAD/ACOG guidelines
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

## Design System

- Dark theme: background `#060B12`, primary accent `#7DE7E1`
- Use `react-native-svg` for vector graphics
- Animations via `react-native-reanimated`

## Important Context

- Scanner hardware data is **mocked** (no physical Bluetooth scanner)
- Vision API calls fine-tuned GPT-4o via backend proxy (API key server-side only)
- RAG pipeline queries Pinecone for AAD/ACOG guideline context
- Ship-ready production app with Clerk auth, 120 tests, deterministic scoring, photo persistence
- Authentication via Clerk is mandatory when CLERK_PUBLISHABLE_KEY is set
- Three user journeys: onboarding, daily scan, report viewing
