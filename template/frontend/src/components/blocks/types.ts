// Types des blocs Studio (Chap 24) — miroir du contrat produit par
// studio/manifest.py::to_copier_data() côté Python, consommé ici via
// landing-manifest.json (généré une fois, jamais réécrit par copier update).
export interface CtaPrimary {
  label: string;
  target: string;
}

export interface FeatureItem {
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  features?: string[];
}

export interface LandingBlock {
  type: string;
  id?: string;
  layout?: string;
  headline?: string;
  subhead?: string;
  badge?: string;
  cta_primary?: CtaPrimary;
  items?: (FeatureItem | FaqItem)[];
  quote?: string;
  attribution?: string;
  cta?: string;
  field_placeholder?: string;
  legal_note?: string;
  plans?: PricingPlan[];
}

export interface LandingManifest {
  project: string;
  domain: string;
  skin: string;
  hero_image: string;
  blocks: LandingBlock[];
}
