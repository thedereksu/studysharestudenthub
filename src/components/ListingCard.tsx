import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSignedUrls } from "@/lib/storage";
import type { Material } from "@/lib/types";

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

const ListingCard = ({ material }: { material: Material }) => {
  const navigate = useNavigate();
  const primaryFile = material.files?.[0] || { file_url: material.file_url, file_type: material.file_type };
  const isImage = primaryFile.file_type?.startsWith("image/");
  const isFree = material.exchange_type === "Free";

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;

    getSignedUrls(material.id).then((result) => {
      if (result.files?.[0]?.file_url) {
        setThumbnailUrl(result.files[0].file_url);
      }
    });
  }, [material.id, isImage]);

  return (
    <button
      onClick={() => navigate(`/listing/${material.id}`)}
      className="bg-card rounded-lg border border-border overflow-hidden text-left w-full animate-fade-in hover:shadow-md transition-shadow"
    >
      <div className="aspect-[4/3] bg-muted relative flex items-center justify-center overflow-hidden">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={material.title}
            className={`w-full h-full object-cover ${isFree ? "" : "blur-sm scale-110"}`}
          />
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
