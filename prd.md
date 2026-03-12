# RadianceIQ - Product Requirements Document

## Overview
RadianceIQ is a skin health tracking app that enables users to gain insights into their skin health via their phone camera (with optional biophotonic scanner support). The app tracks acne, sun damage, and skin age over time, correlating results with lifestyle factors, product usage, and menstrual cycle data to provide actionable, non-diagnostic insights.

**Production v1.0 Target:** App Store-ready release with authentication, validated scoring algorithms, and backend data sync.

---

## Tech Stack

### Frontend
- **React Native (Expo SDK 54)** - cross-platform mobile app
- Device camera integration (front-facing)
- Flashlight integration (Android/iOS)
- HealthKit/HealthConnect permissions (mocked for Expo Go, native for EAS builds)
- Face detection bounding box overlay on camera UI

### Backend
- **Express.js** API server with JWT authentication middleware
- **PostgreSQL** database
- **Open Beauty Facts API** - skincare product ingredients lookup via barcode (waterfall: Open Beauty Facts → Open Food Facts → UPCitemdb → NIH DailyMed)
- **Vision LLM API** (Claude/GPT-4V) for skin image analysis (optional, with local fallback)
- **RAG-enabled model** connected to AAD (American Academy of Dermatology) and ACOG guidelines (planned)
- Scanner data: **deterministic simulation** with seeded PRNG for reproducible readings

### Authentication & Authorization
- **Provider:** Clerk (3rd-party OAuth service)
- **Sign-in methods:** Sign in with Apple, Sign in with Google, Email/Password
- **Session management:** Clerk JWT tokens, SecureStore for token persistence
- **Backend auth:** JWT verification via Clerk JWKS endpoint
- **Required compliance:** Apple App Store Review Guidelines 4.0 (Sign in with Apple required when offering other social logins)

### Internal Prompt Rules (for LLM analysis)
- Product usage data (from Open Beauty Facts API) + start dates
- HealthKit/HealthConnect data (cycles, sleep, HRV, RHR, etc.)
- Outputs of image classification (Vision LLM)
- Trend of outputs from past 30 days
- User demographic + onboarding information

---

## User Journeys

### Journey 1: First-Time Setup to Baseline (2-4 minutes)
**Goal:** Get to first results with minimal typing; everything else is optional.

#### Step 1 - Welcome + Safety Framing
- "Measures skin metrics + trends. Not diagnostic."
- CTA: **Start**

#### Step 2 - Essentials
- Age (tap selector)
- Coarse location: "Enable location" OR "Enter ZIP"
- Period basics:
  - "Do you get periods?" Yes / No / Prefer not to say
  - If yes: last period start date + typical cycle length (default 28)
- CTA: **Continue**

#### Step 3 - Primary Goal (drives defaults)
- Pick one: Acne / Sun Damage / Skin Age
- CTA: **Next**

#### Step 4 - Region Selection (recommended then confirm)
- App recommends scanning region based on goal:
  - Acne: "Where is it worst?" (forehead/cheeks/jawline/mixed) -> recommend that region
  - Sun damage: recommend upper cheek/temple (or whole face)
  - Skin age: recommend crow's feet/under-eye/cheek texture zone
- User can tap to change region on face map
- CTA: **Confirm scanning area**

#### Step 5 - Products (no typing)
- Options: Scan barcode / Take product photo / Search (fallback)
- After capture: show matched product + ingredients + usage frequency (AM/PM)
- CTA: **Done** (always allow **Skip for now**)

#### Step 6 - Guided Baseline Scan
- Scanner reading: simulated live prompt "Hold steady" + success confirmation
- Photo capture coaching:
  - On-screen outline to match framing
  - Live checks: centered / lighting OK / blur OK / angle match
  - If fail: single tip ("Turn toward light", "Move closer", etc.)
- CTA: **Save baseline**

#### Step 7 - Baseline Results
- 3 tiles: Acne / Sun damage / Skin age (baseline values)
- "Trend starts after 3 scans"
- CTA: **Set daily reminder** (optional)

#### Step 8 - Boost Accuracy (optional progressive profiling)
- "Improve insights with 30 seconds of context. Skip anytime."
- Quick toggles (optional):
  - Smoker: Yes/No
  - Drink frequency: 0 / 1-2 / 3+
