# CareLink Core Gateway

CareLink is a production-ready, real-time emergency healthcare dispatch and tracking platform designed to bridge emergency responders (ambulances), intake coordinators, and hospital surgical teams.

---

## 🏗️ Exact Codebase Structure

The project follows a clean, highly modular **React 18 + TypeScript + Vite** architecture organized for clarity, maintainability, and zero-config local execution:

<img src="https://github.com/Amangithubaccount/carelink-v1/blob/main/images/8.png?raw=true" width="700">
---

## 💻 Frontend Architecture (`/src`)

The frontend is built for responsiveness, high contrast, and fail-safe field operation.

### 1. View Routing & State (`App.tsx`)
- **Role-Based Workspaces**: Seamlessly toggles between **Responder** (Ambulance GPS tracking, triage intake, live route navigation) and **Hospital Coordinator** (Bed readiness toggles, incoming patient queue).
- **Graceful Degradation**: Automatically detects missing or invalid API keys on boot and presents an option to continue in **Offline Demo Mode**.

- <img src="https://github.com/Amangithubaccount/carelink-v1/blob/main/images/1.png?raw=true" width="700">

### 2. Dual-Mode Mapping Engine (`MainMap.tsx`)
- **Live Google Maps Mode**: Utilizes `@vis.gl/react-google-maps` and Google Places API (New) to fetch verified nearby hospitals, geocode patient coordinates, and draw live transit routes.
- **Offline Simulation Mode**: When running locally without cloud credentials, activates an interactive SVG radar sweep with concentric range rings, clickable dispatch pin placement, and simulated hospital readiness beacons.

### 3. Triage & Decision Engine (`/src/lib/decisionEngine.ts`)
Evaluates incoming patient vitals against real-time hospital telemetry to score and assign the optimal facility based on:
- **Distance & ETA**: Haversine calculation combined with live traffic penalties.
- **Clinical Readiness**: Filters out hospitals lacking required resources (e.g., bypassing facilities without open ICU beds or trauma teams for severe incident ratings).

---

## ⚙️ Backend & API Integration

CareLink utilizes a modern client-serverless integration pattern:

1. **Google Maps Platform Integration**:
   - API keys are injected via environment variables (`VITE_GOOGLE_MAPS_PLATFORM_KEY` or `GOOGLE_MAPS_PLATFORM_KEY`).
   - If blocked by browser ad-blockers or running in restricted iframes, the GPS locator falls back cleanly to simulated coordinates.

2. **Appwrite Cloud Persistence (`/src/services/appwriteService.ts`)**:
   - Manages durable cloud records for active emergency cases and hospital telemetry updates.
   - Includes lazy initialization to ensure the UI never crashes if cloud storage is unconfigured.

---

## 🚀 Local Development (VS Code)

### 1. Prerequisites
- **Node.js** (v18+)
- **VS Code** (or any modern IDE)

### 2. Quick Start

# 1. Install dependencies
npm install

# 2. Configure environment (optional)
cp .env.example .env

# 3. Start dev server
npm run dev

Navigate to `http://localhost:3000`.
*Tip: If you don't have a Google Maps API key, simply click **"🚀 Continue in Offline Demo Mode"** on the initial launch screen to test full application functionality immediately.*

---

## 🛠️ Verification & Build

```bash
# Type check and verify compilation
npm run build
```
