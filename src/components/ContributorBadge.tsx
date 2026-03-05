import { Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BADGE_TIERS = [
  { min: 100, label: "Top Contributor", color: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
  { min: 50, label: "Gold Contributor", color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" },
  { min: 20, label: "Silver Contributor", color: "bg-slate-400/20 text-slate-500 border-slate-400/30" },
  { min: 5, label: "Bronze Contributor", color: "bg-orange-600/20 text-orange-600 border-orange-600/30" },
];

export const getContributorBadge = (uploadCount: number) => {
  return BADGE_TIERS.find((tier) => uploadCount >= tier.min) || null;
};

const ContributorBadge = ({ uploadCount }: { uploadCount: number }) => {
  const tier = getContributorBadge(uploadCount);
  if (!tier) return null;

  return (
    <Badge variant="outline" className={`gap-1 ${tier.color}`}>
      <Award className="w-3 h-3" />
      {tier.label}
    </Badge>
  );
};

export default ContributorBadge;