- Connect device (optional):
  - Apple Health / wearable via HealthKit & HealthConnect
  - Sleep quality (yesterday): Poor/OK/Great
  - Stress (yesterday): Low/Med/High
- CTA: **Done / Skip**

---

### Journey 2: Daily Scan to Results to 1 Action (30-60 seconds)
**Goal:** Daily usage is frictionless; context is auto when possible.

#### Step 1 - Home
- CTA: **Today's Scan**
- Streak + last score snapshot

#### Step 2 - Scan
- "Scan the same region: [region name]"
- Scanner reading (simulated, quick)
- Photo capture with baseline overlay + live quality check

#### Step 3 - Daily Quick Check-in (ultra minimal)
Always ask:
- Sunscreen today? Yes/No
- Any new product since yesterday? Yes/No
- Period status: auto-estimated ("Day 18") -> user taps **Accurate / Not accurate**

Optional context (non-blocking):
- If device connected: show sleep + stress proxy auto-filled with "edit" option
- If not connected: expandable "Add context (optional)":
  - Sleep: Poor/OK/Great
  - Stress: Low/Med/High
  - Drinks yesterday: 0 / 1-2 / 3+

CTA: **See results**

#### Step 4 - Results + 1 Best Next Step
- 3 scores with: today value, delta vs baseline, 7-day sparkline
- Confidence indicator (low/med/high)
- One action card (never more than one):
  - Acne up during cycle window -> "Likely cycle-related; keep routine stable"
  - Sun damage up + no sunscreen -> "Add sunscreen daily (AM)"
  - Skin age plateau -> "Maintain consistency; consider adding [ingredient type]"
- CTA: **Log done / Remind me tomorrow**

---

### Journey 3: Share Report (clinician-ready export)
**Goal:** Produce a credible, structured packet from trends + context.

#### Step 1 - Share Report
- Select time range: 7 / 14 / 30 days

#### Step 2 - Report Preview (auto-generated)
Includes:
- User summary: age range + coarse location
- Scan protocol: region + daily cadence + confidence stats
- Trend charts: Acne / Sun damage / Skin age scores
- Representative photos (first / middle / last) + timestamps
- Products used + ingredients + start/stop dates
- Context overlays (if available):
  - Period window markers
  - Sunscreen adherence
  - Sleep/stress trend
- Footer: "Non-diagnostic metrics; for clinician interpretation."

#### Step 3 - Share
- Export PDF / share link / email (prototype can stub with preview)

---

## Device Connection Flow (Simulated for Hackathon)

Since no physical scanner is available, the device connection flow will be **simulated**:
- Mock "Connect scanner" gate screen with simulated discovery
- Simulated Bluetooth pairing animation
- Mock scanner readings with realistic data
- "Scanner busy" and "Connection lost" states available for demo
- Disconnect/handoff flow after scan completion

### Data Association Rule
- Every scan session attached to current user's profile and selected face region
- Scanner transmits measurements but does not store identity
- App stores: scan_timestamp, region, scanner_quality, and user context

---

## Data Schema

### 1) User Profile (one-time + editable)
| Field | Type | Required |
|-------|------|----------|
| user_id | UUID | Yes |
| age_range | string | Yes |
| location_coarse | string (ZIP3/city) | Yes |
| period_applicable | enum (yes/no/prefer_not) | Yes |
| period_last_start_date | date | If applicable |
| cycle_length_days | int (default 28) | If applicable |
| smoker_status | bool | No |
| drink_baseline_frequency | string | No |
| wearable_connected | bool | No |
| wearable_source | string | No |

### 2) Scan Protocol (one-time per program)
| Field | Type | Required |
|-------|------|----------|
| protocol_id | UUID | Yes |
| user_id | UUID | Yes |
| primary_goal | enum (acne/sun_damage/skin_age) | Yes |
| scan_region | string | Yes |
| scan_frequency | string (daily) | Yes |
| baseline_date | date | Yes |

