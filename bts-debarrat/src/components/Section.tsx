import { Split } from "./Split";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  dark = false,
  center = false,
  id,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  dark?: boolean;
  center?: boolean;
  id?: string;
}) {
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <p data-reveal className={`text-[0.92rem] ${dark ? "text-white/60" : "text-muted"}`}>
          {eyebrow}
        </p>
      )}
      <Split id={id} text={title} className={`mt-3 font-display text-[clamp(1.9rem,4vw,3.3rem)] font-semibold leading-[1.02] tracking-[-0.04em] ${dark ? "text-white" : "text-ink"}`} />
      {intro && (
        <p data-reveal style={{ "--d": 150 } as React.CSSProperties} className={`mt-5 text-[1.05rem] leading-relaxed ${dark ? "text-white/65" : "text-muted"}`}>
          {intro}
        </p>
      )}
    </div>
  );
}
