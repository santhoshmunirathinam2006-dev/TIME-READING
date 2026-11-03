# Time Reading - by Royal Rockers

A React Native (Expo SDK 58) Android application designed for timing tournaments and events (e.g. Manjuviratu / bull chasing / sports events) managing up to 500 numbered cards, dynamic live tie-aware ranking, persistent offline storage, CSV file imports/exports, and cloud synchronization.

---

## 🚀 Features

- **Work Tab:**
  - Fast numeric entry for Card Number, Time (2 decimal precision), and Name.
  - Automatic focus progression on Enter.
  - Duplicate/Update confirmation dialog with previous value inspection.
  - Delete / reset card entry with confirmation.
- **Table Tab:**
  - Real-time tie-handling and dense ranking: ties share ranks and consecutive tie groups are highlighted in color.
  - Instant live filter & search by Card Number, Name, Time, Rank, or Price.
  - Independent, fixed-order 500-place Prize list with search and editor modal.
- **Upload Tab (Cloud Sync):**
  - Direct integration with Google Apps Script / Webhook endpoints.
  - Granular column filter selection (Rank, Card Number, Name, Time, Price).
  - Auto-locked URL entry box with lock/unlock toggle to prevent accidental editing.
  - Automatic 302/307 redirect following (required for Google Apps Script endpoints).
  - Built-in Apps Script template for one-click Google Sheet synchronization.
- **Offline & Storage:**
  - Smart CSV file open & overwrite/share.
  - Permission-controlled local session persistence via AsyncStorage.
  - Dedicated Clear All warning modal to securely reset all data.

---

## 🛠️ Tech Stack

- **Framework:** React Native / Expo (SDK 58)
- **Language:** TypeScript
- **Icons:** `@expo/vector-icons` (Ionicons)
- **Local Storage:** `@react-native-async-storage/async-storage`
- **File System & Sharing:** `expo-file-system/legacy`, `expo-document-picker`, `expo-sharing`
- **Safe Area:** `react-native-safe-area-context`

---

## 📦 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/time-reading-royal-rockers.git
   cd time-reading-royal-rockers
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run locally (Development):**
   ```bash
   npx expo start
   ```

4. **Lint & Typecheck:**
   ```bash
   npx tsc --noEmit
   npx eslint src/ App.tsx
   ```

---

## 📱 Building the Standalone Android APK

To build a standalone installable APK via EAS Cloud Build:

```powershell
$env:EAS_NO_VCS="1"; npx eas-cli@latest build --platform android --profile preview
```

---

## 🔒 Security Hardening

- **CWE-1236 Neutralization:** CSV formula injection protection prepends single quotes to dangerous leading characters (`=`, `+`, `-`, `@`, `\t`).
- **SSRF & Scheme Validation:** Strictly enforces `https://` and blocks private/loopback IP ranges.
- **Network Resilience:** AbortController 25-second timeout and offline detection on all network calls.
- **Memory & Parsing Limits:** 5 MB and 5,000-row guards against memory exhaustion.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
