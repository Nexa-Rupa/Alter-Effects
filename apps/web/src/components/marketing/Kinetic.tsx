/** Headline whose letters enter on a staggered keyframe timeline (CSS only; static for reduced motion).
    Words stay unbreakable; screen readers get the plain line. */
export function Kinetic({ lines, className = "" }: { lines: string[]; className?: string }) {
  let i = 0;
  return (
    <span className={`kinetic block ${className}`}>
      <span className="sr-only">{lines.join(" ")}</span>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {line.split(" ").map((word, wi, ws) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {[...word].map((c, ci) => <span key={ci} className="ch" style={{ ["--i" as string]: i++ }}>{c}</span>)}
              {wi < ws.length - 1 && <span className="inline-block w-[0.26em]" />}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
