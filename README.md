# Key Stash Manager 🔑

A lightweight, self-hostable, local-first API key and secrets manager. Organize your keys into customized folders and profiles, tag them for easy discovery, export or import `.env` and JSON backups, and optionally synchronize all records with a self-hosted Express backend server.

---

## 📖 Table of Contents
1. [System Architecture](#-system-architecture)
2. [Features at a Glance](#-features-at-a-glance)
3. [Project Structure](#-project-structure)
4. [Prerequisites & Installation](#-prerequisites--installation)
5. [How to Run the Application](#-how-to-run-the-application)
   - [Development Mode](#development-mode)
   - [Production Mode](#production-mode)
   - [Running with PM2](#running-with-pm2)
   - [Docker Deployment](#docker-deployment)
6. [Data Model & Synchronisation](#-data-model--synchronisation)
   - [Zod Validation Schema](#zod-validation-schema)
   - [Local-First Persistence & Sync Logic](#local-first-persistence--sync-logic)
   - [Data Migration (Legacy v1 to V2 Profiles)](#data-migration-legacy-v1-to-v2-profiles)
7. [Utility Scripts](#-utility-scripts)
8. [Best Practices for Developers](#-best-practices-for-developers)
9. [Security Considerations](#-security-considerations)

---

## 🏗️ System Architecture

Key Stash Manager is divided into two primary subsystems:

1. **Frontend App (`/frontend`)**: A modern Single Page Application (SPA) built using **React 18**, **Vite**, **TypeScript**, and **TailwindCSS** paired with **shadcn/ui** design primitives. State management is driven by **Zustand** with persistent storage using the browser's `localStorage` (`api-key-manager-secrets`).
2. **Backend Server (`/server.js`)**: A lightweight **Express.js** API that serves the production-ready frontend assets and exposes JSON file-backed synchronization API endpoints.

```
       +---------------------------------------------+
       |               Browser Client                |
       |  +------------------+  +-----------------+  |
       |  |  React UI Views  |  |  Zustand Store  |  |
       |  +------------------+  +--------+--------+  |
       |                                 |           |
       |                   (Persists to) |           |
       |                                 v           |
       |                       +---------+--------+  |
       |                       |  localStorage    |  |
       |                       +------------------+  |
       +---------------------------------+-----------+
                                         |
                       (API Sync Calls)  | (POST/GET /api/sync)
                                         v
       +---------------------------------+-----------+
       |               Express Server                |
       |  +---------------------------------------+  |
       |  | /api/sync Endpoint & Schema Validation|  |
       |  +------------------+--------------------+  |
       |                     |                       |
       |         (Writes to) |                       |
       |                     v                       |
       |           +---------+--------+              |
       |           |  data/keys.json  |              |
       |           +------------------+              |
       +---------------------------------------------+
```

---

## ✨ Features at a Glance

* **Contextual Profiles**: Segment secrets into separate workspace environments (e.g., *Personal*, *Work*, *Client Projects*).
* **Folder Hierarchy**: Group related secrets inside individual folders within each profile.
* **Tagging & Metadata**: Add tags and descriptions to secrets for rapid, multi-criteria filtering.
* **Bulk Imports**:
  * **JSON Backup**: Import full profile datasets (supports both legacy V1 format and the latest multi-profile V2 format).
  * **`.env` Parser**: Parse lines of `NAME=value` configuration keys, automatically skipping comment lines (`#`) and empty spaces, inserting or merging them into active folders.
* **Flexible Exports**:
  * Export individual profiles or entire multi-profile datasets to JSON.
  * Export specific folders straight into ready-to-use `.env` formats downloaded to your device or copied to the clipboard.
* **Dual-Mode Sync**: Runs as a standalone offline PWA (using local browser state with service-worker registration) OR connects directly to a synchronization backend.
* **Plaintext Copy Utilities**: Mask/unmask secret values, copy them with a single click, or copy them in `NAME="value"` key-value pairs directly.

---

## 📁 Project Structure

```
.
├── data/                    # Generated JSON file database (git-ignored)
│   └── keys.json            # Server-side backup repository
├── frontend/                # Frontend codebase
│   ├── public/              # Static public assets (icons, manifest.json, etc.)
│   ├── src/                 # React source code
│   │   ├── components/      # UI components (Layout, Sidebar, Modals, Forms)
│   │   │   ├── custom/      # Custom React/DOM helpers (e.g., Popover native dialog triggers)
│   │   │   └── ui/          # Radix-ui/shadcn primitives (button, dialog, input, etc.)
│   │   ├── hooks/           # Custom React hooks (useSync.tsx)
│   │   ├── lib/             # Helper libraries (cn utilities, ObjectSet de-duplication)
│   │   ├── pages/           # Page routes (Index.tsx, NotFound.tsx)
│   │   ├── store/           # Zustand global state (secretsStore.ts)
│   │   └── types/           # TypeScript typings and Zod schemas (index.ts)
│   ├── index.html           # SPA root HTML template
│   ├── tailwind.config.ts   # Design token utilities
│   ├── tsconfig.json        # TypeScript configuration compiler rules
│   └── vite.config.ts       # Bundler setup (incorporates vite-plugin-pwa)
├── Dockerfile               # Node-alpine docker production packaging script
├── compose.yaml             # Docker Compose local stack Orchestration
├── makeicons.mjs            # Automation script to generate multi-size PWA icons using sharp
├── package.json             # Root-level configuration for runtime commands and server engines
├── pm2.config.js            # Configuration file for production deployment under PM2 supervisor
├── run.sh                   # Deployment bash runner automation script
└── server.js                # Express API gateway server & file backup router
```

---

## ⚙️ Prerequisites & Installation

To run the application locally or deploy it to a server, ensure you have the following installed:
* **Node.js** (version 18.x or above)
* **npm** (comes pre-packaged with Node)

### Installation Steps

1. Clone the repository to your host environment:
   ```bash
   git clone <your-repository-url>
   cd key-stash-manager
   ```

2. Install root-level backend dependencies:
   ```bash
   npm install
   ```

3. Install frontend-specific dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

---

## 🚀 How to Run the Application

Key Stash Manager can be run in standalone developer modes, connected backend modes, or full container environments.

### Development Mode

#### 1. Running Server & Frontend Together (Recommended)
This mode launches the Express server on port `5001` and compiles the frontend using a build trigger.
```bash
npm run dev
```
Open [http://localhost:5001](http://localhost:5001) in your browser.

#### 2. Running Standalone Frontend (Vite HMR)
If you are strictly modifying UI layouts and want Instant Hot Module Replacement (HMR) without restarting the server:
```bash
cd frontend
npm run dev
```
*Note: Standalone frontend runs by default on [http://localhost:5173](http://localhost:5173). In this mode, mock state/localstorage will be used, and sync endpoints will fallback gracefully.*

---

### Production Mode

#### 1. Build the Frontend Assets
Compile the static CSS/JS bundle:
```bash
cd frontend
npm run build
cd ..
```
*The compiled bundle is placed in `frontend/dist/`.*

#### 2. Start the Express Server
Launch the server to host static assets and serve API routes:
```bash
npm start
```
By default, the production app runs at [http://localhost:5001](http://localhost:5001) (or your customized `$PORT`).

---

### Running with PM2

If you use [PM2 Process Manager](https://pm2.keymetrics.io/) to keep services alive in production:

To compile the UI and spin up the backend via PM2:
```bash
bash run.sh
```

Or execute directly using the process config file:
```bash
pm2 start pm2.config.js
```

To stop or monitor the running instance:
```bash
pm2 stop key-stash-manager
pm2 status
```

---

### Docker Deployment

To launch the system using container virtualization, use the included `Dockerfile` and `compose.yaml` configs.

#### Launch with Docker Compose
```bash
docker compose up -d --build
```
This mounts a persistent volume matching your host directory `./data` to the container path `/usr/src/app/data`, ensuring your backup database JSON file persists across container rebuilds and host restarts.

The container listens on port **5000** (mappable in `compose.yaml`).

---

## 🔄 Data Model & Synchronisation

### Zod Validation Schema

Data consistency is strictly enforced on both the client (Zustand) and server (Express API) using **Zod** schema structures.

* **Secret Schema**:
  ```typescript
  {
    id: string;          // UUID v4
    name: string;        // Friendly key title
    value: string;       // Secret value (plaintext)
    tags: string[];      // Categorization tags
    description: string; // Optional metadata description
    createdAt: string;   // ISO Datetime String
    updatedAt: string;   // ISO Datetime String
  }
  ```
* **Folder Schema**:
  ```typescript
  {
    id: string;          // UUID v4 or "default"
    name: string;        // Folder label
    secrets: Secret[];   // Array of Secret payloads
  }
  ```
* **Profile Schema**:
  ```typescript
  {
    id: string;          // UUID v4 or "default"
    name: string;        // Profile label
    folders: Folder[];   // Array of Folders
    createdAt: string;
    updatedAt: string;
  }
  ```
* **Storage Schema**:
  ```typescript
  {
    profiles: Profile[];
    currentProfileId: string;
  }
  ```

---

### Local-First Persistence & Sync Logic

The state cycle is designed to be highly reliable, resilient to networking loss, and fast to load:

1. **Hydration**: When the UI boots (`main.tsx` & `Index.tsx`), it calls `pullChangesFromServer()` in `src/hooks/useSync.tsx`. If the server is offline or unavailable, the app falls back instantly to the browser's `localStorage` cache (`api-key-manager-secrets`).
2. **Local Write-Through**: Every UI transaction (adding a folder, creating a secret, switching a profile) immediately executes an atomic update in the Zustand store and persists directly to browser storage.
3. **Remote Sync Pushes**: Following a successful local write-through, a secondary hook is invoked (`saveChangesToServer()`) that issues a background `POST /api/sync` request with the JSON payload to back up everything to the server's `./data/keys.json` file.

---

### Data Migration (Legacy v1 to V2 Profiles)

Both the Express backend (`server.js`) and Zustand store (`secretsStore.ts`) contain smart data-migration guards to protect legacy datasets.

* **Legacy V1 structure**: `{ folders: [ ... ] }`
* **V2 Profile structure**: `{ profiles: [ { id: "default", name: "Default", folders: [...] } ], currentProfileId: "default" }`

When the app detects a legacy V1 layout, the parser interceptor (`migrateOldData`) wraps the legacy folders array into a newly minted "Default" profile workspace wrapper, assigns default timestamps, and writes it back to storage automatically without user intervention or loss of data.

---

## 🛠️ Utility Scripts

* **`makeicons.mjs`**: Leverages the `sharp` image-processing library to dynamically read the SVG vector icon (`frontend/public/favicon.svg`) and slice/resize it into an array of `.png` sizing assets (`72x72` to `512x512`) used by the Progressive Web App (PWA) manifest configuration.
  ```bash
  node makeicons.mjs
  ```

---

## 💡 Best Practices for Developers

1. **Prioritize Source files over Artifacts**:
   * Never modify the build output directory `frontend/dist/` directly. Always edit within `frontend/src/` and run the Vite bundler (`npm run build`) to generate the output files.
2. **Maintain Zod Schema Synchronisation**:
   * If you add attributes or modify data schemas (e.g., adding an expiration date to a secret), you **must** update the TypeScript interfaces and Zod schemas in *both* `frontend/src/types/index.ts` and the validation schema in `server.js` simultaneously.
3. **Leverage the Deduplication wrapper (`ObjectSet`)**:
   * When importing individual profile files, avoid duplicate records. Utilize `src/lib/ObjectSet.ts` to perform object identity validation before storing.
4. **Use Custom Popover Dialog Elements**:
   * To trigger native HTML `<dialog>` elements within deep tree components without passing drilling triggers, reference the helpers in `src/components/custom/PopoverButtons.tsx`.

---

## 🔒 Security Considerations

> ⚠️ **IMPORTANT WARNING:**
> By default, Key Stash Manager stores values in **plaintext** in `localStorage` and sends them via **plaintext** over REST endpoints (`/api/sync`). There is **no default end-to-end client-side encryption** enabled in the current release.

To protect your credentials in production:
* **Enforce TLS/HTTPS**: Never host the server publicly on plaintext HTTP. Always configure a reverse proxy (e.g., Nginx, Caddy, Cloudflare) with valid SSL/TLS certificates.
* **Firewall / Private Access**: Keep this application within a local network or VPN (e.g., WireGuard, Tailscale) to restrict public exposure.
* **Storage Warnings**: Avoid using this application on public or shared computers, as browser local storage is accessible by anyone with physical access or browser console permissions on that device.
