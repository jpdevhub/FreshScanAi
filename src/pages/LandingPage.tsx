import { Link } from 'react-router-dom';
import { isAuthenticated } from '../lib/api';
import { Zap, Eye, MapPin, ScanLine, Target, Award, ChevronDown } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { useState, useEffect } from 'react';

const features = [
  {
    icon: Zap,
    title: 'Dual-Stream Context',
    desc: 'Simultaneous processing of specular reflection and biological texture for high-humidity environments.',
  },
  {
    icon: Eye,
    title: 'Explainable AI',
    desc: "Don't just trust a grade. See highlighted markers on the gills, eyes, and scales in real-time.",
  },
  {
    icon: MapPin,
    title: 'Crowdsourced Map',
    desc: 'Live freshness heatmaps across local markets powered by anonymized user metadata.',
  },
];

const steps = [
  {
    icon: ScanLine,
    step: '01',
    title: 'Scan Body',
    desc: 'Position camera 15cm from specimen. Use ambient light or built-in strobe.',
  },
  {
    icon: Target,
    step: '02',
    title: 'Target Biomarkers',
    desc: 'AI identifies gill saturation, corneal clarity, and epidermal tension.',
  },
  {
    icon: Award,
    step: '03',
    title: 'Get Grade',
    desc: 'Instant Freshness Index (0-100) generated with storage recommendations.',
  },
];

const faqs = [
  {
    q: 'What biomarkers does FreshScan AI analyze?',
    a: 'Our edge-AI model evaluates gill color saturation (hemoglobin oxidation), corneal opacity index, epidermal mucus viscosity, and scale reflectance patterns using dual-stream spectral analysis.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. The TFLite model runs entirely on-device. No server connection is required for scanning. Market map and sync features need connectivity.',
  },
  {
    q: 'What species are supported?',
    a: 'Currently trained on 47 freshwater and saltwater species common to South Asian wet markets. Custom model training for your region available on Enterprise plan.',
  },
  {
    q: 'How accurate is the Freshness Index?',
    a: 'Our model achieves 98.9% accuracy on the FreshBench-2026 benchmark, validated against laboratory histamine and TVB-N measurements.',
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => setLoggedIn(isAuthenticated());
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  return (
    <div className="relative">
      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 md:px-16 lg:px-24 py-20 overflow-hidden text-center">
        <div className="relative z-10 max-w-5xl mx-auto">
          <h1 className="font-headline text-[3.5rem] md:text-[5rem] lg:text-[7rem] leading-[1.05] font-extrabold tracking-tighter text-white mb-8">
            Fish Freshness
            <br />
            <span className="text-neon italic block mt-2 md:mt-3">*Objectively Graded*</span>
          </h1>

          <p className="text-on-surface-variant text-base md:text-lg max-w-xl leading-relaxed mb-10 font-[family-name:var(--font-body)] mx-auto">
            Academic-grade AI vision engineered for real-time biomarker analysis
            in high-humidity environments.
          </p>

          {/* Stat Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <GlassCard className="px-6 py-4" variant="glass">
              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-1">
                Inference Speed
              </span>
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-neon">
                &lt;50ms
              </span>
            </GlassCard>
            <GlassCard className="px-6 py-4" variant="glass">
              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-1">
                Biomarker Accuracy
              </span>
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-neon">
                98.9%
              </span>
            </GlassCard>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/mode"
              className="bg-neon text-on-primary px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline transition-all duration-200 hover:bg-neon-dim pulse-glow inline-flex items-center gap-3"
            >
              <ScanLine size={18} />
              BEGIN_ASSESSMENT
            </Link>
            {!loggedIn && (
              <Link
                to="/auth"
                className="hidden md:inline-flex bg-transparent text-neon px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline ghost-border transition-all duration-200 hover:bg-surface-high items-center gap-3"
              >
                INITIALIZE_SESSION
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-surface-low px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <span className="status-terminal block mb-4">CORE_MODULES</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
            Intelligence designed
            <br />
            for the <span className="text-neon">wet market</span>
          </h2>
          <p className="text-on-surface-variant mb-16 max-w-lg">
            Three specialized AI pipelines working in concert to deliver
            laboratory-grade freshness analysis on consumer hardware.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <GlassCard key={i} className="p-8" hover variant="tonal">
                <div className="w-12 h-12 bg-surface-highest flex items-center justify-center mb-6">
                  <f.icon size={22} className="text-neon" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-[family-name:var(--font-display)]">
                  {f.title}
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  {f.desc}
                </p>
                <span className="status-terminal block mt-6 text-[0.5625rem]">
                  MODULE_{String(i + 1).padStart(2, '0')}: LOADED
                </span>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <span className="status-terminal block mb-4">SCAN_PROTOCOL</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-16 tracking-tight">
            Three steps to
            <br />
            <span className="text-neon">certainty</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-0">
            {steps.map((s, i) => (
              <div
                key={i}
                className="relative p-8 bg-surface-mid border-l-2 border-neon/20 transition-colors duration-200 hover:bg-surface-high"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {/* Step number */}
                <span className="font-[family-name:var(--font-display)] text-6xl font-bold text-surface-highest absolute top-4 right-6 select-none">
                  {s.step}
                </span>

                <div className="relative z-10">
                  <div className="w-10 h-10 bg-neon/10 flex items-center justify-center mb-5">
                    <s.icon size={20} className="text-neon" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 font-[family-name:var(--font-display)]">
                    {s.title}
                  </h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <GlassCard className="mt-8 p-6 md:p-8" variant="glass">
            <p className="text-on-surface-variant text-sm leading-relaxed italic">
              "FreshScan AI transforms the chaotic wet market into a structured,{' '}
              <span className="text-neon not-italic font-semibold">
                transparent ecosystem
              </span>
              ."
            </p>
          </GlassCard>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-surface-low px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <span className="status-terminal block mb-4">PROTOCOL_FAQ</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-12 tracking-tight">
            Frequently Asked
            <br />
            <span className="text-neon">Questions</span>
          </h2>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-surface-mid transition-colors duration-200 hover:bg-surface-high cursor-pointer"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="flex items-center justify-between p-5">
                  <h4 className="font-[family-name:var(--font-display)] text-sm font-semibold pr-4">
                    {faq.q}
                  </h4>
                  <ChevronDown
                    size={18}
                    className={`text-neon shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''
                      }`}
                  />
                </div>
                {openFaq === i && (
                  <div className="px-5 pb-5 animate-in">
                    <p className="text-on-surface-variant text-sm leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <span className="status-terminal block mb-4">ASSESSMENT_READY</span>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tighter">
            First Class
            <br />
            <span className="text-neon">Assessment</span>
          </h2>
          <p className="text-on-surface-variant mb-10 max-w-lg mx-auto">
            Deploy laboratory-grade freshness analysis directly to your mobile device.
            No subscription. No cloud dependency.
          </p>
          <Link
            to="/scanner"
            className="bg-neon text-on-primary px-10 py-5 font-[family-name:var(--font-display)] font-bold text-base tracking-wider no-underline transition-all duration-200 hover:bg-neon-dim pulse-glow inline-flex items-center gap-3"
          >
            <ScanLine size={20} />
            LAUNCH_SCANNER
          </Link>
        </div>
      </section>
    </div>
  );
}
