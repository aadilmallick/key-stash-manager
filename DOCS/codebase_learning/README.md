# 📚 KeyStash Engineering Bootcamp: Complete Curriculum Index

Welcome to the **Key Stash Manager Codebase & Engineering Masterclass**. This directory contains an in-depth, 12-module software engineering curriculum designed like a top-tier coding bootcamp.

Each module balances high-level computer science concepts with hands-on, production-grade TypeScript code examples pulled directly from the KeyStash architecture.

---

## 🗺️ Curriculum Table of Contents

| Module | Title | Primary Technologies | Core Engineering Concepts |
| :---: | :--- | :--- | :--- |
| **[00](./00-welcome-and-curriculum-roadmap.md)** | **Welcome & Curriculum Roadmap** | Monorepo Map, Tech Stack | Local-first philosophy, zero-knowledge security, syllabus navigation |
| **[01](./01-architecture-and-codebase-tour.md)** | **Architecture & Codebase Tour** | React 18, Vite, App Shell, Netlify | Monorepo layout, React 18 providers, end-to-end request/mutation lifecycle |
| **[02](./02-local-first-data-layer.md)** | **The Local-First Data Layer** | `@tanstack/db`, `wa-sqlite`, OPFS | WebAssembly SQLite, browser file systems, reactive queries (`useLiveQuery`), batch updates |
| **[03](./03-cryptography-101-and-encryption-at-rest.md)** | **Cryptography 101 & Encryption at Rest** | Web Crypto API, AES-256-GCM, IndexedDB | AEAD ciphers, 12-byte IVs, non-extractable keys, dual-store physical isolation |
| **[04](./04-end-to-end-encryption-deep-dive.md)** | **End-to-End Encryption Deep Dive** | PBKDF2, Key Stretching, One-Time Shares | Zero-knowledge architecture, 600k-iteration key derivation, out-of-band token sharing |
| **[05](./05-webauthn-and-hardware-passkeys.md)** | **WebAuthn & Hardware Passkeys** | FIDO2, WebAuthn PRF Extension, HKDF | Biometric authentication, Secure Enclaves, hardware-derived cryptographic vault keys |
| **[06](./06-ui-component-architecture-radix-shadcn-tailwind.md)** | **UI Component Architecture** | Radix UI, Tailwind CSS, `cva`, `cmdk` | Headless accessible primitives, WAI-ARIA, design token conflict merging (`cn`), spotlight search |
| **[07](./07-forms-validation-and-drag-and-drop.md)** | **Forms, Validation & Drag-and-Drop** | `react-hook-form`, `zod`, `react-dnd` | Uncontrolled input performance, runtime schema validation, midpoint reordering math |
| **[08](./08-tracking-api-spend-and-proxy-architecture.md)** | **Tracking API Spend & Proxy Architecture** | Node.js, CommonJS/ESM, Netlify Functions | Token economics, CORS bypass, SSRF prevention, ProviderAdapter pattern |
| **[09](./09-auth-and-monetization-clerk.md)** | **Auth & Monetization (Clerk & Paywalls)** | `@clerk/react`, Clerk Billing, Paywalls | Feature-gated authentication, entitlement checks (`has`), zero-network CI testing bypass |
| **[10](./10-full-stack-sync-and-migration-patterns.md)** | **Full-Stack Sync & Migration Patterns** | Express 5, Zod Schemas, JSON Store | Relational vs nested wire formats, backward-compatible migrations, hydration race guards |
| **[11](./11-testing-and-production-hardening.md)** | **Testing, Quality & Production Hardening** | Vitest, Playwright, Docker Multi-Stage | Mocking IndexedDB, E2E browser drag-and-drop automation, production verification checklist |

---

## 📖 Key Architectural Glossary

* **AEAD (Authenticated Encryption with Associated Data)**: An encryption algorithm (like AES-GCM) that provides simultaneous confidentiality, integrity, and authenticity checks.
* **CORS (Cross-Origin Resource Sharing)**: A browser security mechanism restricting web pages from making AJAX/fetch requests to a different domain unless that server explicitly responds with permissive headers.
* **HKDF (HMAC-based Key Derivation Function)**: A two-step key derivation function (extract and expand) that stretches raw pseudorandom secrets into cryptographically strong symmetric keys.
* **Local-First**: A software architecture where all reads and writes execute against local device storage by default, with remote synchronization operating as an asynchronous background convenience.
* **Non-Extractable Key**: A Web Crypto `CryptoKey` handle where the browser guarantees the raw key bytes can never be extracted or exported back to JavaScript.
* **OPFS (Origin Private File System)**: A fast, private, browser-native file system accessible to the web origin, allowing synchronous byte-level file access within Web Workers.
* **PBKDF2**: A key-stretching algorithm that runs hundreds of thousands of hashing iterations to convert a human passphrase into a secure cryptographic key.
* **PRF (Pseudo-Random Function) Extension**: An advanced WebAuthn capability allowing a biometric hardware authenticator to deterministically evaluate an HMAC with a salt to produce symmetric encryption keys.
* **SSRF (Server-Side Request Forgery)**: A vulnerability where a server can be tricked into making requests to internal or unintended network destinations.
