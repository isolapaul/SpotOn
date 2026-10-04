import type { OnboardingStep } from '@/lib/onboarding';
import WelcomeStep from './steps/WelcomeStep';
import NameStep from './steps/NameStep';
import { AddStep, DiscoverStep, LevelsStep } from './steps/MapSteps';
import LocationStep from './steps/LocationStep';
import InstallStep from './steps/InstallStep';
import SignupStep from './steps/SignupStep';

export interface StepContentProps {
  step: OnboardingStep;
  returning: boolean;
  /** The name later steps greet with: the chosen one, or a returning user's username. */
  greetName: string | null;
  /** The name field's current value. */
  name: string;
  onName: (name: string) => void;
  onNext: () => void;
  onBack: () => void;
  onNameNext: () => void;
  onNameLater: () => void;
  onEmail: () => void;
  onFinish: () => void;
}

/** One step's cards (the scene behind them is MapScene). */
export default function StepContent(p: Readonly<StepContentProps>) {
  switch (p.step) {
    case 'welcome':
      return <WelcomeStep returning={p.returning} username={p.greetName} onNext={p.onNext} />;
    case 'name':
      return <NameStep name={p.name} onName={p.onName} onNext={p.onNameNext} onLater={p.onNameLater} />;
    case 'discover':
      return <DiscoverStep onNext={p.onNext} onBack={p.onBack} />;
    case 'add':
      return <AddStep onNext={p.onNext} onBack={p.onBack} />;
    case 'levels':
      return <LevelsStep name={p.greetName} onNext={p.onNext} onBack={p.onBack} />;
    case 'location':
      return <LocationStep onNext={p.onNext} />;
    case 'install':
      return <InstallStep onNext={p.onNext} />;
    case 'signup':
      return <SignupStep name={p.greetName} onEmail={p.onEmail} onLater={p.onFinish} />;
  }
}