### 3) Product Catalog Entry (per user product)
| Field | Type | Required |
|-------|------|----------|
| user_product_id | UUID | Yes |
| user_id | UUID | Yes |
| product_name | string | Yes |
| product_capture_method | enum (barcode/photo/search) | Yes |
| ingredients_list | text[] | Yes |
| usage_schedule | enum (AM/PM/both) | Yes |
| start_date | date | Yes |
| end_date | date | No |
| notes | string | No |

### 4) Daily Record (one row per day)
| Field | Type | Required |
|-------|------|----------|
| daily_id | UUID | Yes |
| user_id | UUID | Yes |
| date | date | Yes |
| scanner_reading_id | UUID | Yes |
| scanner_indices | JSON (inflammation, pigmentation, texture) | Yes |
| scanner_quality_flag | enum (pass/warn/fail) | Yes |
| scan_region | string | Yes |
| photo_uri | string | No |
| photo_quality_flag | enum (pass/warn/fail) | No |
| photo_angle_match_score | float | No |
| photo_lighting_score | float | No |
| sunscreen_used | bool | Yes |
| new_product_added | bool | Yes |
| period_status_confirmed | enum (accurate/not_accurate) | Yes |
| cycle_day_estimated | int | No |
| sleep_quality | enum (poor/ok/great) | No |
| stress_level | enum (low/med/high) | No |
| drinks_yesterday | string | No |
| sleep_duration_minutes | int | No |
| resting_hr | int | No |
| hrv | int | No |
| steps | int | No |

### 5) Model Outputs (per day)
| Field | Type | Required |
|-------|------|----------|
| output_id | UUID | Yes |
| daily_id | UUID | Yes |
| acne_score | int (0-100) | Yes |
| sun_damage_score | int (0-100) | Yes |
| skin_age_score | int (0-100 or years) | Yes |
| confidence | enum (low/med/high) | Yes |
| primary_driver | string | No |
| recommended_action | string | Yes |
| escalation_flag | bool | Yes |

### 6) Report Artifact (generated on demand)
| Field | Type | Required |
|-------|------|----------|
| report_id | UUID | Yes |
| user_id | UUID | Yes |
| date_range | string | Yes |
| included_fields | string[] | Yes |
| report_uri | string | Yes |
| shared_at | timestamp | No |

---

## Results Explanation Templates

### Template A: Acne Tile
- **Improving + high confidence:** "Your acne metric is improving compared to your baseline. Routine adherence has been consistent, and there were no major confounders detected."
- **Worse + period window:** "Your acne metric rose during your predicted cycle window. This pattern often reflects hormonal variation. Consider keeping your routine stable for the next few days and avoid introducing new actives."
- **Worse + new product:** "Acne metric worsened soon after a new product was introduced. This may be a confounding change. Consider pausing the new product to isolate what's driving the shift."
- **Worse + poor sleep/stress:** "Acne metric increased on days with lower sleep / higher stress signals. This may indicate lifestyle-driven fluctuation rather than a product effect."

### Template B: Sun Damage Tile
- **No sunscreen + worse:** "Sun damage metric increased alongside low sunscreen use. The highest-impact change is daily AM sunscreen and reapplication on high-exposure days."
- **High UV location:** "Given your location, UV exposure is likely elevated right now. Protective steps (sunscreen + shade) will have outsized impact."

### Template C: Skin Age Tile
- **Texture improving:** "Skin age metric improved primarily due to texture/roughness changes compared to baseline."
- **Plateau + low adherence:** "Skin age metric hasn't shifted meaningfully yet. Inconsistent routine adherence can slow visible change -- consider simplifying to improve consistency."

### Escalation Language (non-diagnostic)
- "Your metrics changed rapidly and the trend is unusual for your baseline. This isn't a diagnosis, but it may be worth sharing a report with a clinician for context."

---

## Scoring Algorithms

### Design Principles
- All scores are deterministic given the same inputs (no randomness)
- Weights are grounded in established dermatology assessment methodologies
- Scores range 0-100 where higher = worse condition
- Context modifiers (sleep, stress, cycle) use evidence-based effect sizes

### Primary Score Derivation

#### Acne Score
Base = inflammation_index × 0.65 + texture_index × 0.20 + pigmentation_index × 0.15
- Weight rationale: GAGS (Global Acne Grading System) correlates inflammatory lesions as primary (~65%), comedonal texture secondary (~20%), PIH residual (~15%)
- Context modifiers: poor sleep (+6), high stress (+8), late luteal phase (+10), early follicular (+5), no sunscreen (+3), new product (+4)

