import { Fragment, createElement, type ElementType } from "react";

/** Titre découpé en mots, chaque mot monte dans un masque à l'apparition. */
export function Split({
  as = "h2",
  text,
  className,
  delay = 0,
  hero = false,
  id,
}: {
  as?: ElementType;
  text: string;
  className?: string;
  delay?: number;
  hero?: boolean;
  id?: string;
}) {
  const mots = text.split(" ");
  return createElement(
    as,
    {
      className,
      id,
      "data-split": hero ? undefined : "",
      style: { "--d": delay } as React.CSSProperties,
    },
    mots.map((mot, i) => (
      <Fragment key={i}>
        <span className={hero ? "split-word hero-word" : "split-word"} style={{ "--i": i } as React.CSSProperties}>
          <span>{mot}</span>
        </span>
        {i < mots.length - 1 ? " " : null}
      </Fragment>
    )),
  );
}
