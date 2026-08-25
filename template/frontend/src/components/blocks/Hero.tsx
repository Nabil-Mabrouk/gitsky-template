import type { LandingBlock } from "./types";

interface Props {
  block: LandingBlock;
  heroImage: string;
}

export default function Hero({ block, heroImage }: Props) {
  const isSplit = block.layout === "split";
  const panel = heroImage ? (
    <img className="hero-panel" src={heroImage} alt="" />
  ) : (
    <div className="hero-panel" aria-hidden="true" />
  );

  return (
    <section className={`hero${isSplit ? " hero--split" : ""}`}>
      {isSplit ? (
        <>
          <div>
            {block.badge && <p className="badge">{block.badge}</p>}
            <h1>{block.headline}</h1>
            <p>{block.subhead}</p>
            {block.cta_primary && (
              <a className="btn" href={block.cta_primary.target}>
                {block.cta_primary.label}
              </a>
            )}
          </div>
          {panel}
        </>
      ) : (
        <>
          {block.badge && <p className="badge">{block.badge}</p>}
          <h1>{block.headline}</h1>
          <p>{block.subhead}</p>
          {block.cta_primary && (
            <a className="btn" href={block.cta_primary.target}>
              {block.cta_primary.label}
            </a>
          )}
          {heroImage && <img className="hero-image" src={heroImage} alt="" />}
        </>
      )}
    </section>
  );
}
