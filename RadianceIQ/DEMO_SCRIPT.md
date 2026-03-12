# RadianceIQ -- Demo Script

**Total runtime:** ~7 minutes
**Target audience:** Investors, judges, clinicians, prospective users

---

## 1. Opening (0:00 - 0:30)

**Action:** Launch the app from the home screen.

**Talking points:**
- "RadianceIQ turns your daily skincare routine into measurable, clinician-grade data."
- The animated splash screen sets the tone -- this is a polished, production-quality product.
- Point out the dark theme with teal accent palette, designed for morning routines in low light.

**Key highlight:** The atmospheric gradient background and smooth transitions signal design quality from the first second.

---

## 2. Authentication (0:30 - 1:00)

**Action:** Show the sign-in screen. Demo email login or tap Apple Sign-In.

**Talking points:**
- "We use Clerk for enterprise-grade authentication -- Apple Sign-In, Google, and email with magic links."
- Auth is mandatory; no anonymous usage. This protects user data and enables secure cloud sync.
- Point out the clean form design, password visibility toggle, and forgot-password flow.

**Key highlight:** Authentication is production-ready with Clerk JWT tokens flowing to our Express backend.

---

## 3. Onboarding (1:00 - 3:00)

**Action:** Walk through the full onboarding flow step by step.

### 3a. Essentials (30s)
- Select age range, location, and cycle tracking preference.
- "These demographic signals let us personalize scoring weights -- a 22-year-old's acne baseline is different from a 45-year-old's."

### 3b. Goal Selection (15s)
- Choose primary concern: acne, sun damage, or skin aging.
- "The chosen goal determines which scoring framework we prioritize -- GAGS for acne, VISIA-inspired metrics for sun damage."

### 3c. Region Selection (15s)
- Select a scan region (whole face, forehead, cheek, etc.).
- "Consistent region targeting is critical for reproducible measurements."

### 3d. Product Entry (30s)
- **Scan a barcode** to add a product. Show the camera overlay.
- The product auto-populates name, brand, and ingredient list.
- "We use a waterfall lookup: Open Food Facts, Open Beauty Facts, then Cosmily, with UPC Database as fallback."
- Show manual search as an alternative entry method.
- Set usage schedule (AM/PM/both) and start date.

### 3e. Permissions (15s)
- Grant camera access and optionally connect Apple Health (sleep, HRV, resting heart rate).
- "Health context overlays let us correlate skin changes with sleep quality and stress signals."

**Key highlight:** Barcode scanning with multi-source product intelligence. One scan gives you full ingredient transparency.

---

## 4. First Scan -- Baseline (3:00 - 4:00)

**Action:** Trigger the baseline scan from onboarding.

**Talking points:**
- Show the camera overlay with face guide. "The overlay ensures consistent framing and lighting across every scan."
- The scanner animation plays while we process the image.
- "Behind the scenes, we run deterministic scoring algorithms -- GAGS, SCORAD, and VISIA-inspired heuristics -- on the scanner indices."
- Results appear as five signal rings on the home screen: Structure, Hydration, Inflammation, Sun Damage, Elasticity.

**Key highlight:** Deterministic means no random noise. Same input always produces the same score. This is critical for tracking real change over time.

---

## 5. Daily Usage / Home Screen (4:00 - 5:00)

**Action:** Load demo data from the Profile tab (Load Demo Data button), then navigate to the home screen.

**Talking points:**
- "With 14 days of simulated data loaded, you can see the full experience."
- Point out the streak counter in the header. "Streak tracking builds the daily habit."
- The five signal rings show current scores with color-coded status.
- The composite skin health score at the top aggregates all signals.
- Sparkline tiles below each signal show the recent trend at a glance.
- "Every element on this screen updates after each scan. The home screen is your morning dashboard."

**Key highlight:** The facial mesh visualization and animated score rings make complex data immediately intuitive.

---

## 6. Signal Deep Dive (5:00 - 5:30)

