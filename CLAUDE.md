# Glowlytics - Skin Health Tracking App

## Project Structure

```
cornell-hackathon/
  prd.md              # Product requirements document
  progress.txt        # Build progress log
  RadianceIQ/         # Main app (Expo + React Native)
    app/              # Expo Router screens (file-based routing)
      _layout.tsx
      index.tsx       # Bridge screen (minimal, splash is in _layout.tsx)
      home.tsx
      skin-metrics.tsx
      auth/           # Auth screens (sign-in, sign-up, forgot-password)
      onboarding/     # Onboarding flow (16 screens, progressive disclosure + scan-reminder + paywall)
      scan/           # Scanning flow (camera → analyzing → results)
      report/         # Report screens (premium-gated)
      product/        # Product detail screens
      paywall.tsx     # RevenueCat native paywall (inline component)
      signal/         # Signal detail screens
      (tabs)/         # Tab navigation (today, products, camera, reports, profile)
      skin-metric/    # Skin metric detail
    src/
      components/     # Reusable UI components (24 files, includes meshData.ts)
      constants/      # Theme (colors, typography)
      config/         # Environment config, Clerk token cache
      hooks/          # Custom hooks (useFaceTracking)
      services/       # Business logic (19 services)
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
- **Subscriptions:** RevenueCat (react-native-purchases + react-native-purchases-ui v9.12.0, entitlement: "Glow Pro", 7-day free trial)
- **Notifications:** expo-notifications (daily scan reminders, configurable time picker)
- **Analytics:** PostHog (posthog-react-native, 20 events across auth/onboarding/scan/paywall/engagement)
- **Vision:** 3-layer parallel pipeline — deterministic image processing + ONNX CV models + fine-tuned GPT-4o (`ft:gpt-4o-2024-08-06:personal:radianceiq-skin:DHBaOo20`)
- **Camera:** react-native-vision-camera with MLKit face detection frame processor (replaced deprecated expo-face-detector)
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

Camera → Analyzing → Results

1. **Camera** (`app/scan/camera.tsx`): VisionCamera with MLKit frame processor for real-time face tracking (~15ms/frame), quality checks, auto-capture after 2s aligned, **real-time on-device lesion detection** (YOLOv8 via `onDeviceLesionDetection` service, teal bounding box overlay every 1.2s while aligned, filtered to face region only)
2. **Analyzing** (`app/scan/analyzing.tsx`): Pre-encodes photo to base64 if needed, runs `analyzeWithFallback`, 9-stage progress animation, stores results + awards XP
3. **Results** (`app/scan/results.tsx`): Displays scores, face mesh, signal breakdown, lesion overlay, RAG recommendations

**Known limitation:** Analyzing hardcodes `sunscreen_used: false` and `new_product_added: false` in dailyContext since the checkin screen was removed. These context fields should be collected before analysis in a future iteration.

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
   - YOLOv8 lesion detector (comedone, papule, pustule, nodule, macule, patch) with NMS post-processing
   - Models downloaded via `backend/scripts/download-models.sh` from HuggingFace (`mufasabrownie/glowlytics-skin-models`)
   - Handcrafted features: Gabor (24-dim), LBP-uniform (18-dim), Frangi (9-dim), landmark geometry (5-dim)
   - `image-processing.js` builds hydration (44-dim) and elasticity (14-dim) feature vectors for Layer 2
   - Graceful fallback to Layer 1 when models not available

3. **Layer 3 — Fine-tuned GPT-4o** (existing, ~3-5s)
   - Holistic condition classification + severity grading
   - Pattern recognition, personalized feedback, RAG recommendations

Score merging priority: Layer 2 > Layer 1+Layer 3 weighted blend. Response includes `signal_scores`, `signal_features`, `lesions`, `signal_confidence` (all additive, backward compatible).

## Design System

- Light theme: background `#FAFAF7` (warm cream), primary accent `#3A9E8F` (teal)
- Dark gradient backgrounds on scan/analyzing screens: `#060B12` → `#6B8799` → `#081522`
- Animations via `react-native-reanimated`
- Onboarding: fade transitions with staggered fade-with-rise entrance (Headspace-inspired)
- Tab bar: floating pill with SVG notch cutout, glass fill `rgba(255,255,255,0.93)`, camera button absolutely positioned above with teal glow
- Splash screen: animated G logo glow reveal (scale+fade → teal bloom → wordmark rise), 1.5s minimum display

