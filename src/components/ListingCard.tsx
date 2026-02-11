import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Listing } from "@/data/mockData";

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

const ListingCard = ({ listing }: { listing: Listing }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="bg-card rounded-lg border border-border overflow-hidden text-left w-full animate-fade-in hover:shadow-md transition-shadow"
    >
      {/* Preview area */}
      <div className="aspect-[4/3] bg-muted relative flex items-center justify-center">
        <div className="text-muted-foreground text-xs font-medium">Preview</div>
        <span
          className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            exchangeBadgeClass[listing.exchangeType]
          }`}
        >
          {listing.exchangeType === "Paid" ? `${listing.credits} credits` : listing.exchangeType}
        </span>
      </div>

      <div className="p-3">
        <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
          {listing.subject} · {listing.type}
        </span>
        <h3 className="font-sans text-sm font-semibold text-foreground mt-0.5 line-clamp-2 leading-snug">
          {listing.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">{listing.author.name}</span>
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-accent text-accent" />
            <span className="text-[11px] font-medium text-foreground">{listing.rating}</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default ListingCard;
