import type { LandingBlock } from "./types";

interface Props {
  block: LandingBlock;
}

export default function Pricing({ block }: Props) {
  const plans = block.plans ?? [];

  return (
    <section className="pricing">
      {block.headline && <h2>{block.headline}</h2>}
      <ul>
        {plans.map((plan, i) => (
          <li key={i}>
            <strong>{plan.name}</strong> — {plan.price}
            <ul>
              {(plan.features ?? []).map((feat, j) => (
                <li key={j}>{feat}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
