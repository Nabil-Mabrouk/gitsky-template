import type { LandingBlock } from "./types";

interface Props {
  block: LandingBlock;
}

export default function Testimonial({ block }: Props) {
  const isCard = block.layout === "card";
  return (
    <section className={`testimonial${isCard ? " testimonial-card" : ""}`}>
      <blockquote>{block.quote}</blockquote>
      <p>— {block.attribution}</p>
    </section>
  );
}