#### Sun Damage Score
Base = pigmentation_index × 0.70 + inflammation_index × 0.15 + texture_index × 0.15
- Weight rationale: UV-induced pigmentation is primary photoaging marker (~70%), erythema (~15%), texture degradation (~15%)
- Context modifiers: no sunscreen (+8), poor sleep (+2), high stress (+3)

#### Skin Age Score
Base = texture_index × 0.55 + pigmentation_index × 0.25 + inflammation_index × 0.20
- Weight rationale: VISIA-type analysis prioritizes texture/roughness (~55%), solar lentigines (~25%), chronic inflammation (~20%)
- Context modifiers: no sunscreen (+4), poor sleep (+5), high stress (+3)

### Composite Signals (Overall Skin Health)
5 signals weighted to produce overall score:
- Structure (22%): inverse of texture + age risk
- Hydration (18%): inverse of texture + acne risk + lifestyle penalties
- Inflammation (20%): inverse of inflammation + acne risk
- Sun Damage (20%): inverse of sun + pigmentation risk
- Elasticity (20%): inverse of age + texture risk

### Confidence Levels
- Low: < 3 scans (insufficient data for trend)
- Medium: 3-6 scans (emerging pattern)
- High: 7+ scans (reliable trend established)

### Escalation Threshold
- Flag triggered when any primary score changes > 20 points from previous reading
- Triggers non-diagnostic advisory: "Consider sharing a report with a clinician"

---

## Apple App Store Compliance

### Human Interface Guidelines (HIG)
- All screens use SafeAreaView for proper inset handling
- Dark mode as primary with proper contrast ratios (WCAG AA minimum 4.5:1)
- Minimum touch target: 44x44pt per Apple HIG
- Native navigation patterns: back gestures, sheet presentations for modals
- Haptic feedback on key interactions (scan complete, score reveal)

### Health App Requirements
- Non-diagnostic disclaimer on every results screen and in onboarding
- Clear "This is not medical advice" language per App Store Review Guidelines 1.4.1
- Privacy policy URL required (linked in app settings and App Store listing)
- Data collection transparency: what data is collected, how it's used, how to delete
- No claims of diagnosis, treatment, or cure

### App Store Technical Requirements
- EAS Build for native binary generation
- Bundle identifier: com.radianceiq.app (production)
- Associated domains for Clerk universal links
- Privacy nutrition labels in App Store Connect
- Sign in with Apple required (when offering Google sign-in)

### Accessibility
- VoiceOver labels on all interactive elements
- Minimum contrast ratio 4.5:1 for all text

---

## Data Privacy & Security
- All auth via Clerk (no passwords stored in our database)
- JWT tokens stored in device SecureStore (not AsyncStorage)
- Backend validates JWT on every authenticated request
- User data scoped by Clerk user ID
- Health data is never shared with third parties
- Users can request full data deletion (GDPR/CCPA compliance)
- Camera photos stored locally on device only
- No analytics or tracking without explicit consent

---

## Implementation Status (as of 2026-03-12)

