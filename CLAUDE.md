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
      components/     # Reusable UI components (20+ files, includes meshData.ts)
      constants/      # Theme (colors, typography)
      config/         # Environment config, Clerk token cache
      hooks/          # Custom hooks (useFaceTracking)
      services/       # Business logic (16 services + 14 test suites)
      store/          # Zustand state (useStore.ts)
      types/          # TypeScript type definitions
      utils/          # Animation utilities
    backend/          # Express + PostgreSQL API
      app.js          # Express app (routes, middleware) — exported for testing
      server.js       # Server entry point (app.listen + auto-init DB schema)
      db-init.js
      rag.js          # Pinecone RAG pipeline for AAD/ACOG guidelines
      image-processing.js  # Layer 1: Deterministic feature extraction (CIELAB, ITA, GLCM, LBP)
      signal-models.js     # Layer 2: ONNX model inference + score merging
      models/         # ONNX model files (structure, hydration, elasticity, lesion_detector)
      __tests__/      # Backend test suites (vision, rag, integration, signal-models)
    assets/           # Images, fonts
  ml/                 # ML training pipeline
    notebooks/        # Colab notebooks (01-09), export to ONNX
    requirements.txt  # Python ML dependencies
    results/          # Evaluation outputs
```

## Tech Stack

- **Framework:** React Native with Expo SDK 54
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router (file-based)
- **State:** Zustand + AsyncStorage
- **Auth:** Clerk (@clerk/clerk-expo v2)
- **Subscriptions:** RevenueCat (react-native-purchases + react-native-purchases-ui v9.12.0, entitlement: "Glow Pro", 3 free scans)
- **Analytics:** PostHog (posthog-react-native, 20 events across auth/onboarding/scan/paywall/engagement)
- **Vision:** 3-layer parallel pipeline — deterministic image processing + ONNX CV models + fine-tuned GPT-4o (`ft:gpt-4o-2024-08-06:personal:radianceiq-skin:DHBaOo20`)
- **Image Processing:** `sharp` for CIELAB/ITA/GLCM/LBP feature extraction, `onnxruntime-node` (optional) for custom CV models
- **RAG:** Pinecone vector DB + OpenAI embeddings for AAD/ACOG guidelines
- **Backend:** Express.js + PostgreSQL + OpenAI SDK + sharp + onnxruntime-node
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
4. **Results** (`app/scan/results.tsx`): Displays scores, face mesh, signal breakdown, lesion overlay, RAG recommendations

Analysis runs **after** checkin — never with hardcoded context. The `pendingPhotoBase64` store field avoids re-encoding the photo.

## 3-Layer Signal Analysis Pipeline

The vision endpoint (`/api/vision/analyze`) runs 3 layers in **parallel**:

1. **Layer 1 — Deterministic Image Processing** (`backend/image-processing.js`, ~100ms)
   - CIELAB a* erythema mapping (inflammation)
   - ITA variance + spot count (sun damage)
   - Specular reflection analysis (hydration)
   - GLCM texture features + LBP histograms (structure, hydration)
   - Forehead wrinkle energy (elasticity)

2. **Layer 2 — Custom CV Models** (`backend/signal-models.js`, ~200ms)
   - ONNX models: structure (MobileNetV3), hydration (EfficientNet-B0), elasticity (EfficientNet-B0)
   - YOLOv8 lesion detector (comedone, papule, pustule, nodule, macule, patch)
   - Graceful fallback to Layer 1 when models not yet trained

3. **Layer 3 — Fine-tuned GPT-4o** (existing, ~3-5s)
   - Holistic condition classification + severity grading
   - Pattern recognition, personalized feedback, RAG recommendations

Score merging priority: Layer 2 > Layer 1+Layer 3 weighted blend. Response includes `signal_scores`, `signal_features`, `lesions`, `signal_confidence` (all additive, backward compatible).

## Design System

- Dark theme: background `#060B12`, primary accent `#7DE7E1`
- Animations via `react-native-reanimated`
- Onboarding: fade transitions with staggered fade-with-rise entrance (Headspace-inspired)

## Important Context

- Vision API runs 3-layer parallel pipeline: deterministic features + ONNX models + GPT-4o (API key server-side only, 30s timeout)
- RAG pipeline queries Pinecone for AAD/ACOG guideline context
- 286 tests (20 suites), 0 TS errors
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
