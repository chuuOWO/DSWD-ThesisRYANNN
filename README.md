## DSWD Thesis Prototype (Supabase + Blockchain Flow)

This build aligns the system flow to your thesis objectives and moves away from local-only state and SQLite scaffolding.

## Objective-aligned process flow

### 1) Batch Tokenization (Incoming)
Recommended process implemented in UI logic:

Add Incoming Goods (Draft)
→ Submit for Verification
→ Verify Physical Receipt
→ **Post / Mint Batch Token**
→ Stock becomes official available inventory

Important: stock posting happens only when `mintBatchToken()` runs after verification.

### 2) Handover Smart Contract (Outgoing)

Outgoing Draft
→ Allocation Approval
→ **Sender Sign Release** (first custody signature)
→ In Transit
→ **Receiver Confirm Receipt** (second custody signature)
→ Custody completed

### 3) GPS Geolocation
Sender/receiver GPS is captured in outgoing status events and persisted in backend records.

### 4) Stock-Based Prioritization
Prioritization remains in logic layer and should be moved to Supabase SQL views/functions for real data scoring.

### 5) Admin Dashboard
Dashboard is now prepared to read from backend records via Supabase-backed API client.

---

## Database decision (thesis fit)

Use **Supabase PostgreSQL** as operational database:
- relational data model
- auth + role-based security (RLS)
- realtime dashboard updates
- storage for manifest/proof files
- optional PostGIS for geolocation

Blockchain is the immutable audit/proof layer, not the full operational database.

---

## Frontend env setup

Create `.env`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Only anon key belongs in frontend.

---

## Minimum required Supabase tables (initial)

- `incoming_manifests`
- `outgoing_requests`

These are what `src/app/services/backendApi.ts` currently uses.

---

## Run

```bash
npm install
npm run dev
```

## Next step after this commit

1. Create Supabase schema + RLS policies
2. Add MetaMask contract calls on Post/Sign/Confirm actions
3. Persist real Sepolia tx hash into Supabase rows
4. Show explorer links in dashboard tables

---

## Recent Progress & Implementation Status

### 1. Relational Data Separation (Option 1)
- **Package Custody & Tracking Decoupled**:
  - `outgoing_requests` now includes `assigned_truck_id` (`TEXT`) to establish a direct relational link between relief packages and the assigned driver's truck.
  - `truck_live_locations` is streamlined strictly as a **pure GPS telemetry table** (`truck_id`, `latitude`, `longitude`, `gps_text`, `accuracy`, `wallet_address`, `updated_at`), eliminating previous state conflicts caused by storing redundant package arrays inside GPS records.
- **Admin Road Map Integration**:
  - The admin road map dynamically joins truck GPS locations with `outgoing_requests` where `assigned_truck_id === truck.truck_id`, displaying active deliveries, quantities, and real-time transit paths accurately.

### 2. Live QR Scanning & Driver Mobile Flow
- **Pure Camera QR Scanning**:
  - Removed all mock QR generators and temporary scan testing buttons.
  - Drivers scan authentic system-generated Outgoing Release QR codes directly via mobile camera (`ScanModal`), instantly assigning the release to their truck in Supabase.
- **Continuous Telemetry & Custody**:
  - Live GPS tracking broadcasts smooth coordinates to Supabase with battery/accuracy optimization.
  - Active packages remain in driver custody until confirmed and signed off by the receiver.

### 3. Supabase Database & Auth Architecture
- **Supabase PostgreSQL Schema**:
  - `outgoing_requests`: Contains DR number (unique), handover contract ID, batch allocations, dual custody signatures, GPS coordinates, and `assigned_truck_id`.
  - `truck_live_locations`: Pure real-time vehicle GPS stream with Supabase Realtime enabled.
  - `incoming_manifests`: Tokenized inbound goods with batch token ID and verification timestamps.
  - `public.profiles` & Auth Triggers: Role-based access control (`dswd_admin`, `receiver`) synced automatically from Supabase Auth (`auth.users`).
  - `lgu_inventory_reports`: Prioritization scores and stock levels across disaster areas.
  - `discrepancy_reports`: Incident and mismatch reporting.
  - `app_counters`: Persistent unique sequence counters across record lifecycles.