### Completed (Ship-Ready)
- All 3 user journeys fully implemented (onboarding, daily scan, report)
- **Mandatory auth flow** with Clerk sign-in gate, forgot password, sign-out
- **Auth token wiring** — Clerk getToken() injected into API client on app startup
- **Animated auth screens** with Headspace-inspired staggered entrances, error shake, success haptics
- **Clerk authentication** with Sign in with Apple, Google, and Email/Password
- **Vision API** — fine-tuned GPT-4o (`ft:gpt-4o-2024-08-06:personal:radianceiq-skin:DHBaOo20`) via backend proxy; API key server-side only
- **RAG pipeline** — Pinecone vector DB with 18 curated AAD/ACOG guideline chunks, semantic search via OpenAI text-embedding-3-small
- **Product intelligence** with 45-ingredient knowledge base, personalized effectiveness scoring, detail views
- **Signal detail screens** with animated gauges, trend charts, personalized recommendations
- **Photo persistence** — scan photos saved to documentDirectory, stored in DailyRecord.photo_uri
- **Representative photos in reports** — first/middle/last photos from selected time range
- **Privacy policy** — in-app screen (BDQ Holdings LLC, GDPR/CCPA, 11 sections)
- **Deterministic scoring algorithms** with validated dermatology heuristics (no Math.random())
- **Typed API service layer** wiring frontend to Express+PostgreSQL backend
- **Backend auth middleware** with JWT verification via Clerk JWKS
- **SQL injection fix** on PATCH /api/users/:id (field whitelisting)
- **Seeded PRNG** for reproducible scanner simulation in tests
- **EAS build configuration** in app.json
- **App Store metadata** — description, keywords, screenshot specs for iPhone 15 Pro Max
- **Demo script** — 7-minute structured walkthrough with talking points
- **120 unit tests** across 10 suites (scoring, insights, scanner, product lookup, ingredient DB, signal history)
- 38 screen files, 13 components, 10 services, 5 backend files, Zustand store
- iOS simulator running clean on Expo Go SDK 54

### SDK Migration (SDK 55 → 54)
- Downgraded to Expo SDK 54 (`expo ~54.0.0`, `react 19.1.0`, `react-native 0.81.5`)
- All expo-* packages aligned via `npx expo install --fix`
- Removed native health packages — replaced with pure mock in `src/services/healthPermissions.ts`
- App bundles and runs in Expo Go SDK 54 (1305 modules, <1s bundle)

### Known Issues Resolved
- **NitroModules crash in Expo Go**: Fixed by removing native packages entirely
- **Infinite re-render loop on web**: Fixed by deferring store hydration
- **Non-deterministic scoring**: Removed all Math.random() from analysis engine
- **SQL injection in user PATCH**: Fixed with field whitelisting
- **WorkletsError mismatch**: Pinned react-native-worklets to 0.5.1 with override
- **Duplicate navigator**: AuthGatedContent replaced with AuthRedirector (Redirect-only)

### Remaining Work (App Store Submission)
- **EAS Build**: `eas build --platform ios` to produce native .ipa binary
- **Apple Developer Account**: active enrollment required ($99/year)
- **App Store Connect**: create app record, upload binary, fill metadata from `app-store-metadata.json`
- **Screenshots**: capture 5 screens on iPhone 15 Pro Max simulator (1290x2796)
- **Privacy policy URL**: host the in-app policy content at a public URL (required by App Store)
- **Backend deployment**: deploy Express server to production host (Railway/Render/Fly.io) with production env vars
- **Seed Pinecone**: run POST /api/rag/seed on production backend
- **TestFlight**: upload build, internal testing, smoke test all 3 journeys
- **Legal review**: recommended before public launch (privacy policy, health disclaimers)
- **Submit for App Review**

### Deferred (post-launch)
- HealthKit/Health Connect native integration (requires EAS bare workflow)
- Push notifications for scan reminders
- PDF export for clinician reports (currently stub)

---

## Onboarding & Permissions Implementation Update (Current)

### Actual onboarding order (implemented)
1. Essentials
2. Goal
3. Region
4. Products
5. Permissions prep
6. Baseline scan
7. Accuracy/boost

### Permission timing and scope
- **Camera:** Requested in-context at baseline scan start, treated as required for scan capture, and persisted on the user profile.
- **HealthKit / Health Connect:** Introduced in a dedicated pre-scan education step and remains optional/non-blocking.
- **v1 health scope (read-only):** sleep, resting heart rate, and heart-rate variability.
- **Deferred from health sync in v1:** cycle/menstrual data (remains self-entered in onboarding).

### Native build constraint
- Native health packages removed for Expo Go compatibility; health data is fully mocked.
- UX surfaces explicit unavailable/unsupported messaging when health APIs are not accessible.
- Real HealthKit/Health Connect integration deferred to EAS/bare workflow builds.

### State model additions
- `camera_permission_status` is persisted on the user profile.
- `health_connection` is persisted with normalized status/state metadata covering source, requested/granted types, sync skip state, and timestamps.

### Compliance guardrails
- Health access is always optional for onboarding completion and first baseline result.
- Permission rationale copy is shown before prompts.
- Denial paths avoid dead ends and provide a settings-recovery action where available.

