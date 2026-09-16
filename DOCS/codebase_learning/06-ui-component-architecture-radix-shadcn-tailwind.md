# 🎨 Module 06: UI Component Architecture (Radix, Tailwind & shadcn)

> **Instructor**: "In early frontend development, developers wrote thousands of lines of custom CSS and wrestled with jQuery modal popups. Today, world-class frontend engineering is about composition: combining unstyled, fully accessible headless primitives with utility-first design tokens."

---

## 🏛️ 1. The Modern React UI Stack

Key Stash Manager’s design system is built on a proven three-layer architecture:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: shadcn/ui Components (Button, Dialog, Input) │  <-- Your Codebase
├─────────────────────────────────────────────────────────┤
│  Layer 2: Tailwind CSS & CVA (Tokens, Spacing, States)  │  <-- Styling Engine
├─────────────────────────────────────────────────────────┤
│  Layer 1: Radix UI Primitives (WAI-ARIA, Focus, A11y)   │  <-- Headless Behavior
└─────────────────────────────────────────────────────────┘
```

### Why Headless Primitives?
Building accessible web components from scratch is deceptively hard:
* How do you trap keyboard focus inside a modal dialog so `Tab` doesn't leak into background elements?
* How do you ensure `Escape` closes the active popover?
* How do screen readers announce open/collapsed states with correct `aria-expanded` and `role="dialog"` attributes?

**Radix UI** handles 100% of the accessibility, focus management, and keyboard event plumbing without adding any opinionated CSS styles!

---

## 🧩 2. Radix Primitives Used in KeyStash

Let's examine how KeyStash leverages the Radix component library:

| Radix Primitive | KeyStash Usage | Built-in Accessibility Features |
| :--- | :--- | :--- |
| **`@radix-ui/react-dialog`** | `SecretModal.tsx`, `ExportSecretsModal.tsx` | Focus trapping, body scroll lock, screen reader backdrop portal |
| **`@radix-ui/react-dropdown-menu`** | Profile selection menu, secret action menus | Arrow key navigation (`ArrowUp`/`ArrowDown`), typeahead matching |
| **`@radix-ui/react-tabs`** | Switching between "Secrets Vault" and "API Spend" | Keyboard arrow navigation, automatic `aria-selected` toggling |
| **`@radix-ui/react-tooltip`** | Action button helper hints (Copy, Edit, Delete) | Hover delay timers, collision-aware auto-positioning |
| **`@radix-ui/react-slot`** | The polymorphic `asChild` composition pattern | Merges props and DOM nodes without rendering extra wrapper `<div>`s |

### The `asChild` Pattern
The `asChild` pattern from `@radix-ui/react-slot` is one of the most powerful concepts in modern React. Instead of rendering its own default HTML tag (like a `<button>`), it merges all accessibility handlers directly onto its immediate child:

```tsx
// Using asChild to make an anchor tag act as an accessible dialog trigger:
<DialogTrigger asChild>
  <a href="/help" className="text-sm font-medium hover:underline">
    Open Help Center
  </a>
</DialogTrigger>
```

---

## 🎨 3. Styling Architecture: `cva`, `clsx`, and `tailwind-merge`

In [frontend/src/lib/utils.ts](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/lib/utils.ts), you will find the single most important utility in modern Tailwind development:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Why do we need BOTH `clsx` and `tailwind-merge`?
1. **`clsx`** handles conditional classes:
   ```typescript
   clsx("btn", isSelected && "btn-active", isDisabled ? "opacity-50" : "opacity-100")
   ```
2. **`tailwind-merge`** resolves **Tailwind class conflicts**:
   In regular CSS, class order in the stylesheet wins, NOT the class order in the HTML string!
   ```typescript
   // Without twMerge:
   // "px-4" and "px-2" both get rendered, causing unexpected padding bugs!
   clsx("px-4", "px-2") // => "px-4 px-2" (Which one wins? Depends on stylesheet order!)

   // With twMerge:
   twMerge(clsx("px-4", "px-2")) // => "px-2" (Intelligently overrides px-4!)
   ```

---

### Class Variance Authority (`cva`)
`class-variance-authority` lets us create type-safe component variants with full autocomplete:

```tsx
// frontend/src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

Now, TypeScript guarantees that callers can only pass valid variants:
```tsx
<Button variant="destructive" size="sm">Delete Secret</Button>
```

---

## ⚡ 4. Specialized Interactive Components

### A. Command Palette with `cmdk`
In [frontend/src/components/search/GlobalSearchModal.tsx](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/components/search/GlobalSearchModal.tsx), pressing `Ctrl+K` or `Cmd+K` launches a lightning-fast spotlight search:
* Created by Paco Coursey, `cmdk` delivers 60fps keyboard navigation, live fuzzy filtering, and accessible ARIA listbox roles.

### B. High-Performance Toasts with `sonner`
Toast notifications provide instantaneous user feedback (e.g. *"API Key copied to clipboard"*):
* `sonner` stacks toasts cleanly, supports swipe-to-dismiss, and uses CSS transforms for butter-smooth 120Hz mobile animations:
```typescript
import { toast } from "sonner";

toast.success("Secret decrypted and copied to clipboard!");
```

### C. Tree-Shakeable Icons with `lucide-react`
Lucide provides crisp, lightweight SVG icons.
> ⚠️ **Selector Gotcha**: Lucide renders classes in `lucide-{kebab-case}` format. Note that digits are not separated by hyphens! For example, `<Trash2 />` renders with the class `lucide-trash2`, **not** `lucide-trash-2`. Keep this in mind when writing Playwright selectors!

---

## 🏋️ Bootcamp Lab Exercise 6

### Objective:
Create a reusable, accessible UI badge with variant styling.

1. Create a conceptual component `frontend/src/components/ui/badge.tsx` using `cva`:
   - Variants: `default` (slate), `success` (emerald), `warning` (amber), `danger` (rose).
   - Sizes: `sm` (text-xs px-2 py-0.5), `md` (text-sm px-2.5 py-1).
2. Test passing dynamic classes to your badge using `cn(badgeVariants({ variant: "success" }), className)`.
3. Question: Why should you avoid putting `@apply` rules all over your CSS files and instead use `cva` in TypeScript?  
   *(Answer: `cva` gives you full TypeScript type-safety, autocompletion in your IDE, easy conditional branching, and works cleanly with tree-shaking!)*

---

Next, let's explore forms, validation, and desktop drag-and-drop: Proceed to [Module 07: Forms, Validation & Drag-and-Drop](./07-forms-validation-and-drag-and-drop.md).
