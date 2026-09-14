# Thinkollect

> Capture thoughts mid-flow. Don't lose focus.

Built for developers, founders, and builders who think in bursts.

---

## What it does

You're deep in work. A thought hits — unrelated but important. You open Thinkollect, dump it in under 3 seconds, get a haptic confirmation, and get back to what you were doing. That's it.

- **Local-first**: Saved to device instantly. No network dependency.
- **FIFO ring buffer**: Keeps the 50 most recent thoughts on device. Oldest synced thoughts are pruned automatically — unsynced ones are **never** deleted.
- **Background sync**: When you're online, all pending thoughts sync to Supabase (PostgreSQL) with their original capture timestamp preserved.
- **Daily reconciliation**: Every time the app comes to foreground or network reconnects, missed syncs are automatically retried.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| **Mobile** | React Native + Expo SDK 57 (TypeScript) |
| **Local DB** | expo-sqlite (WAL mode, synchronous) |
| **Cloud DB** | Supabase (PostgreSQL) |
| **State** | Zustand |
| **Sync** | @supabase/supabase-js + @react-native-community/netinfo |

---

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the migration:

```sql
-- paste contents of supabase/migration.sql
```

3. Copy your **Project URL** and **anon public key** from Project Settings → API.

### 2. Mobile App

```bash
cd apps/mobile
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

npm install
npm run android   # or: npm run ios / npm run web
```

### 3. Run on device

Install **Expo Go** on your phone and scan the QR code from `npm start`.

---

## Project Structure

```
thinkollect/
├── apps/
│   └── mobile/
│       ├── src/
│       │   ├── components/
│       │   │   ├── CaptureCard.tsx   # The dump box
│       │   │   └── ThoughtRow.tsx    # Single thought in list
│       │   ├── db/
│       │   │   └── local.ts          # SQLite FIFO engine
│       │   ├── lib/
│       │   │   ├── supabase.ts       # Supabase client
│       │   │   └── sync.ts           # Sync engine
│       │   ├── screens/
│       │   │   └── HomeScreen.tsx    # Main screen
│       │   ├── store/
│       │   │   └── thoughtStore.ts   # Zustand store
│       │   └── types/
│       │       └── index.ts          # Shared types
│       └── App.tsx                   # Entry point
└── supabase/
    └── migration.sql                 # Run once in Supabase SQL Editor
```

---

Made by Krishna (ThinknBuild)
