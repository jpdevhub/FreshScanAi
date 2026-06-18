import Joyride, { type Step } from "react-joyride";
import { useTranslation } from 'react-i18next';

interface Props {
  run: boolean;
}

export default function OnboardingTour({ run }: Props) {
  const { t } = useTranslation();
  const steps: Step[] = [
    {
      target: "body",
      content: t('onboarding.welcome'),
      placement: "center",
    },
    {
      target: "a[href='/scanner']",
      content: t('onboarding.scannerTip'),
    },
    {
      target: "a[href='/map']",
      content: t('onboarding.mapTip'),
    },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: "#eab308",
          backgroundColor: "#111111",
          textColor: "#ffffff",
          arrowColor: "#111111",
        },
        tooltip: {
          borderRadius: 0,
        },
        tooltipContainer: {
          border: "3px solid #eab308",
          borderRadius: 0,
          boxShadow: "none",
          textAlign: "left",
        },
        buttonNext: {
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
      }}
    />
  );
}