## Authentication Flow

### Redirect Logic
- **Root layout** (`app/_layout.tsx`) contains `AuthRedirector` component that returns only `<Redirect>` components or `null` — never its own navigator
- When Clerk is configured:
  - `!isLoaded` → animated splash (index.tsx)
  - `!isSignedIn` → redirect to `/auth/sign-in`
  - `isSignedIn` + `!onboarding_complete` → redirect to `/onboarding/essentials`
  - `isSignedIn` + `onboarding_complete` → render normal tab navigation
- When Clerk is not configured: demo mode with onboarding/demo buttons

### Screen Inventory
- `app/auth/sign-in.tsx` — email/password + OAuth (Apple, Google) with staggered entrance animations
- `app/auth/sign-up.tsx` — account creation with email verification + 60s countdown timer
- `app/auth/forgot-password.tsx` — password reset via Clerk reset_password_email_code strategy
- `app/auth/_layout.tsx` — fade_from_bottom transitions, 400ms duration

### Animation Specs (Headspace-inspired)
- Staggered entrance: 400-600ms per element, `Easing.out(Easing.cubic)`
- Error shake: `withSequence(-6, 6, -3, 0)` on error container translateX
- Success: content fade out (400ms), orb scale to 1.2, haptic notification
- Orb entrance: scale 0.3→1 over 800ms, glow pulse with 2s cycle
- Shared animation utilities in `src/utils/animations.ts`

### Dependencies
- `expo-haptics` for success feedback

---

## Product Intelligence

### Ingredient Knowledge Base
- `src/services/ingredientDB.ts` contains ~45 ingredient profiles
- Categories: retinoid, AHA, BHA, antioxidant, humectant, emollient, sunscreen_active, peptide, surfactant, preservative, fragrance, other
- Each profile includes: clinical efficacy (0-100), side effect risk (0-100), goal relevance, signal relevance, description, evidence citation

### Effectiveness Scoring Algorithm
1. Base score: 50
2. Per-ingredient: `clinicalEfficacy * goalRelevance[goal] / 500` (scaled -5 to +10)
3. Side effect penalty: `sideEffectRisk * 0.08` per concerning ingredient
4. Personalization: +3 bonus when ingredient helps a struggling signal (<50), -3 extra penalty when ingredient hurts a struggling signal
5. Goal alignment bonus: +8 when 2+ goal-relevant ingredients present
6. Fragrance penalty: -5 unconditional
7. Clamped 0-100

### Product Detail View
- `app/product/[id].tsx` — full ingredient breakdown, goal alignment, usage tips, related signals
- Effectiveness badges shown on profile and onboarding product lists
- Color coding: >=75 success, >=55 primary, >=35 warning, <35 error

---

## Signal Detail Screens

### Five Signals
| Signal | Color | Primary Weights |
|--------|-------|-----------------|
| Structure | `#7DE7E1` | texture_index 55%, skin_age 45% |
| Hydration | `#4DA6FF` | texture_index 50%, acne 20%, stress/sleep |
| Inflammation | `#FF7A78` | inflammation_index 80%, acne 20% |
| Sun Damage | `#F2B56A` | sun_damage 82%, pigmentation 18% |
| Elasticity | `#B68AFF` | skin_age 62%, texture_index 38% |

### Signal Detail Screen (`app/signal/[key].tsx`)
- Large animated SVG arc gauge (280px, signal-colored)
- Contributing factor bars showing weight distribution
- 14-day trend line chart from `computeSignalHistory()`
- Personalized recommendations based on level (Poor/Fair/Good/Excellent)
- Related products filtered by signal relevance

### Home Integration
- Signal rings on home screen are tappable → navigate to signal detail
- Tap any ring to see full breakdown, history, and recommendations

---

## UX Plan Completion Verification

To ensure the frontend UX plan is tracked and auditable, the execution checklist is maintained in `ux_progress.txt`.

- The UX tracker maps completion status to each major journey and interaction design objective.
- MVP-critical UX flows are marked complete; placeholders and stretch integrations are explicitly called out as in-progress or pending.
- This separation prevents stretch-goal gaps from being mistaken as core plan failures during demo readiness reviews.
