// Plans and credit rules. Prices are beta hypotheses (INR), see the MVP spec.

export type PlanId = "FREE" | "CREATOR" | "TEAM" | "AGENCY";

export interface PlanDef {
  id: PlanId;
  name: string;
  pricePaise: number; // per month
  videosPerMonth: number; // credits granted per cycle
  brands: number;
  seats: number;
  watermark: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  FREE: { id: "FREE", name: "Free", pricePaise: 0, videosPerMonth: 2, brands: 1, seats: 1, watermark: true, features: ["2 watermarked videos", "1 brand"] },
  CREATOR: { id: "CREATOR", name: "Creator", pricePaise: 299900, videosPerMonth: 8, brands: 1, seats: 1, watermark: false, features: ["8 videos / month", "1 brand", "1 seat"] },
  TEAM: { id: "TEAM", name: "Team", pricePaise: 1499900, videosPerMonth: 40, brands: 3, seats: 5, watermark: false, features: ["40 videos / month", "3 brands", "5 seats", "Reviewer role"] },
  AGENCY: { id: "AGENCY", name: "Agency", pricePaise: 3999900, videosPerMonth: 120, brands: 15, seats: 10, watermark: false, features: ["120 videos / month", "15 brands", "10 seats", "Client workspaces"] },
};

/** Discount applied when the organisation uses its own AI key for every stage. */
export const BYO_KEY_DISCOUNT = 0.4;

export const CREDIT_PACKS = [
  { id: "pack10", credits: 10, pricePaise: 399900 },
  { id: "pack30", credits: 30, pricePaise: 999900 },
];

/** Credits charged for a video: 1 per started 60 s. */
export function creditCost(durationSec: number): number {
  return Math.max(1, Math.ceil(durationSec / 60));
}