## Important Context

- Vision API runs 3-layer parallel pipeline: deterministic features + ONNX models + GPT-4o (API key server-side only, 30s timeout)
- Fast lesion detection endpoint: `POST /api/vision/detect-lesions` (public, rate-limited, runs only YOLOv8)
- On-device lesion detection: `src/services/onDeviceLesionDetection.ts` — runs on camera frames during alignment (confidence threshold 0.1, NMS IoU 0.45)
- Real-time bounding boxes: `LesionOverlay.tsx` — teal sci-fi corner brackets with scanning line animation, crop-aware coordinate transform (accounts for CameraView center-crop), face-rect filtering (only shows lesions within detected face + 15% margin)
- RAG pipeline queries Pinecone for AAD/ACOG guideline context
- Splash screen: `SplashScreen` component in `_layout.tsx` — animated G logo + teal glow bloom + wordmark, 1.5s min via `Promise.all` with init, masks loading time
- `app/index.tsx` is now a minimal bridge screen (cream background) — the old landing page with safety card was removed
- Tab bar: `NotchedTabBar.tsx` — SVG notch path (10px depth, 74px width), camera absolutely positioned via `cameraAnchor`, tabs layout has no sceneStyle (tab bar floats over content)
- Lesion constants: `src/constants/lesions.ts` — 6 lesion classes with descriptions, colors, zone definitions
- 340 tests (22 suites: 228 frontend + 112 backend), 0 TS errors
- Authentication via Clerk is mandatory when CLERK_PUBLISHABLE_KEY is set
- Backend authorization: all POST/GET/DELETE endpoints use `req.auth.userId` — never trust `body.user_id`
- Backend security: CORS via `CORS_ORIGINS`, rate limiting on public + vision/analyze endpoints, `safeErrorMessage()` hides PG details in production, timing-safe admin secret, transactional cascading deletes
- Account deletion: `DELETE /api/users/:id` — atomic cascade across all tables (Apple 5.1.1(v))
- DB schema: `user_id` is TEXT (Clerk ID), not UUID. Migration v2 handles UUID→TEXT conversion.
- Face tracking: react-native-vision-camera + react-native-vision-camera-face-detector (MLKit GPU frame processor). Thresholds in faceTracking.ts and photoQuality.ts: 20% min fill, 15deg max angle
- Gamification system: XP, 6 levels, 15 badges, weekly challenges, personal bests
- Subscription model: 7-day free trial (started on onboarding skip), then paywall. No free scan counter.
- Trial state: `trial_start_date`, `trial_end_date` in SubscriptionState; `isTrialActive()`, `trialDaysRemaining()`, `canScan()` in subscription service
- RevenueCat Error 23 (CONFIGURATION_ERROR) silenced in `initRevenueCat()` — SDK already configured
- Onboarding paywall: `app/onboarding/paywall.tsx` — inline RevenueCatUI.Paywall, skip starts trial
- `useFaceTracking` hook wraps VisionCamera frame processor; exposes `trackingState`, `lastFrameUri`, `lastFrameWidth`, `lastFrameHeight` for crop-aware lesion overlay coordinate mapping
- RevenueCat functions guard on `env.REVENUECAT_API_KEY` — all are safe to call without a key
- PostHog analytics guard on `env.POSTHOG_API_KEY` — all no-op when key is empty
- Subscription state persisted in Zustand: tier, is_active, expires_at, product_id, free_scans_used, trial_start_date, trial_end_date
- Scan gating: camera tab, camera screen, home scan buttons, skin-metrics → paywall if trial expired and not subscribed
- Report gating: reports require active subscription
- Profile screen: subscription card with trial days remaining or upgrade/manage, notification settings, Customer Center for active subscribers
- Daily scan notifications: `src/services/notifications.ts` — `scheduleDailyReminder(h, m)`, `cancelDailyReminder()`, configurable in onboarding + profile
- Products tab: `app/(tabs)/products.tsx` — full product management with routine score ring, ProductCard list, AddProductSheet (search/barcode/manual), FAB
- Components: `ProductCard.tsx` (effectiveness ring, usage badge), `AddProductSheet.tsx` (modal bottom sheet with 3 add modes)
- Model download: `backend/scripts/download-models.sh` fetches ONNX files from HuggingFace
- Lesion export: `ml/export_lesion_onnx.py` converts YOLOv8 .pt → .onnx
