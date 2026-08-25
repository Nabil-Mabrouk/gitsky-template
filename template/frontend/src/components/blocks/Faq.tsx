import type { FaqItem, LandingBlock } from "./types";

interface Props {
  block: LandingBlock;
}

export default function Faq({ block }: Props) {
  const items = (block.items ?? []) as FaqItem[];

  return (
    <section className="faq" id={block.id}>
      {block.headline && <h2>{block.headline}</h2>}
      {block.layout === "accordion" ? (
        <div className="faq-accordion">
          {items.map((item, i) => (
            <details key={i}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
