import { Joyride, type Step } from "react-joyride";
import { useTranslation } from 'react-i18next';

interface Props {
  run: boolean;
}

export default function OnboardingTour({ run }: Props) {
  const { t } = useTranslation();
  const steps: Step[] = [
    {
      target: "body",
      content: t('components.onboardingTour.welcomeMessage'),
      placement: "center",
    },
    {
      target: "a[href='/scanner']",
      content: t('components.onboardingTour.scannerStep'),
    },
    {
      target: "a[href='/map']",
      content: t('components.onboardingTour.mapStep'),
    },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      styles={{
        tooltipContainer: {
          border: "3px solid #eab308",
          borderRadius: 0,
          boxShadow: "none",
          textAlign: "left",
        },
        buttonPrimary: {
          backgroundColor: "#eab308",
          color: "#000000",
          borderRadius: 0,
        },
        buttonBack: {
          color: "#eab308",
        },
        buttonSkip: {
          color: "#ffffff",
        },
        tooltip: {
          borderRadius: 0,
        },
      }}
      options={{
        showProgress: true,
        buttons: ["back", "close", "primary", "skip"],
        primaryColor: "#eab308",
        backgroundColor: "#111111",
        textColor: "#ffffff",
        zIndex: 10000,
      }}
    />
  );
}