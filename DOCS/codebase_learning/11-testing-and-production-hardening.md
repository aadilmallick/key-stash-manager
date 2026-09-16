# 🚀 Module 11: Testing, Quality & Production Hardening

> **Instructor**: "Congratulations on reaching the final module of the KeyStash Engineering Bootcamp! You now understand local-first databases, modern cryptography, headless UI primitives, and cloud proxies. In this capstone module, we will learn how to verify, test, and ship our software with 100% confidence using Vitest, Playwright, and Docker."

---

## 🧪 1. The Testing Pyramid for Local-First Apps

Testing a local-first application requires a balanced strategy across three levels:

```
          ▲
         / \
        / E2E \       Playwright (Full Browser Automation, Real IndexedDB/OPFS)
       /───────\
      /  Integr \     Migrations, Store Hydration, Dual Wire Formats
     /───────────\
    /  Unit Tests \   Vitest (Crypto, Reorder Math, Secret Filters, Adapters)
   /───────────────\
```

1. **Unit Tests (Vitest)**: Instant feedback (<1s). Tests pure mathematical algorithms, parsing logic, and cryptographic transforms without mounting the DOM.
2. **Integration Tests**: Tests database collections, schema validation, and legacy migrations.
3. **End-to-End Tests (Playwright)**: Runs real headless Chromium, Firefox, and WebKit browsers to verify user workflows, mouse drag-and-drop actions, and keyboard navigation.

---

## ⚡ 2. Unit Testing with Vitest & `fake-indexeddb`

In [frontend/vitest.config.ts](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/vitest.config.ts), we configure our test runner:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["fake-indexeddb/auto"], // Injects mock IndexedDB into Node!
    include: ["src/**/*.test.ts", "netlify/functions/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### Why `fake-indexeddb/auto` is Essential:
Node.js and `jsdom` have built-in `crypto.subtle` (Node 18+), but standard Node has **no native IndexedDB implementation**. By importing `fake-indexeddb/auto`, our vault key tests in `crypto.test.ts` can open object stores, write `CryptoKey` objects, and read them back in an in-memory test environment!

---

## 🎭 3. Automated Browser Testing with Playwright

Playwright runs our actual compiled application inside real browser rendering engines.

Let's look at how [frontend/e2e/drag-and-drop.spec.ts](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/e2e/drag-and-drop.spec.ts) automates mouse drag-and-drop:

```typescript
test("reorders folders via drag and drop", async ({ page }) => {
  await page.goto("/");

  // 1. Locate the drag handles for Folder A and Folder B
  const sourceHandle = page.locator('[data-testid="folder-drag-handle-folder-1"]');
  const targetHandle = page.locator('[data-testid="folder-drag-handle-folder-2"]');

  // 2. Perform accurate mouse drag using Playwright's locator.dragTo()
  await sourceHandle.dragTo(targetHandle);

  // 3. Verify that the order updated in the DOM
  const folderNames = await page.locator(".folder-item-title").allTextContents();
  expect(folderNames[0]).toBe("Folder B");
  expect(folderNames[1]).toBe("Folder A");

  // 4. Reload page to prove persistence in OPFS SQLite!
  await page.reload();
  const persistedNames = await page.locator(".folder-item-title").allTextContents();
  expect(persistedNames[0]).toBe("Folder B");
});
```

---

## 📦 4. Production Hardening & Docker Containerization

When deploying KeyStash self-hosted with Docker, we use a multi-stage [Dockerfile](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/Dockerfile) to produce an ultra-lean production image:

```dockerfile
# Stage 1: Build the Vite React Frontend
FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=build /app/frontend/dist ./frontend/dist
COPY frontend/netlify/functions/_shared ./frontend/netlify/functions/_shared

EXPOSE 3000
ENV VITE_USING_SERVER=true
CMD ["node", "server.js"]
```

### Key Architectural Optimizations:
1. **Multi-stage build**: Compiles the frontend assets using Vite, then discards the TypeScript compiler, devDependencies, and raw source files.
2. **Alpine Linux base**: Keeps the final container image under ~120 MB.
3. **Volume Mount**: In `compose.yaml`, the `data/` directory is mounted to persistent host storage so `keys.json` survives container restarts.

---

## ✅ 5. The Engineering Release Checklist

Before pushing any commit or submitting a pull request, every professional software engineer runs the **Verification Gauntlet**:

```bash
# 1. Type Check & Compile Frontend
cd frontend && npm run build

# 2. Run Linting (Check stylistic & syntactic rules)
npm run lint

# 3. Run All Unit & Integration Tests
npm test

# 4. Run End-to-End Smoke Tests (with testing bypass)
VITE_IS_TESTING=true npm run test:e2e
```

If all 4 commands exit with code `0`, your code is certified production-ready!

---

## 🎓 6. Bootcamp Capstone Challenge

You have graduated from apprentice to master of the KeyStash architecture! To prove your skills, here is your capstone challenge:

### The Capstone Task: Add an "Expiry Date" to Secrets
1. **Schema Update**: Update `secretRowSchema` in `frontend/src/lib/db/schema.ts` with `expiryDate: z.string().optional()`.
2. **Sync Update**: Update `Secret` in `types/index.ts` and `secretSchema` in `server.js`.
3. **UI Update**: Add an optional date picker in `SecretModal.tsx` using `react-day-picker`.
4. **Visual Indicator**: In `SecretRow.tsx`, display an amber badge if the secret has expired.
5. **Test**: Write a unit test asserting that expired secrets filter correctly!

---

Congratulations! You have completed the **Key Stash Manager Codebase Learning Curriculum**! 🎉  
Keep this documentation handy as your architectural reference manual.
