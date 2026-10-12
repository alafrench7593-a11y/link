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
        <p data-reveal className={`eyebrow ${dark ? "text-accent-bright" : "text-accent"} ${center ? "justify-center" : ""}`}>
          {eyebrow}
        </p>
      )}
      <Split id={id} text={title} className={`mt-4 text-[clamp(2rem,4.6vw,3.6rem)] font-extrabold leading-[1.02] ${dark ? "text-white" : "text-ink"}`} />
      {intro && (
        <p data-reveal style={{ "--d": 150 } as React.CSSProperties} className={`mt-5 text-[1.06rem] leading-relaxed ${dark ? "text-muted-dark" : "text-muted"}`}>
          {intro}
        </p>
      )}
    </div>
  );
}
