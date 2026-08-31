import { useState } from "react";
import { ChevronDown, ScanLine, Award, MapPin } from "lucide-react";

import { useTranslation } from "react-i18next";

export default function FAQPage() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      title: t('faqPage.q1'),
      icon: ScanLine,
      content: t('faqPage.a1'),
    },
    {
      title: t('faqPage.q2'),
      icon: Award,
      content: t('faqPage.a2'),
    },
    {
      title: t('faqPage.q3'),
      icon: MapPin,
      content: t('faqPage.a3'),
    },
  ];

  return (
    <div className="px-6 md:px-16 lg:px-24 py-16">
      <div className="max-w-4xl mx-auto">
        <span className="status-terminal block mb-4">
          {t('faqPage.watermark')}
        </span>

        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          {t('faqPage.titleLine1')}
          <br />
          <span className="text-neon">{t('faqPage.titleLine2')}</span>
        </h1>

        <p className="text-on-surface-variant mb-12">
          {t('faqPage.subtitle')}
        </p>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-surface-mid hover:bg-surface-high transition-colors duration-200"
            >
              <button
                className="w-full p-5 flex items-center justify-between text-left"
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              >
                <div className="flex items-center gap-3">
                  <faq.icon size={20} className="text-neon" />
                  <span className="font-semibold">{faq.title}</span>
                </div>

                <ChevronDown
                  size={18}
                  className={`transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openIndex === index && (
                <div className="px-5 pb-5">
                  <p className="text-on-surface-variant">
                    {faq.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}