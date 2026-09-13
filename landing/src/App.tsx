import { Suspense, useEffect, useRef, useState } from "react";
import { constants } from "./constants";
import { ClerkProvider, PricingTable } from "./clerk/ClerkComponents";

const showScrollPeek = true;
const featuredPlan = "pro";

const paymentConfig = {
  proMonthlyCost: 5,
  proYearlyCost: 41.88,
};

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const valueCards = [
  {
    tag: "COST",
    tagBgClass: "bg-orange-100 text-orange-800",
    title: "Live API Spend Dashboard",
    copy:
      "Stop living in fear of $1,000 surprise bills. Monitor live spend and spending caps across OpenAI, Anthropic, and OpenRouter in one unified view.",
  },
  {
    tag: "SECURITY",
    tagBgClass: "bg-emerald-100 text-emerald-800",
    title: "Zero Slack & Apple Notes Leaks",
    copy:
      "Stop pasting API keys in plain text. Share encrypted .env bundles with co-founders or non-technical clients via one-time magic links.",
  },
  {
    tag: "SIMPLICITY",
    tagBgClass: "bg-blue-100 text-blue-800",
    title: "No Terminal CLIs or RBAC Nightmares",
    copy:
      "Doppler and Infisical are overengineered for solo builders. Get instant drag-and-drop organization with local-first speed.",
  },
];

const steps = [
  {
    num: 1,
    title: "Store Locally",
    copy: "Paste keys into IndexedDB encrypted at rest in your browser memory.",
  },
  {
    num: 2,
    title: "Monitor Spend",
    copy:
      "Connect read-only spend adapters to track live costs and limit thresholds.",
  },
  {
    num: 3,
    title: "Handoff Safely",
    copy:
      "Export encrypted .env files with automated magic-link email verification.",
  },
];

const freeFeatures = [
  "Unlimited key storage",
  "Local IndexedDB encryption",
  "Visual profiles & folders",
  "Manual token export",
];

const proFeatures = [
  "Everything in Free",
  "Real-time API spend monitoring (OpenAI, Anthropic)",
  "Automated magic-link email handoffs",
  "Spending cap alerts",
  "TouchID / WebAuthn passkey vault lock",
];

const faqData = [
  {
    q: `How is ${constants.appName} different from Doppler or Infisical?`,
    a: `Doppler and Infisical are enterprise-grade secret managers engineered for DevOps teams with complex infrastructure, centralized RBAC policies, and terminal CLIs. ${constants.appName} is designed specifically for solo builders, AI engineers, and lean product teams who want an intuitive visual UI, local-first client-side encryption, and instant copy/paste without configuring cloud daemons or managing seat licenses.`,
  },
  {
    q: `Can ${constants.appName} read, log, or store my API keys on your servers?`,
    a: `Never. All secrets and environment variables are encrypted client-side in your browser using the standard Web Crypto API (AES-GCM 256-bit encryption) before being persisted to your browser's IndexedDB. Our servers operate on a zero-knowledge architecture—we never possess your decryption keys and have no ability to read your secrets.`,
  },
  {
    q: `How does live API spend tracking work without leaking my keys?`,
    a: `${constants.appName} securely polls provider billing and usage endpoints (such as OpenAI, Anthropic, and OpenRouter) directly from your client using authenticated read-only balance requests. Your API keys are kept in your local browser sandbox and never relayed through third-party proxy servers.`,
  },
  {
    q: `What export and import formats are supported?`,
    a: `You can import existing secrets by pasting raw key-value pairs or dragging and dropping your .env, .env.local, or JSON configuration files. Exporting is just as simple: generate ready-to-use .env files, formatted JSON payloads, or single-line shell export commands for your terminal with one click.`,
  },
  {
    q: `What is included in the Free plan versus the Pro plan?`,
    a: `The Free tier is free forever and includes unlimited local key storage, visual project profiles, folder categorization, and manual .env exports. The Pro tier (${paymentConfig.proMonthlyCost}/month) is designed for active AI developers needing live multi-provider spend dashboards, spending cap threshold notifications, TouchID / WebAuthn passkey vault protection, and automated magic-link email handoffs.`,
  },
  {
    q: `How does the TouchID / WebAuthn vault lock protect my workstation?`,
    a: `When enabled, ${constants.appName} interfaces with your operating system's hardware security enclave via standard WebAuthn. This requires biometric verification (Touch ID, Face ID, or Windows Hello) before decrypting your credentials, ensuring unauthorized individuals cannot inspect your keys even if your laptop is left unattended.`,
  },
  {
    q: `How can I safely hand off secrets to contractors or teammates?`,
    a: `Instead of pasting sensitive production keys into Slack, Discord, or plaintext email threads, ${constants.appName} enables secure handoffs. You can generate encrypted magic-link bundles protected with ephemeral verification tokens, ensuring only intended recipients can decrypt the environment payload.`,
  },
  {
    q: `Is ${constants.appName} open source and self-hostable?`,
    a: `Yes. The core application is open-source under the MIT license and can be inspected on GitHub. You can run it entirely offline as a local web application, or deploy it into your private cloud using Docker and our lightweight Express backend.`,
  },
];