**Action:** Tap on a signal ring (e.g., Inflammation or Sun Damage).

**Talking points:**
- The animated gauge fills to the current score with haptic feedback.
- "The gauge uses a clinical color scale: green is healthy, amber is watch, red is elevated."
- Scroll down to see the full trend chart over the selected time window.
- Below the chart, personalized recommendations appear based on your score trajectory.
- "If inflammation has been trending up for 5+ days, we surface an escalation flag suggesting a clinician visit."

**Key highlight:** The transition animation from ring to full gauge is Headspace-inspired -- 400-800ms with cubic easing.

---

## 7. Product Intelligence (5:30 - 6:00)

**Action:** Navigate to the Profile tab and tap on a product, or go to the product detail screen.

**Talking points:**
- "Each product gets a personalized effectiveness score based on your skin profile and current concerns."
- Show the ingredient breakdown: active ingredients are highlighted with their mechanism of action.
- "Our 45-ingredient database covers retinoids, AHAs, BHAs, niacinamide, SPF actives, peptides, and more."
- The score considers your primary goal, current signal levels, and ingredient interactions.

**Key highlight:** This is not a generic ingredient list -- it is personalized intelligence that tells you which products matter for YOUR skin.

---

## 8. Clinician Report (6:00 - 6:30)

**Action:** Navigate to the report generation screen (from home or profile).

**Talking points:**
- Select a time window: 7, 14, or 30 days.
- "The builder shows you scan count, sunscreen adherence rate, and quality pass rate before you generate."
- Tap "Generate preview" to see the full clinician export.
- Walk through each section: patient summary, scan protocol, trend snapshot with sparklines, **representative photos** (first/middle/last from the period), products used, and context overlay.
- "This is designed for a dermatologist's 15-minute appointment. Hand them this report and they have objective trend data instead of subjective descriptions."

**Key highlight:** Representative photos in the report show visual progression alongside the numerical scores.

---

## 9. Profile and Privacy (6:30 - 6:45)

**Action:** Show the Profile tab.

**Talking points:**
- Demographics, protocol settings, and product list are all editable.
- "Privacy is foundational. Photos stay on-device. We use local-first storage with optional encrypted sync."
- Point out the privacy policy link and data export option.

**Key highlight:** No photos leave the device unless the user explicitly exports a report.

---

## 10. Closing (6:45 - 7:00)

**Action:** Return to the home screen for the final shot.

**Talking points:**
- "Let me leave you with what makes RadianceIQ different."
- **Deterministic scoring** -- no random fluctuation. Real signal, not noise.
- **120 passing tests** across 10 suites -- this is production-grade software, not a hackathon sketch.
- **Clerk authentication** with Apple/Google OAuth -- enterprise-ready from day one.
- **Fine-tuned GPT-4o** integration ready for the vision pipeline -- the ML backbone is architected, not bolted on.
- **Clinician-ready reports** that bridge the gap between consumer self-care and professional dermatology.
- "RadianceIQ: better skin starts with better data."

---

## Pre-Demo Checklist

- [ ] App is freshly installed or cache cleared for clean onboarding flow
- [ ] A physical product with a barcode is available for scanning demo
- [ ] Demo data is NOT pre-loaded (load it live during section 5)
- [ ] Device brightness is set to maximum
- [ ] Do Not Disturb is enabled
- [ ] Screen recording is running (for backup)
- [ ] Backend server is running (`cd backend && node server.js`)
- [ ] Wi-Fi/cellular connection is stable (for auth and product lookup)

## Backup Plan

If barcode scanning fails (camera permission, network issue):
- Use the manual product search flow instead
- Pre-scanned products can be shown from demo data

If authentication fails (network):
- Show the auth screens and explain the Clerk integration
- Load demo data from a pre-authenticated state

If time is cut short (5 minutes):
- Skip sections 7 and 9
- Compress section 3 by narrating over quick taps instead of pausing on each screen
