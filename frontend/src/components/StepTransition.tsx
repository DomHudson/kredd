import { ReactNode } from 'react';

interface StepTransitionProps {
  stepKey: string | number;
  children: ReactNode;
  direction?: 1 | -1;
}

export function StepTransition({ stepKey, children, direction = 1 }: StepTransitionProps) {
  return (
    <div
      key={stepKey}
      className={direction > 0 ? 'animate-slide-from-right' : 'animate-slide-from-left'}
    >
      {children}
    </div>
  );
}
