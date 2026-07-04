import { WALKTHROUGH } from "../lib/walkthrough.ts";

export function Walkthrough({
  step,
  onPrev,
  onNext,
  onExit,
}: {
  step: number;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}): JSX.Element | null {
  const current = WALKTHROUGH[step];
  if (!current) return null;
  const last = step === WALKTHROUGH.length - 1;

  return (
    <div className="wt-bar">
      <div className="wt-body">
        <div className="wt-step">
          WALKTHROUGH · STEP {step + 1} / {WALKTHROUGH.length}
        </div>
        <div className="wt-title">{current.title}</div>
        <div className="wt-text">{current.narrative}</div>
      </div>
      <button className="btn ghost" onClick={onExit}>Exit</button>
      <button className="btn ghost" onClick={onPrev} disabled={step === 0}>← Back</button>
      <button className="btn" onClick={last ? onExit : onNext}>
        {last ? "Finish" : "Next →"}
      </button>
    </div>
  );
}
