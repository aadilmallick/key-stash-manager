# User Guide & Feature Roadmap: Key Stash Manager 🚀

Welcome to the **Key Stash Manager** user-facing guide! This document explains how to make the most of the app's current tools and previews exciting capabilities planned for future releases.

---

## 🌟 1. Current Features

### 📂 Workspace Profiles
* **What it is**: Contextual workspaces that segment your environments.
* **Why use it**: Keep your credentials separated so you don't accidentally leak production database keys while working on personal side-projects.
* **Usage**: Switch, add, rename, or delete profiles seamlessly using the **Profile Settings** modal in the sidebar.

### 📁 Folder Organization
* **What it is**: Nested containers inside each profile workspace.
* **Why use it**: Categorize secrets within a profile (e.g., have a `Databases` folder, a `Social-Logins` folder, and an `API-Keys` folder).
* **Usage**: Quickly add folders, select folders to view their contents, or delete them (which moves selection to the first available folder).

### 🔑 Secret Management & Masking
* **Robust Secret Fields**: Each secret supports a **Title**, **Secret Value**, **Description**, and custom **Tags**.
* **Masking / Unmasking**: Secret values are masked with bullet characters (`••••••••`) by default to prevent over-the-shoulder leaks. Toggle visibility using the eye icon.
* **Smart Copying**:
  * Copy just the secret value with one click.
  * Copy as an environment declaration format: `NAME="value"` directly, ready for your configuration scripts.

### 🔍 Search & Multi-Tag Filtering
* **Instant Keyboard Search**: Instantly searches across secret names, secret values, and descriptions in real-time as you type.
* **Tag-based Filtering**: Narrow down lists by selecting multiple tags. The UI updates dynamically to show secrets that contain *all* selected tags.

### 📤 Bulk Import & Export Suite
* **`.env` File Importing**:
  * Upload or paste standard `.env` configuration files.
  * The custom parser intelligently skips comments (lines starting with `#`) and empty lines.
  * Updates existing secrets in the current folder with the same name, or creates new ones.
* **`.env` Folder Exporting**:
  * Instantly export any folder as a downloaded `.env` file or copy its content directly to your clipboard.
* **JSON Profile Backups**:
  * Export a single profile as JSON to share with peers.
  * Export your entire multi-profile workspace set for comprehensive offline cold backups.

### 🔄 Local-First Synced Storage
* **Offline-Ready**: The application works completely offline, storing and loading your changes instantly to and from the browser's `localStorage`.
* **Cloud Backup Support**: If connected to the companion Express server, your data is synced instantly inside a server-side JSON file database. If you lose network connection, the app runs offline and syncs your modifications once your server comes back online.

### 📱 Progressive Web App (PWA)
* Installable directly on your desktop or mobile home screen as a standalone desktop app when run in standalone mode.

---

## 💡 2. Best Practices for Users

1. **Workspace Contexts**: Always create separate profiles for different clients or projects.
2. **Back Up Regularly**: Export your profile JSON files periodically and keep them on secure, encrypted media.
3. **Use Descriptive Tags**: Use consistent tags like `prod`, `dev`, `aws`, or `stripe` to find credentials quickly.
4. **Deploy behind HTTPS**: Since sync values travel across the network, ensure your Key Stash Manager server is hosted using an **HTTPS** connection with valid SSL/TLS certificates.

---

## 🗺️ 3. Planned & Future Features Roadmap

The following highly-requested features are currently planned for upcoming releases:

### 🔒 Zero-Knowledge Client-Side Encryption
* **Details**: Enter a master password in your browser. All secrets will be encrypted using **AES-GCM (Web Crypto API)** locally in your browser *before* hitting local storage or syncing with the server.
* **Benefit**: Absolute privacy. Even if an unauthorized user gains physical access to the backend server, the backup file (`keys.json`) will be unreadable without your master password.

### ⚡ Bi-directional Auto-Sync & Real-Time Collaboration
* **Details**: Add background polling and WebSockets to automatically push and pull updates.
* **Benefit**: Sync changes instantly across multiple open tabs or multiple team members without manual sync buttons. Includes smart conflict resolution if the same secret is edited in two places.

### 🎲 Entropy-Based Password Generator
* **Details**: A built-in customizable password generator inside the Secret creation form.
* **Benefit**: Instantly generate high-entropy, secure passwords using rules (choose length, require digits, avoid ambiguous characters, include symbols).

### 📊 Security Strength Audits & Expiration Alerts
* **Details**: A dashboard widget auditing the strength of your stored passwords, alerting you to weak keys, duplicate keys, or credentials that are past their scheduled renewal dates.

### 🔌 Browser Extension & CLI Tool
* **Details**: Connect directly to your self-hosted Key Stash Manager via a dedicated browser extension or terminal command-line tool.
* **Benefit**: Auto-fill credentials in forms or pull secret keys directly into your local terminal environment variables.