const isProFeatured = featuredPlan === "pro";

function App() {
  const [openFaq, setOpenFaq] = useState<number>(-1);
  const [typedText, setTypedText] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const twWordIndex = useRef(0);
  const twDeleting = useRef(false);

  const twWords = ["AI Builders", "Freelancers", "Solo devs", "Small Startups"];

  const toggleFaq = (i: number) => {
    setOpenFaq((prev) => (prev === i ? -1 : i));
  };

  const faqItems = faqData.map((f, i) => ({
    ...f,
    onToggle: () => toggleFaq(i),
    isOpen: openFaq === i,
  }));

  useEffect(() => {
    const word = twWords[twWordIndex.current % twWords.length];

    let delay = 70;

    if (!twDeleting.current) {
      if (typedText.length < word.length) {
        delay = 70;
      } else {
        delay = 1500;
      }
    } else {
      if (typedText.length > 0) {
        delay = 40;
      } else {
        delay = 300;
      }
    }

    const timer = setTimeout(() => {
      if (!twDeleting.current) {
        if (typedText.length < word.length) {
          setTypedText(word.slice(0, typedText.length + 1));
        } else {
          twDeleting.current = true;
          setTypedText(word.slice(0, word.length - 1));
        }
      } else {
        if (typedText.length > 0) {
          setTypedText(typedText.slice(0, -1));
        } else {
          twDeleting.current = false;
          twWordIndex.current = (twWordIndex.current + 1) % twWords.length;
          const nextWord = twWords[twWordIndex.current % twWords.length];
          setTypedText(nextWord.slice(0, 1));
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [typedText]);

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen font-sans selection:bg-orange-500 selection:text-white">
      {/* Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-extrabold flex items-center justify-center text-base shadow-sm">
              {constants.appName.charAt(0)}
            </div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">
              {constants.appName}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav
            className="hidden md:flex items-center gap-8"
            aria-label="Main Navigation"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={constants.getUrl()}
              className="border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-xs"
            >
              Launch App
            </a>
            <a
              href="#pricing"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4.5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
            >
              Get Started Free
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileMenuOpen
                ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                )
                : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
            <nav className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-slate-700 hover:text-slate-900 py-1.5 px-2 rounded-md hover:bg-slate-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="pt-2 flex flex-col gap-2.5">
              <a
                href={constants.getUrl()}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center border border-slate-200 bg-white text-slate-900 py-2.5 rounded-lg text-sm font-semibold"
              >
                Launch App
              </a>
              <a
                href={constants.getUrl()}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center bg-orange-500 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm"
              >
                Get Started Free
              </a>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT LANDMARK */}
      <main id="main-content">
        {/* HERO SECTION */}
        <section className="relative min-h-[85vh] overflow-hidden flex flex-col items-center justify-start text-center pt-16 sm:pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[400px] sm:h-[500px] bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-6 border border-emerald-200/80 shadow-xs">
            <span>🔒</span> 100% Local-First &amp; Client-Side Encrypted
          </div>

          <h1 className="max-w-4xl text-2xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.14] tracking-tight mb-6 max-h-12 sm:max-h-36 overflow-y-visible">
            The Visual API{" "}
            <span className="text-orange-500">Key &amp; Secret Manager</span>
            {" "}
            for{" "}
            <span className="text-blue-600 inline-block min-w-[2ch]">
              {typedText || "\u00A0"}
            </span>
            <span className="text-orange-500 animate-pulse font-mono">|</span>
            {" "}
            Who Hate <span className="text-blue-600">DevOps Complexity</span>
          </h1>

          <p className="max-w-2xl pt-12 text-base sm:text-lg lg:text-xl text-slate-600 leading-relaxed mb-8 mx-auto">
            Organize, share, and track live API spend across OpenAI, Anthropic,
            and OpenRouter. Zero CLI required. Free forever for local storage.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto px-4">
            <a
              href="#pricing"
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-7 py-3.5 rounded-xl text-base font-bold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all transform active:scale-95 text-center cursor-pointer"
            >
              Start Managing Secrets — 100% Free
            </a>
            <a
              href={constants.getVideoUrl()}
              className="w-full sm:w-auto bg-blue-50 text-blue-600 hover:bg-blue-100 px-6 py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2.5 transition-colors text-center cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xs">
                <span className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-blue-600 ml-0.5" />
              </span>
              Watch 60s Demo
            </a>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <span>No credit card needed</span>
            <span className="hidden sm:inline">•</span>
            <span>Client-side E2E Encryption</span>
            <span className="hidden sm:inline">•</span>
            <span>No server data access</span>
          </p>

          {/* HERO MOCKUP / PEEK GRAPHIC */}
          {showScrollPeek && (
            <div className="mt-10 sm:mt-12 w-full max-w-4xl mx-auto p-2">
              <div className="relative w-[580px] sm:w-[640px] h-[360px] sm:h-[420px] mx-auto flex-none transition-transform origin-top scale-75 md:scale-100">
                {/* Decorative Tilt Cards */}
                <div className="absolute -top-4 -right-4 w-64 h-72 rounded-3xl bg-gradient-to-br from-orange-100 to-blue-100 rotate-6 shadow-xl border border-white/60 pointer-events-none" />
                <div className="absolute bottom-4 -left-2 w-52 h-60 rounded-2xl bg-emerald-100 -rotate-6 shadow-lg border border-emerald-200/50 pointer-events-none" />

                {/* Main Card Mockup */}
                <div className="absolute top-10 left-8 sm:left-14 w-[480px] sm:w-[520px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-left">
                  <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center gap-2 px-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  </div>
                  <div className="flex h-44">
                    <div className="w-36 sm:w-40 bg-slate-50 border-r border-slate-200 p-3 sm:p-4 text-xs">
                      <div className="font-bold text-slate-900 mb-3 truncate">
                        Future YC company
                      </div>
                      <div className="bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-md mb-1.5">
                        AI keys
                      </div>
                      <div className="text-slate-500 px-2.5 py-1">frontend</div>
                      <div className="text-slate-500 px-2.5 py-1">backend</div>
                    </div>
                    <div className="flex-1 p-3.5 flex flex-col gap-2.5">
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-900 truncate">
                            GEMINI_API_KEY
                          </span>
                          <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            google
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-1">
                          AI••••••••••3fA2
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                          <span>OpenAI Spend</span>
                          <span className="font-bold text-slate-900">
                            $142.50 / $200
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="w-[71%] h-full bg-orange-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Banner */}
                <div className="absolute -top-1 left-2 bg-gradient-to-r from-orange-500 to-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/25 -rotate-2 whitespace-nowrap z-10">
                  <span className="flex items-center gap-0.5">
                    <span className="w-0.5 h-2.5 bg-white/90 rounded-xs" />
                    <span className="w-0.5 h-4 bg-white/90 rounded-xs" />
                    <span className="w-0.5 h-2 bg-white/90 rounded-xs" />
                  </span>
                  Local, Free, Easy, Forever.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* APP INTERACTIVE MOCKUP PREVIEW SECTION */}
        <section
          id="live-spend"
          className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mb-10 tracking-tight">
            Excalidraw{" "}
            <span className="text-orange-500">Simplicity</span>. Enterprise{" "}
            <span className="text-emerald-600">Encryption</span>.
          </h2>

          <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-left">
            {/* Top Window Chrome */}
            <div className="h-11 bg-slate-50 border-b border-slate-200 flex items-center gap-2 px-4.5">
              <div className="w-3 h-3 rounded-full bg-red-400 opacity-60" />
              <div className="w-3 h-3 rounded-full bg-amber-400 opacity-60" />
              <div className="w-3 h-3 rounded-full bg-emerald-400 opacity-60" />
            </div>

            {/* Window Body */}
            <div className="flex flex-col md:flex-row min-h-[520px]">
              {/* Sidebar */}
              <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-5 md:p-6 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 tracking-wider">
                    PROFILE
                  </span>
                  <div className="w-4 h-4 rounded border border-slate-300" />
                </div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-lg font-extrabold text-slate-900">
                    projects
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-5">
                  2 folders • 7 secrets
                </p>

                <div className="h-px bg-slate-200 mb-5" />

                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-500 tracking-wider">
                    FOLDERS
                  </span>
                  <button
                    type="button"
                    aria-label="Add folder"
                    className="w-5 h-5 rounded border border-slate-300 text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-2 text-slate-600 text-sm p-2 rounded-lg mb-1">
                  <span className="w-2 h-2 rounded-xs bg-slate-300" />
                  <span>default</span>
                  <span className="text-slate-400 ml-auto">0</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 text-blue-600 font-semibold text-sm p-2 rounded-lg">
                  <span className="w-2 h-2 rounded-xs bg-blue-500" />
                  <span>link-shortener</span>
                  <span className="text-blue-400 ml-auto">7</span>
                </div>

                <div className="mt-auto pt-6">
                  <div className="bg-slate-900 text-slate-200 rounded-xl p-3 flex items-center gap-2.5">
                    <span className="text-sm">🔒</span>
                    <span className="text-xs font-semibold">
                      Encrypted at rest, client-side
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content Pane */}
              <div className="flex-1 p-5 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                        link-shortener
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Profile: projects
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200/70 self-start sm:self-auto">
                      🔒 E2E Encrypted
                    </span>
                  </div>

                  {/* Toolbar Buttons */}
                  <div className="flex flex-wrap gap-2.5 mb-6">
                    <span className="bg-orange-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs cursor-pointer">
                      ↓ Import Secrets
                    </span>
                    <span className="bg-emerald-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs cursor-pointer">
                      ↓ Import Env File
                    </span>
                    <span className="bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs cursor-pointer">
                      ↑ Export All Profiles
                    </span>
                    <span className="bg-white text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs cursor-pointer">
                      Export Folder
                    </span>
                    <span className="bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs cursor-pointer">
                      + Add Secret
                    </span>
                  </div>

                  <div className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-slate-400 text-xs sm:text-sm mb-6 bg-slate-50/50">
                    Search secrets...
                  </div>

                  {/* Spend Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between text-xs text-slate-600 mb-2">
                        <span>OpenAI API Spend</span>
                        <span className="font-bold text-slate-900">
                          $142.50 / $200 cap
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="w-[71%] h-full bg-orange-500" />
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between text-xs text-slate-600 mb-2">
                        <span>Anthropic API Spend</span>
                        <span className="font-bold text-slate-900">
                          $58.00 / $150 cap
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="w-[39%] h-full bg-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* Secret Card Items */}
                  <div className="space-y-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900 text-sm">
                          GOOGLE_CLIENT_SECRET
                        </span>
                        <div className="flex gap-1.5">
                          <span className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                            ✎
                          </span>
                          <span className="w-7 h-7 rounded-md border border-red-200 flex items-center justify-center text-red-500 text-xs">
                            🗑
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-slate-400 bg-slate-50 rounded-md px-3 py-1.5 my-2 tracking-widest">
                        ••••••••••••••••
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Created 6/1/2026 • Updated 6/1/2026
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900 text-sm">
                          GOOGLE_CLIENT_ID
                        </span>
                        <div className="flex gap-1.5">
                          <span className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                            ✎
                          </span>
                          <span className="w-7 h-7 rounded-md border border-red-200 flex items-center justify-center text-red-500 text-xs">
                            🗑
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-slate-400 bg-slate-50 rounded-md px-3 py-1.5 my-2 tracking-widest">
                        ••••••••••••••••
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Created 6/1/2026 • Updated 6/1/2026
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VALUE PROPOSITIONS SECTION */}
        <section
          id="features"
          className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-b border-slate-200"
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 text-center mb-10 max-w-2xl mx-auto tracking-tight">
            Built for solo builders who'd rather{" "}
            <span className="text-blue-600">ship</span> than manage secrets
          </h2>

          {/* ASCII Art Wrapper */}
          <div
            className="kt-ascii-wrap will-change-transform scale-75 md:scale-100"
            aria-hidden="true"
          >
            <div className="kt-ascii-w2">
              <pre className="kt-ascii-text">
{`                    @@@@@@@@@
               @@@#=:......:=*%@@@
            @@+:.................=@@@
         @@*:.......................*@@
        @*............................*@
      @@:...............................@@     @@@@
     @#..................................#@ @@#...%%
    @%....................................#@*.....#@
   @@.............................................+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
   @=.........:............................................................................:+@@
  @%......-@#-:-#%-............................................................................%@
  @*.....+%.......#+............................................................................=@
  @+.....%:.......=%.....................=+++++******###########%%%%#########******+++++++=====@@
  @+.....*+.......*#........................:*#=---=====+++++*****#####%%%%%%%%%%%%%#####****@@
  @*......#%:...:%*...............................................==...........:@+.........#@@
  @%........:***-.................................-@@@@@@@-.....=@@@@=.......:%@ @@#....:#@
   @-.............................................-@      @%-.-@@    @@=...:%@      @@@@@@
   @@......................................+:.....-@%       @@@        @@@@@
    @#....................................#@@@#:..-@%
     @#..................................#@    @@%@@
      @@:...............................@@
        @*............................*@
         @@*........................+@@
            @@+:.................=@@@
               @@@*=:......:-+%@@@
                    @@@@@@@@@`}
              </pre>
            </div>
          </div>

          {/* Value Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {valueCards.map((card, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 hover:shadow-md transition-shadow"
              >
                <div
                  className={`inline-block text-xs font-bold tracking-wider px-2.5 py-1 rounded-md mb-4 ${card.tagBgClass}`}
                >
                  {card.tag}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2.5">
                  {card.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {card.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section
          id="how-it-works"
          className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 text-center mb-14 tracking-tight">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-4xl mx-auto relative">
            <div className="hidden md:block absolute top-5 left-[16%] right-[16%] h-0.5 bg-slate-200 -z-0" />
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="text-center relative z-10 flex flex-col items-center"
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-base flex items-center justify-center mb-5 shadow-sm">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                  {step.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 text-center mb-10 tracking-tight">
            Frequently Asked Questions
          </h2>

          <div className="max-w-2xl mx-auto space-y-3">
            {faqItems.map((item, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs"
              >
                <button
                  type="button"
                  id={`faq-btn-${idx}`}
                  aria-expanded={item.isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  onClick={() => item.onToggle()}
                  className="w-full flex justify-between items-center p-5 text-left font-semibold text-slate-900 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-base sm:text-lg">{item.q}</span>
                  <span
                    aria-hidden="true"
                    className={`text-xl text-slate-400 transition-transform duration-200 ${
                      item.isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    ⌄
                  </span>
                </button>
                {item.isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                    className="px-5 pb-5 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-3"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <CustomPricingTable />
      <ClerkPricingTable />

      {/* FOOTER */}
      <footer className="py-8 px-4 sm:px-8 lg:px-12 border-t border-slate-200 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center">
            {constants.appName.charAt(0)}
          </div>
          <span className="text-xs sm:text-sm text-slate-500">
            © 2026 {constants.appName}. All rights reserved.
          </span>
        </div>
        <a
          href={constants.getGithubUrl()}
          target="_blank"
          rel="noreferrer"
          className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}

function CustomPricingTable() {
  return (
    <section
      id="pricing"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-b border-slate-200"
    >
      <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 text-center mb-14 tracking-tight">
        Simple, <span className="text-emerald-600">Honest</span> Pricing
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
        {/* Free Tier */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div>
            <div className="text-xl font-bold text-slate-900 mb-2">Free</div>
            <div className="text-4xl font-extrabold text-slate-900 mb-6">
              $0
              <span className="text-base font-normal text-slate-400">
                /mo
              </span>
            </div>
            <div className="space-y-3 mb-8">
              {freeFeatures.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 text-sm text-slate-700"
                >
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          {
            /* <a
            href={constants.getUrl()}
            className="block text-center border border-blue-600 text-blue-600 hover:bg-blue-50 py-3 rounded-xl text-sm font-bold transition-colors"
          >
            Use Free Forever
          </a> */
          }
        </div>

        {/* Pro Tier */}
        <div className="bg-white border-2 border-orange-500 rounded-2xl p-8 sm:p-10 flex flex-col justify-between shadow-lg relative">
          {isProFeatured && (
            <div className="absolute -top-3.5 left-8 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-orange-200">
              MOST POPULAR
            </div>
          )}
          <div>
            <div className="text-xl font-bold text-slate-900 mb-2">Pro</div>
            <div className="text-4xl font-extrabold text-slate-900 mb-6">
              ${paymentConfig.proMonthlyCost}
              <span className="text-base font-normal text-slate-400">
                /mo
              </span>
            </div>
            <div className="space-y-3 mb-8">
              {proFeatures.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 text-sm text-slate-700"
                >
                  <span className="text-orange-500 font-bold">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          {
            /* <a
            href={constants.getUrl()}
            className="block text-center bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 transition-colors"
          >
            Start 14-Day Free Trial
          </a> */
          }
        </div>
      </div>
    </section>
  );
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkPricingTable() {
  if (!clerkPublishableKey) {
    return null;
  }

  return (
    <section
      id="clerk-pricing"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-b border-slate-200"
    >
      <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 text-center mb-14 tracking-tight">
        <span className="text-orange-500">Start Now</span>
      </h2>
      <div className="max-w-4xl mx-auto p-1">
        <Suspense fallback={<div className="text-center py-8 text-slate-500 font-medium">Loading pricing plans...</div>}>
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <PricingTable
              appearance={{
                elements: {
                  pricingTableCard: {
                    borderWidth: 2,
                    borderRadius: "1.5rem",
                    borderColor: "#e5e7eb",
                  },
                  pricingTableCardFeatured: {
                    borderColor: "#f97316",
                  },
                },
                variables: {
                  colorPrimary: "#ff9900",
                  // colorText: "#333333",
                  colorBackground: "#ffffff",
                  colorBorder: "#e5e7eb",
                },
              }}
              newSubscriptionRedirectUrl={constants.getUrl()}
            />
          </ClerkProvider>
        </Suspense>
      </div>
    </section>
  );
}

export default App;