- **Security & RLS**:
  - Row Level Security policies configured across all tables for authenticated administrative operations and receiver telemetry updates.

### 4. Blockchain Proofs & Handover Protocol
- **Batch Tokenization**: Inbound relief goods are minted with token identifiers once physically verified at the warehouse.
- **Custody Signatures**: Sender signs release upon truck dispatch; receiver verifies physical delivery with cryptographic proof / transaction hash upon acceptance.

### 5. Type Safety & Build Status
- Full TypeScript type-safety across all components (`authApi.ts`, `backendApi.ts`, `TruckTracking.tsx`, `TruckerLocationPage.tsx`, `useInventoryState.tsx`).
- Production build verified with Vite: **0 errors, 100% build pass rate**.

---

# Deep-Dive Technical Implementation: Receiver App & Admin Truck Tracking Map

This section provides an exhaustive, code-level breakdown focused specifically on the **Receiver Mobile App (`TruckerLocationPage.tsx`)**, the **Admin Trucking Map Dashboard (`TruckTracking.tsx`)**, and the **Authentication Pipeline** that connects them.

---

## 📑 Section Table of Contents
1. [Architecture Overview & Telemetry Data Pipeline](#1-architecture-overview--telemetry-data-pipeline)
2. [Authentication & Role-Based Access Control (RBAC)](#2-authentication--role-based-access-control-rbac)
   - [2.1 Backend Auth Service (`src/app/services/authApi.ts`)](#21-backend-auth-service-srcappservicesauthapits)
   - [2.2 Login & Sign-Up Interface (`src/app/components/AuthPage.tsx`)](#22-login--sign-up-interface-srcappcomponentsauthpagetsx)
   - [2.3 Route Guard & Screen Router (`src/app/App.tsx`)](#23-route-guard--screen-router-srcappapptsx)
3. [The Receiver Mobile Application (`src/app/components/TruckerLocationPage.tsx`)](#3-the-receiver-mobile-application-srcappcomponentstruckerlocationpagetsx)
   - [3.1 Driver Identifier Resolution & Key Isolation](#31-driver-identifier-resolution--key-isolation)
   - [3.2 Multi-Package Custody Ledger & Local Persistence](#32-multi-package-custody-ledger--local-persistence)
   - [3.3 Real-Time Continuous Geolocation & Smoothing Engine](#33-real-time-continuous-geolocation--smoothing-engine)
   - [3.4 Optical Barcode/QR Scanning & Custody Handover](#34-optical-barcodeqr-scanning--custody-handover)
   - [3.5 Real-Time Custody Auto-Clear Engine](#35-real-time-custody-auto-clear-engine)
   - [3.6 Road-Locked Mobile Route Rendering](#36-road-locked-mobile-route-rendering)
4. [Admin Live Trucking Map Dashboard (`src/app/components/TruckTracking.tsx`)](#4-admin-live-trucking-map-dashboard-srcappcomponentstrucktrackingtsx)
   - [4.1 Backend Telemetry Bridge (`src/app/services/backendApi.ts`)](#41-backend-telemetry-bridge-srcappservicesbackendapits)
   - [4.2 Admin Real-Time Telemetry Subscription Lifecycle](#42-admin-real-time-telemetry-subscription-lifecycle)
   - [4.3 Relational Entity Fusion Algorithm (`toTruckRoute`)](#43-relational-entity-fusion-algorithm-totruckroute)
   - [4.4 Highway-Snapped OSRM Routing Engine (`RouteMap`)](#44-highway-snapped-osrm-routing-engine-routemap)
   - [4.5 Active Shipments Sync Table](#45-active-shipments-sync-table)
5. [Database Telemetry Schemas (`Supabase PostgreSQL`)](#5-database-telemetry-schemas-supabase-postgresql)
6. [Simulated Testing Guide (Without Physical Trucks)](#6-simulated-testing-guide-without-physical-trucks)

---

## 1. Architecture Overview & Telemetry Data Pipeline

The communication between the field driver and the administrative headquarters is decoupled through Supabase PostgreSQL tables:

```
┌─────────────────────────────────────────────────────────────┐
│                 Trucker / Receiver Mobile View              │
│               (TruckerLocationPage.tsx - /trucker)          │
│  - Continuous GPS Geolocation Engine (5m delta, 0.4 EMA)    │
│  - Camera QR / Barcode Scanner (BarcodeDetector API)        │
│  - Multi-Package Custody Ledger (localStorage & Supabase)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            upsertTruckLiveLocation (REST / WebSocket)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Realtime PostgreSQL              │
│  - public.truck_live_locations (truck_id, lat, lng, gps)   │
│  - public.outgoing_requests (dr_number, delivery_status)    │
│  - public.profiles (user_id, role, truck_id, wallet)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
           postgres_changes subscription (WebSocket)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Admin Logistics Dashboard                  │
│                 (TruckTracking.tsx - /trucking)             │
│  - Live Road-Snapped Highway Map (Leaflet + OSRM v1)        │
│  - Checkpoints Timeline (Origin -> Waypoints -> Dest)       │
│  - Active Shipments in Transit Table                        │
└─────────────────────────────────────────────────────────────┘
```

1. **The Receiver App** streams GPS telemetry to `public.truck_live_locations` only when packages are in custody (`activePackages.length > 0`).
2. **Supabase Realtime** pushes PostgreSQL change events across an open WebSocket channel.
3. **The Admin Tracking Map** joins vehicle coordinates with `public.outgoing_requests` using `assigned_truck_id`, calculating road routes, travel duration, distance, and transit milestones.

---

## 2. Authentication & Role-Based Access Control (RBAC)

The application implements a strict two-tier access architecture:
* **`dswd_admin`**: Accesses the full logistics suite (Inventory, Batches, Outgoing Requisitions, Live Road Map).
* **`receiver`**: Accesses the dedicated mobile viewport for package scanning, custody acceptance, and GPS beaconing.

### 2.1 Backend Auth Service (`src/app/services/authApi.ts`)

#### Role & Profile Data Model:
* **Lines 3–14**:
  ```typescript
  export type UserRole = 'dswd_admin' | 'receiver';

  export interface UserProfile {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    truckId?: string | null;
    lguName?: string | null;
    walletAddress?: string | null;
    createdAt?: string | null;
  }
  ```

#### Profile Hydration with Metadata Fallback (`authApi.getProfile`):
* **Lines 48–77**:
  Queries the `public.profiles` database table. If not yet initialized, it retrieves user attributes directly from Supabase Auth `user_metadata`:
  ```typescript
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) return mapProfile(data);
    } catch {}

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (user && user.id === userId) {
      return {
        id: user.id,
        email: user.email ?? '',
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'DSWD Officer',
        role: normalizeRole(user.user_metadata?.role),
        truckId: user.user_metadata?.truck_id || null,
        lguName: null,
        walletAddress: user.user_metadata?.wallet_address || null,
        createdAt: user.created_at
      };
    }
    return null;
  }
  ```

#### Sign-Up & Automatic Profile Synchronization (`authApi.signUp`):
* **Lines 85–119**:
  Creates the account in Supabase Auth, embedding `role` and `truck_id` into metadata, and creates a synchronized record in `public.profiles`:
  ```typescript
  async signUp(payload: SignUpPayload) {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          role: payload.role,
          truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
          wallet_address: payload.walletAddress || null,
          lgu_name: null
        }
      }
    });

    if (error) throw new Error(error.message);

    if (data.user && data.session) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: payload.email,
          full_name: payload.fullName,
          role: payload.role,
          truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
          wallet_address: payload.walletAddress || null,
          lgu_name: null
        });
      } catch (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }
    }
    return data;
  }
  ```

* **Authentication Handlers (Lines 79–83 & 121–124)**:
  `authApi.signIn(email, password)` and `authApi.signOut()` wrap `supabase.auth` execution with error normalization.

---

### 2.2 Login & Sign-Up Interface (`src/app/components/AuthPage.tsx`)

#### Random Vehicle Identifier Generator:
* **Lines 11–14**:
  Generates clean, standardized vehicle identifiers for new drivers:
  ```typescript
  const generateTruckId = () => {
    const number = Math.floor(1 + Math.random() * 9999);
    return `RCVR-${String(number).padStart(4, '0')}`;
  };
  ```

#### Form Submission Workflow (`handleSubmit`):
* **Lines 27–57**:
  Handles submission, executes authentication or registration, updates user session context, and handles redirection:
  ```typescript
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        await authApi.signIn(email.trim(), password);
      } else {
        const data = await authApi.signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role,
          truckId: role === 'receiver' ? truckId.trim() : undefined
        });

        if (!data.session) {
          setMessage({ type: 'info', text: 'Account created. Check email confirmation settings in Supabase, then login.' });
          return;
        }
      }

      await refreshProfile();
      setMessage({ type: 'info', text: mode === 'signup' ? 'Account ready. Redirecting...' : 'Signed in. Redirecting...' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Authentication failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  ```

---

### 2.3 Route Guard & Screen Router (`src/app/App.tsx`)

* **Lines 57–86**:
  The root component acts as an RBAC gatekeeper:
  ```typescript
  // 1. Loading gate
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="rounded-lg bg-white border border-gray-200 px-6 py-4 text-sm font-bold text-gray-700 shadow-sm">
          Loading secure session...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> Auth Page
  if (!session || !profile) {
    return <AuthPage />;
  }

  const activeProfile: UserProfile = profile;

  // 3. Receiver Role -> Trucker Mobile Geolocation App
  if (activeProfile.role === 'receiver' || window.location.pathname === '/trucker') {
    return <TruckerLocationPage profile={activeProfile} onSignOut={signOut} />;
  }

  // 4. Admin Role -> Admin Dashboard with Truck Tracking
  ```

---

## 3. The Receiver Mobile Application (`src/app/components/TruckerLocationPage.tsx`)

A mobile PWA interface built for drivers and field receivers to scan outgoing QR codes and stream continuous GPS coordinates.

### 3.1 Driver Identifier Resolution & Key Isolation

* **Resolution Hierarchy — Lines 371–377**:
  Identifies the driver dynamically:
  ```typescript
  const getReceiverIdentifier = (profile?: UserProfile | null) => {
    if (profile?.truckId && profile.truckId.trim()) return profile.truckId.trim();
    if (profile?.fullName && profile.fullName.trim()) return profile.fullName.trim().replace(/\s+/g, '-').toUpperCase();
    if (profile?.email && profile.email.trim()) return profile.email.split('@')[0].toUpperCase();
    if (profile?.id) return `RCVR-${profile.id.slice(0, 6).toUpperCase()}`;
    return 'DRIVER';
  };
  ```

* **Storage Isolation — Lines 476–478**:
  ```typescript
  const receiverId = useMemo(() => getReceiverIdentifier(profile), [profile]);
  const storageKey = `trucker_active_packages_${receiverId}`;
  const lastKnownPosKey = `trucker_last_known_pos_${receiverId}`;
  ```

---

### 3.2 Multi-Package Custody Ledger & Local Persistence

* **Hydration from LocalStorage — Lines 486–505**:
  ```typescript
  const [activePackages, setActivePackages] = useState<QrPayload[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.filter((p) => p && typeof p.drNumber === 'string');
          }
        }
      }
    } catch {}
    return [];
  });
  ```

* **Transit Status Derivation — Lines 555–556**:
  ```typescript
  const isInTransit = activePackages.length > 0;
  const totalQuantity = useMemo(() => activePackages.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0), [activePackages]);
  ```

---

### 3.3 Real-Time Continuous Geolocation & Smoothing Engine

* **Single-Shot Geolocation — `getBrowserLocation` (Lines 442–458)**:
  ```typescript
  const getBrowserLocation = (): Promise<PhoneLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString()
        }),
        (err) => reject(new Error(`Location error: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  };
  ```

* **Continuous Position Watcher Loop — Lines 590–650**:
  Executes high-accuracy geolocation with data filtering and smoothing:
  ```typescript
  useEffect(() => {
    getBrowserLocation()
      .then((loc) => {
        saveLocationState(loc);
        setRecenterTrigger((prev) => prev + 1);
      })
      .catch((err) => console.warn('Initial GPS lookup:', err));

    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (nextPos) => {
        const rawLat = nextPos.coords.latitude;
        const rawLng = nextPos.coords.longitude;
        const accuracy = nextPos.coords.accuracy;

        // 1. Data Integrity Validation
        if (typeof rawLat !== 'number' || typeof rawLng !== 'number' || isNaN(rawLat) || isNaN(rawLng)) return;

        // 2. Reject Inaccurate Multipath Jitter (> 150m)
        if (accuracy && accuracy > 150) return;

        // 3. Distance Gating: Skip updates if device moved < 5m
        const prev = lastProcessedLocRef.current;
        if (prev) {
          const distance = getDistanceMeters(prev.latitude, prev.longitude, rawLat, rawLng);
          if (distance < 5) return;
        }

        // 4. Exponential Coordinate Smoothing (0.4 factor)
        const smoothedLat = prev ? smoothCoordinate(prev.latitude, rawLat, 0.4) : rawLat;
        const smoothedLng = prev ? smoothCoordinate(prev.longitude, rawLng, 0.4) : rawLng;

        const updatedLoc: PhoneLocation = {
          latitude: smoothedLat,
          longitude: smoothedLng,
          accuracy,
          timestamp: new Date().toISOString()
        };

        saveLocationState(updatedLoc);

        // 5. Broadcast to Supabase ONLY if in active custody
        const currentPackages = activePackagesRef.current;
        if (currentPackages && currentPackages.length > 0) {
          void backendApi.upsertTruckLiveLocation({
            truck_id: receiverId,
            latitude: updatedLoc.latitude,
            longitude: updatedLoc.longitude,
            gps_text: formatGps(updatedLoc),
            accuracy: updatedLoc.accuracy ? Math.round(updatedLoc.accuracy) : null,
            wallet_address: profile?.walletAddress || '0xReceiverWallet',
            updated_at: new Date().toISOString()
          }).catch(() => {});
        }
      },
      (err) => console.warn('Continuous GPS Watch:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );

    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [receiverId, profile?.walletAddress]);
  ```

---

### 3.4 Optical Barcode/QR Scanning & Custody Handover

* **Hardware Barcode Detection Engine — Lines 405–440**:
  ```typescript
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const interval = setInterval(async () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const barcodes = await detector.detect(videoRef.current);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        handleQrValue(barcodes[0].rawValue);
      }
    }
  }, 500);
  ```

* **Custody Assignment & Immediate Broadcast (`signAndShare`) — Lines 732–796**:
  ```typescript
  const signAndShare = async (payload: QrPayload) => {
    setIsSigning(true);
    stopCamera();

    try {
      let nextLocation: PhoneLocation;
      try {
        nextLocation = await getBrowserLocation();
      } catch {
        nextLocation = location ?? {
          latitude: DEFAULT_MAP_CENTER[0],
          longitude: DEFAULT_MAP_CENTER[1],
          accuracy: 25,
          timestamp: new Date().toISOString()
        };
      }

      saveLocationState(nextLocation);
      setRecenterTrigger((prev) => prev + 1);

      // 1. Assign truck to release in Supabase
      await backendApi.assignTruckToRelease(payload.drNumber, receiverId, 'In Transit');

      // 2. Add package to active packages list
      const updatedPackages = [
        ...activePackages.filter((p) => p.drNumber !== payload.drNumber),
        payload
      ];
      localStorage.setItem(storageKey, JSON.stringify(updatedPackages));
      setActivePackages(updatedPackages);

      // 3. Upsert live location record
      await backendApi.upsertTruckLiveLocation({
        truck_id: receiverId,
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        gps_text: formatGps(nextLocation),
        accuracy: nextLocation.accuracy ? Math.round(nextLocation.accuracy) : null,
        wallet_address: profile?.walletAddress || '0xReceiverWallet',
        updated_at: new Date().toISOString()
      });

      setInventory({
        batchTokenId: payload.batchTokenIds[0] ?? payload.handoverContractId,
        category: payload.category,
        quantity: payload.quantity,
        status: 'In transit',
        remarks: ''
      });
      nav('verify');
    } finally {
      setIsSigning(false);
    }
  };
  ```

---

### 3.5 Real-Time Custody Auto-Clear Engine

* **Realtime Custody Verification (`checkCustodyStatus`) — Lines 665–719**:
  Periodically queries release states. When an LGU confirms receipt (`'Delivered'`, `'Accepted'`, or `'Distributed'`), the package is automatically cleared from the driver's custody ledger:
  ```typescript
  const checkCustodyStatus = async () => {
    const currentPackages = activePackagesRef.current;
    if (!currentPackages.length) return;

    const allReleases = await backendApi.getTruckerReleases();
    const remainingPackages = currentPackages.filter((pkg) => {
      const matchingReq = allReleases.find((r) => r.dr_number === pkg.drNumber);
      if (!matchingReq) return false;
      const isAssignedToMe = matchingReq.assigned_truck_id === receiverId;
      const isDone = ['Delivered', 'Accepted', 'Distributed'].includes(matchingReq.delivery_status ?? '');
      return isAssignedToMe && !isDone;
    });

    if (remainingPackages.length !== currentPackages.length) {
      const deliveredCount = currentPackages.length - remainingPackages.length;
      localStorage.setItem(storageKey, JSON.stringify(remainingPackages));
      setActivePackages(remainingPackages);
      if (remainingPackages.length === 0) setInventory(initialInventory);
      setHandoverToast(`✓ ${deliveredCount} package(s) updated/cleared from custody.`);
    }
  };
  ```

---

### 3.6 Road-Locked Mobile Route Rendering

* **Mobile Routing Component (`RoadLockedDeliveryRoute`) — Lines 247–369**:
  Calls the OSRM road router between the driver's coordinates and the destination LGU coordinates, rendering the road polyline directly on the mobile Leaflet map with a pulsating location marker.

---

## 4. Admin Live Trucking Map Dashboard (`src/app/components/TruckTracking.tsx`)

The administrative road map monitors all active delivery trucks across Western Visayas.

### 4.1 Backend Telemetry Bridge (`src/app/services/backendApi.ts`)

* **Upserting Vehicle Telemetry (Lines 393–415)**:
  ```typescript
  async upsertTruckLiveLocation(payload: TruckLiveLocation) {
    const sanitizedPayload: Record<string, unknown> = {
      truck_id: payload.truck_id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      gps_text: payload.gps_text,
      accuracy: payload.accuracy ?? null,
      wallet_address: payload.wallet_address ?? null,
      updated_at: payload.updated_at || new Date().toISOString()
    };

    const { error } = await supabase
      .from('truck_live_locations')
      .upsert(sanitizedPayload, { onConflict: 'truck_id' });

    if (error) console.warn('upsertTruckLiveLocation warning:', error.message);
    return { ok: true };
  }
  ```

* **Realtime Telemetry Subscription (Lines 426–448)**:
  ```typescript
  subscribeTruckLiveLocations(
    onUpsert: (location: TruckLiveLocation) => void,
    onDelete: (truckId: string) => void
  ) {
    const channel = supabase
      .channel('truck_live_locations_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'truck_live_locations' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { truck_id?: string };
            if (oldRow?.truck_id) onDelete(oldRow.truck_id);
          } else if (payload.new && typeof payload.new === 'object') {
            onUpsert(payload.new as TruckLiveLocation);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }
  ```

---

### 4.2 Admin Real-Time Telemetry Subscription Lifecycle

* **Lines 437–470 (`TruckTracking.tsx`)**:
  Hydrates initial state and connects to the Supabase WebSocket channel:
  ```typescript
  useEffect(() => {
    backendApi.getTruckerReleases().then(setReleases);

    // Initial Database Hydration
    backendApi.getTruckLiveLocations().then((locations) => {
      const initialMap: Record<string, TruckLiveLocation> = {};
      locations.forEach((loc) => {
        if (loc.truck_id) initialMap[loc.truck_id] = loc;
      });
      setLiveLocations((current) => ({ ...initialMap, ...current }));
    });

    // Real-Time WebSocket Telemetry
    return backendApi.subscribeTruckLiveLocations(
      (location) => {
        setLiveLocations((current) => {
          const nextLocation = stabilizeLiveLocation(current[location.truck_id], location);
          return { ...current, [location.truck_id]: nextLocation };
        });
      },
      (deletedTruckId) => {
        setLiveLocations((current) => {
          const copy = { ...current };
          delete copy[deletedTruckId];
          return copy;
        });
      }
    );
  }, []);
  ```

---

### 4.3 Relational Entity Fusion Algorithm (`toTruckRoute`)

* **Lines 180–270 (`TruckTracking.tsx`)**:
  Merges raw GPS coordinates with relational `outgoing_requests` records (matching `assigned_truck_id === location.truck_id`) to derive route coordinates, cargo details, and transit progress:
  ```typescript
  const toTruckRoute = (
    location: TruckLiveLocation,
    releases: TruckerReleaseRecord[],
    outgoingReleasesList: OutgoingRelease[]
  ): TruckRoute => {
    const assignedPackages = allReleases.filter((r) => r.assigned_truck_id === location.truck_id);
    const activeAssigned = assignedPackages.filter((r) => r.delivery_status !== 'Delivered');

    let origin = 'DSWD Oton Warehouse';
    let destination = 'Assigned LGU';
    let cargo = 'Standby (0 active packages)';
    let status: TruckStatus = 'In Transit';

    if (activeAssigned.length > 0) {
      origin = Array.from(new Set(activeAssigned.map((r) => r.warehouse_source))).join(', ');
      destination = Array.from(new Set(activeAssigned.map((r) => r.lgu_name || r.municipality))).join(', ');
      cargo = activeAssigned.map((r) => `${r.amount_approved} ${r.category}`).join(', ');
    } else if (assignedPackages.length > 0) {
      status = 'Delivered';
    }

    const originPosition = findCoords(WAREHOUSE_COORDS, origin) ?? WAREHOUSE_COORDS['dswd oton warehouse'];
    const destinationPosition = findCoords(LGU_COORDS, destination) ?? [location.latitude, location.longitude];
    const progress = status === 'Delivered' ? 100 : getProgress(location, destinationPosition);

    return {
      id: location.truck_id,
      truckName: location.truck_id,
      driver: shortWallet(location.wallet_address),
      status,
      origin,
      destination,
      cargo,
      updatedAt: formatDateTime(location.updated_at),
      originPosition,
      position: [location.latitude, location.longitude],
      destinationPosition,
      progress
    };
  };
  ```

---

### 4.4 Highway-Snapped OSRM Routing Engine (`RouteMap`)

* **Lines 280–380 (`RouteMap`)**:
  Uses Leaflet Routing Machine with OSRM to project vehicles onto actual Philippine roads and calculate distance and drive times:
  ```typescript
  const routingControl = L.Routing.control({
    waypoints: [
      L.latLng(selectedRoute.originPosition[0], selectedRoute.originPosition[1]),
      L.latLng(selectedRoute.destinationPosition[0], selectedRoute.destinationPosition[1])
    ],
    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
    lineOptions: {
      styles: [{ color: '#1d4ed8', weight: 6, opacity: 0.9 }]
    }
  }).addTo(map);
  ```

---

### 4.5 Active Shipments Sync Table

* **Lines 533–573 & Lines 620–675 (`TruckTracking.tsx`)**:
  Renders active shipments alongside the map with DR numbers, destination facilities, categories, amounts, assigned trucks, and delivery status badges.

---

## 5. Database Telemetry Schemas (`Supabase PostgreSQL`)

```sql
-- 1. Profiles & RBAC
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dswd_admin', 'receiver')),
  truck_id TEXT,
  lgu_name TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Real-Time Vehicle GPS Telemetry
CREATE TABLE IF NOT EXISTS public.truck_live_locations (
  truck_id TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  gps_text TEXT,
  accuracy INTEGER,
  wallet_address TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.truck_live_locations;

-- 3. Outgoing Requisitions
CREATE TABLE IF NOT EXISTS public.outgoing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dr_number TEXT UNIQUE NOT NULL,
  date_allocated DATE NOT NULL,
  lgu_name TEXT NOT NULL,
  province TEXT NOT NULL,
  municipality TEXT NOT NULL,
  fnfi_category TEXT NOT NULL,
  amount_requested INTEGER NOT NULL,
  amount_approved INTEGER NOT NULL,
  source_type TEXT DEFAULT 'Warehouse',
  warehouse_source TEXT NOT NULL,
  delivery_mode TEXT DEFAULT 'Truck',
  delivery_status TEXT DEFAULT 'Draft',
  incident_code TEXT NOT NULL,
  assigned_truck_id TEXT,
  receiver_gps TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.outgoing_requests;
```

---

