# 🎓 Module 00: Welcome & Curriculum Roadmap

> **Welcome to the KeyStash Engineering Bootcamp!**  
> You are embarking on a deep-dive journey through the modern full-stack TypeScript landscape. We are going to deconstruct, analyze, and master every single architectural layer of **Key Stash Manager**—a production-grade, local-first secrets manager.

---

## 🌟 The Philosophy of Key Stash Manager

Before writing a single line of code, every great engineer asks: **What problem are we solving, and what principles guide our architectural decisions?**

Key Stash Manager was built around four foundational engineering tenets:

1. **Local-First & Offline-Native**: Your secrets and API keys belong to you. Data is stored on your device inside an embedded, browser-native SQLite database powered by WebAssembly (WASM) and the Origin Private File System (OPFS). The application boots instantaneously without waiting for a cloud backend.
2. **Zero-Knowledge & Defensive Cryptography**: Secret payloads are encrypted at rest using the browser's hardware-accelerated **Web Crypto API (AES-256-GCM)**. The encryption keys are stored separately in IndexedDB as non-extractable cryptographic handles, ensuring the database file itself cannot be read if copied from disk.
3. **Stateless Cloud Integration**: When cloud services are needed—such as checking LLM API spend against OpenAI or OpenRouter—the backend acts strictly as a stateless, non-logging, SSRF-resistant proxy that bridges CORS gaps without ever persisting user secrets.
4. **Frictionless Developer Experience**: The UI combines the best of Radix UI primitives, Tailwind CSS, command-palette navigation (`cmdk`), and desktop-caliber drag-and-drop reordering.

---

## 🧭 Tech Stack & Third-Party Library Matrix

During this course, you will not just read theory; you will master the specific, battle-tested libraries powering KeyStash:

| Layer | Technologies & Libraries | Key Concepts You Will Learn |
| :--- | :--- | :--- |
| **Core UI & Framework** | React 18, TypeScript (Strict), Vite | Reactivity, Concurrent Mode, Tree-shaking, SWC compiler |
| **Local-First Database** | `@tanstack/db`, `@tanstack/react-db`, `@journeyapps/wa-sqlite`, `@tanstack/browser-db-sqlite-persistence` | WebAssembly SQLite, OPFS file storage, Reactive live queries (`useLiveQuery`), relational indexing |
| **Cryptography & Auth** | Web Crypto API (`SubtleCrypto`), AES-256-GCM, IndexedDB, WebAuthn / Passkeys, PBKDF2, HKDF | Symmetric AEAD ciphers, non-extractable key handles, hardware enclaves, biometric key derivation via PRF extension |
| **Design System & Primitives** | Tailwind CSS, Radix UI Primitives, `class-variance-authority` (cva), `clsx`, `tailwind-merge` | Headless accessible components, design tokens, compound variants, dynamic styling utility |
| **Interactive UI** | `cmdk`, `react-dnd` (HTML5 Backend), `sonner`, `lucide-react`, `next-themes` | Spotlight command palettes, physics of mouse drag-and-drop reordering, toasts, theme toggling |
| **Forms & Validation** | `react-hook-form`, `zod`, `@hookform/resolvers` | Uncontrolled input performance, runtime type validation, dual-schema synchronization |
| **Auth & Monetization** | `@clerk/react`, `@clerk/backend` | Modern `<Show>` authorization, feature-gated tiered billing paywalls, CI bypass techniques |
| **Backend & Serverless** | Express.js 5, Netlify Functions, CommonJS/ESM Dual-Runtime | Serverless wrappers, SSRF defense, CORS proxies, JSON-file persistence |
| **Testing & Automation** | Vitest, `@playwright/test`, `fake-indexeddb` | Unit testing async cryptography, mocking OPFS/IDB, automated end-to-end browser workflows |

---

## 🗺️ Complete 12-Lesson Curriculum Outline

Here is your roadmap through this bootcamp. Each module is self-contained yet builds directly upon the previous lesson:

```
DOCS/codebase_learning/
├── 00-welcome-and-curriculum-roadmap.md                   <-- You are here
├── 01-architecture-and-codebase-tour.md                  <-- Monorepo anatomy & app lifecycle
├── 02-local-first-data-layer.md                          <-- TanStack DB, wa-sqlite (WASM) & OPFS
├── 03-cryptography-101-and-encryption-at-rest.md         <-- Web Crypto API & AES-256-GCM
├── 04-end-to-end-encryption-deep-dive.md                 <-- Zero-Knowledge, PBKDF2 & One-Time Shares
├── 05-webauthn-and-hardware-passkeys.md                  <-- FIDO2, Biometrics & WebAuthn PRF Keys
├── 06-ui-component-architecture-radix-shadcn-tailwind.md <-- Design systems, Radix UI & Tailwind
├── 07-forms-validation-and-drag-and-drop.md              <-- React Hook Form, Zod & React-DnD
├── 08-tracking-api-spend-and-proxy-architecture.md       <-- LLM Token Economics, CORS & SSRF Defense
├── 09-auth-and-monetization-clerk.md                     <-- Feature-gated Auth, Billing & CI Bypass
├── 10-full-stack-sync-and-migration-patterns.md          <-- Express REST, Wire Formats & Auto-Migrations
└── 11-testing-and-production-hardening.md               <-- Vitest, Playwright & Capstone Project
```

---

## 💡 How to Study This Curriculum

As your bootcamp instructor, here is my recommended methodology to get the most value out of every module:

1. **Read the Concept**: Understand the "why" before looking at the "how". Why do browsers block cross-origin requests? Why do we use OPFS instead of localStorage?
2. **Trace the Architecture Diagrams**: Study the visual flow diagrams provided in each chapter.
3. **Inspect the Real Code**: Each lesson links directly to production files inside `frontend/src/` and `server.js`. Open those files in your editor alongside the lesson.
4. **Study the Standalone Code Examples**: Every chapter provides complete, copy-pasteable TypeScript snippets showing how to implement the pattern from scratch in your own projects.
5. **Heed the "Gotchas"**: Pre-1.0 libraries, browser quirks, and asynchronous race conditions have bitten engineers before. We document every single hard-won lesson.
6. **Complete the Lab Exercises**: Each module ends with a hands-on coding challenge to test your mastery.

Let's dive in! Proceed to [Module 01: Architecture & Codebase Tour](./01-architecture-and-codebase-tour.md).
