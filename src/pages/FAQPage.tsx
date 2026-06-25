import { useState } from "react";
import { ChevronDown, ScanLine, Award, MapPin } from "lucide-react";

const faqs = [
  {
    title: "How should I position the fish for scanning?",
    icon: ScanLine,
    content:
      "Place the fish on a flat surface with good lighting. Keep the camera around 15 cm away and ensure the whole fish is visible.",
  },
  {
    title: "What do the freshness scores mean?",
    icon: Award,
    content:
      "Scores range from 0 to 100. Higher scores indicate fresher fish. Scores above 80 are considered high quality.",
  },
  {
    title: "How does the Market Map work?",
    icon: MapPin,
    content:
      "The Market Map displays freshness trends from anonymized scan results and helps users identify reliable seafood vendors.",
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="px-6 md:px-16 lg:px-24 py-16">
      <div className="max-w-4xl mx-auto">
        <span className="status-terminal block mb-4">
          USER_GUIDE_AND_FAQ
        </span>

        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          How To Use
          <br />
          <span className="text-neon">FreshScan AI</span>
        </h1>

        <p className="text-on-surface-variant mb-12">
          Learn how to scan fish correctly, understand freshness scores,
          and use the Market Map effectively.
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