import { Link } from 'react-router-dom';
import { isAuthenticated } from '../lib/api';
import { Zap, Eye, MapPin, ScanLine, Target, Award, ChevronDown } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";

export default function LandingPage() {
  const { t } = useTranslation();

      const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());

  const features = [
    {
      icon: Zap,
      title: t('landing.dualStreamTitle'),
      desc: t('landing.dualStreamDesc'),
    },
    {
      icon: Eye,
      title: t('landing.explainableAITitle'),
      desc: t('landing.explainableAIDesc'),
    },
    {
      icon: MapPin,
      title: t('landing.crowdsourcedTitle'),
      desc: t('landing.crowdsourcedDesc'),
    },
  ];

  const steps = [
    {
      icon: ScanLine,
      step: '01',
      title: t('landing.scanBodyTitle'),
      desc: t('landing.scanBodyDesc'),
    },
    {
      icon: Target,
      step: '02',
      title: t('landing.targetBiomarkersTitle'),
      desc: t('landing.targetBiomarkersDesc'),
    },
    {
      icon: Award,
      step: '03',
      title: t('landing.getGradeTitle'),
      desc: t('landing.getGradeDesc'),
    },
  ];

  const faqs = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
  ];

  useEffect(() => {
    const handleAuthChange = () => setLoggedIn(isAuthenticated());
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  return (
    <div id="landing-top" className="relative">
      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 md:px-16 lg:px-24 py-20 overflow-hidden text-center">
        <div className="relative z-10 max-w-5xl mx-auto">
          <h1 className="font-headline text-[3.5rem] md:text-[5rem] lg:text-[7rem] leading-[1.05] font-extrabold tracking-tighter text-white mb-8">
            {t('landing.heroLine1')}
            <br />
            <span className="text-neon italic block mt-2 md:mt-3">{t('landing.heroLine2')}</span>
          </h1>

          <p className="text-on-surface-variant text-base md:text-lg max-w-xl leading-relaxed mb-10 font-[family-name:var(--font-body)] mx-auto">
            {t('landing.heroSubtitle')}
          </p>

          {/* Stat Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <GlassCard className="px-6 py-4" variant="glass">
              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-1">
                {t('landing.inferenceSpeed')}
              </span>
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-neon">
                {t('landing.speedValue')}
              </span>
            </GlassCard>
            <GlassCard className="px-6 py-4" variant="glass">
              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-1">
                {t('landing.biomarkerAccuracy')}
              </span>
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-neon">
                {t('landing.accuracyValue')}
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
              {t('landing.beginAssessment')}
            </Link>
            {!loggedIn && (
              <Link
                to="/auth"
                className="hidden md:inline-flex bg-transparent text-neon px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline ghost-border transition-all duration-200 hover:bg-surface-high items-center gap-3"
              >
                {t('landing.initializeSession')}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-surface-low px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <span className="status-terminal block mb-4">{t('landing.coreModulesTitle')}</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('landing.intelligenceFor')}
            <br />
            {t('landing.forThe')} <span className="text-neon">{t('landing.wetMarket')}</span>
          </h2>
          <p className="text-on-surface-variant mb-16 max-w-lg">
            {t('landing.moduleDescription')}
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
                  {t('landing.moduleLoaded', { num: String(i + 1).padStart(2, '0') })}
                </span>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <span className="status-terminal block mb-4">{t('landing.scanProtocolTitle')}</span>
          <h2 className="text-3xl md:text-5xl font-bold mb-16 tracking-tight">
            {t('landing.stepsTo')}
            <br />
            <span className="text-neon">{t('landing.certainty')}</span>
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
              &ldquo;
              <Trans
                i18nKey="landing.heroDescription"
                components={{ 1: <span className="text-neon not-italic font-semibold" /> }}
              />
              &rdquo;
            </p>
          </GlassCard>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-surface-low px-6 md:px-16 lg:px-24 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <span className="status-terminal block mb-4">{t('landing.faqTitle')}</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-12 tracking-tight">
            {t('landing.frequentlyAsked')}
            <br />
            <span className="text-neon">{t('landing.questions')}</span>
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
          <span className="status-terminal block mb-4">{t('landing.assessmentReady')}</span>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tighter">
            {t('landing.firstClass')}
            <br />
            <span className="text-neon">{t('landing.assessment')}</span>
          </h2>
          <p className="text-on-surface-variant mb-10 max-w-lg mx-auto">
            {t('landing.readyDescription')}
          </p>
          <Link
            to="/scanner"
            className="bg-neon text-on-primary px-10 py-5 font-[family-name:var(--font-display)] font-bold text-base tracking-wider no-underline transition-all duration-200 hover:bg-neon-dim pulse-glow inline-flex items-center gap-3"
          >
            <ScanLine size={20} />
            {t('landing.launchScanner')}
          </Link>
        </div>
      </section>
      {/* <BackToTopButton /> */}
    </div>
  );
}
