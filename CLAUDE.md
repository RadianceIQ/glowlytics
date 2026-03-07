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
      onboarding/     # Onboarding flow
      scan/           # Scanning flow
      report/         # Report screens
      tabs/           # Tab navigation
    src/
      components/     # Reusable UI components
      constants/      # App constants
      hooks/          # Custom hooks
      services/       # Business logic (mockScanner, skinAnalysis, demoData)
      store/          # Zustand state (useStore.ts)
      types/          # TypeScript type definitions
      utils/          # Utility functions
    backend/          # Express + PostgreSQL API
      server.js
      db-init.js
    assets/           # Images, fonts
```

## Tech Stack

- **Framework:** React Native with Expo SDK 55
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router (file-based)
- **State:** Zustand + AsyncStorage
- **Backend:** Express.js + PostgreSQL
- **Node version:** Use the version compatible with Expo SDK 55

## Commands

```bash
# All commands run from RadianceIQ/
cd RadianceIQ

# Start dev server
npm start
# or: npx expo start

# Type check
npx tsc --noEmit

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

## Design System

- Dark theme: background `#0F0F1E`, primary accent `#6C63FF`
- Use `react-native-svg` for vector graphics
- Animations via `react-native-reanimated`

## Important Context

- Scanner hardware data is **mocked** (no physical Bluetooth scanner)
- ML/skin analysis is **simulated locally** (Vision LLM API not wired yet)
- This is a hackathon MVP - prioritize working features over polish
- Three user journeys: onboarding, daily scan, report viewing
