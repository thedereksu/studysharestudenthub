import { Star, FileText, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Material } from "@/lib/types";

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

const ListingCard = ({ material }: { material: Material }) => {
  const navigate = useNavigate();
  const isImage = material.file_type.startsWith("image/");

  return (
    <button
      onClick={() => navigate(`/listing/${material.id}`)}
      className="bg-card rounded-lg border border-border overflow-hidden text-left w-full animate-fade-in hover:shadow-md transition-shadow"
    >
      <div className="aspect-[4/3] bg-muted relative flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img src={material.file_url} alt={material.title} className="w-full h-full object-cover blur-sm scale-110" />
        ) : (
          <FileText className="w-8 h-8 text-muted-foreground" />
        )}
        <span
          className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            exchangeBadgeClass[material.exchange_type] || ""
          }`}
        >
          {material.exchange_type}
        </span>
      </div>

      <div className="p-3">
        <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
          {material.subject} · {material.type}
        </span>
        <h3 className="font-sans text-sm font-semibold text-foreground mt-0.5 line-clamp-2 leading-snug">
          {material.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">{material.profiles?.name || "Anonymous"}</span>
        </div>
      </div>
    </button>
  );
};

export default ListingCard;
