# RadianceIQ - Product Requirements Document

## Overview
RadianceIQ is a skin health tracking app that enables users to gain insights into their skin health via their phone camera (with optional biophotonic scanner support). The app tracks acne, sun damage, and skin age over time, correlating results with lifestyle factors, product usage, and menstrual cycle data to provide actionable, non-diagnostic insights.

**Hackathon Demo Target:** Fully functional prototype across all 3 user journeys.

---

## Tech Stack

### Frontend
- **React Native (Expo)** - cross-platform mobile app
- Device camera integration (front-facing)
- Flashlight integration (Android/iOS)
- HealthKit/HealthConnect permissions
- Face detection bounding box overlay on camera UI

### Backend
- **PostgreSQL** database
- **Open Beauty Facts API** - skincare product ingredients lookup via barcode
- **Vision LLM API** (Claude/GPT-4V) for skin image analysis (acne, sun damage, suspicious lesions)
- **RAG-enabled model** connected to AAD (American Academy of Dermatology) and ACOG guidelines
- Scanner data: **mocked/simulated** (no physical Bluetooth scanner)

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

## Implementation Status (as of 2026-03-07)

### Completed
- All 3 user journeys fully implemented (onboarding, daily scan, report)
- 19 screen files, 8 components, 3 services, Zustand store, Express+PostgreSQL backend
- Simulated scanner data with realistic UX (discovery, pairing, readings, connection loss)
- Skin analysis engine with contextual action recommendations
- Demo data seeder (14 days of scan history)
- Web + iOS bundles compile clean, TypeScript 0 errors

### Known Issues Resolved
- **react-native-worklets**: Added as dependency (required by react-native-reanimated v4 on web)
- **Infinite re-render loop on web**: React 19 + Zustand v5 `useSyncExternalStore` conflict — fixed by deferring store hydration and using primitive selectors instead of object selectors

### Not Yet Wired (stretch goals)
- Vision LLM API calls (analysis logic present, API call stubbed)
- HealthKit/HealthConnect device-build integration is wired, but denied/blocked flow QA is still pending; Expo Go support remains unavailable by design
- RAG pipeline with AAD/ACOG guidelines
- Real barcode scanning via expo-barcode-scanner
- Photo persistence & representative photo display in reports

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
- Health integrations are configured for iOS/Android native builds and are not fully supported in Expo Go.
- UX surfaces explicit unavailable/unsupported messaging when health APIs are not accessible.
- Denied/blocked recovery UI is present, but final device-level QA remains pending.

### State model additions
- `camera_permission_status` is persisted on the user profile.
- `health_connection` is persisted with normalized status/state metadata covering source, requested/granted types, sync skip state, and timestamps.

### Compliance guardrails
- Health access is always optional for onboarding completion and first baseline result.
- Permission rationale copy is shown before prompts.
- Denial paths avoid dead ends and provide a settings-recovery action where available.

## UX Plan Completion Verification

To ensure the frontend UX plan is tracked and auditable, the execution checklist is maintained in `ux_progress.txt`.

- The UX tracker maps completion status to each major journey and interaction design objective.
- MVP-critical UX flows are marked complete; placeholders and stretch integrations are explicitly called out as in-progress or pending.
- This separation prevents stretch-goal gaps from being mistaken as core plan failures during demo readiness reviews.
