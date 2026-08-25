import type { FeatureItem, LandingBlock } from "./types";

interface Props {
  block: LandingBlock;
}

export default function Features({ block }: Props) {
  const items = (block.items ?? []) as FeatureItem[];

  return (
    <section className="features" id={block.id}>
      {block.headline && <h2>{block.headline}</h2>}
      {block.layout === "grid" && (
        <div className="feature-grid">
          {items.map((item, i) => (
            <article key={i} className="feature-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      )}
      {block.layout === "alternating" && (
        <ul className="feature-alt">
          {items.map((item, i) => (
            <li key={i}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {block.layout !== "grid" && block.layout !== "alternating" && (
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
