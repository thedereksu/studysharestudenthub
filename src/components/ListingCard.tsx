import { useState, useEffect } from "react";
import {
  FileText,
  BookOpen,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  File,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSignedUrls } from "@/lib/storage";
import type { Material } from "@/lib/types";

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

type SubjectCategory = "science" | "language" | "social" | "default";

const subjectCategoryMap: Record<string, SubjectCategory> = {
  Biology: "science",
  Chemistry: "science",
  "Computer Science": "science",
  Engineering: "science",
  "Environmental Science": "science",
  Mathematics: "science",
  Physics: "science",
  English: "language",
  Spanish: "language",
  History: "social",
  Economics: "social",
};

const categoryStyles: Record<SubjectCategory, { bg: string; icon: string; border: string }> = {
  science: {
    bg: "bg-[hsl(var(--subject-science))]",
    icon: "text-[hsl(var(--subject-science-icon))]",
    border: "border-[hsl(var(--subject-science-border))]",
  },
  language: {
    bg: "bg-[hsl(var(--subject-language))]",
    icon: "text-[hsl(var(--subject-language-icon))]",
    border: "border-[hsl(var(--subject-language-border))]",
  },
  social: {
    bg: "bg-[hsl(var(--subject-social))]",
    icon: "text-[hsl(var(--subject-social-icon))]",
    border: "border-[hsl(var(--subject-social-border))]",
  },
  default: {
    bg: "bg-[hsl(var(--subject-default))]",
    icon: "text-[hsl(var(--subject-default-icon))]",
    border: "border-[hsl(var(--subject-default-border))]",
  },
};

const materialTypeIcons: Record<string, React.ElementType> = {
  Notes: FileText,
  "Study Guide": BookOpen,
  "Practice Problems": ClipboardList,
  Summary: FileSpreadsheet,
  "Exam Prep": GraduationCap,
};

const getCategory = (subject: string): SubjectCategory =>
  subjectCategoryMap[subject] || "default";

const ListingCard = ({ material }: { material: Material }) => {
  const navigate = useNavigate();
  const isFree = material.exchange_type === "Free";
  const isPromoted =
    (material as any).is_promoted &&
    (material as any).promotion_expires_at &&
    new Date((material as any).promotion_expires_at) > new Date();

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    getSignedUrls(material.id).then((result) => {
      if (result.files?.[0]?.file_url) {
        setThumbnailUrl(result.files[0].file_url);
      }
    });
  }, [material.id]);

  const showImage = thumbnailUrl && !imgFailed;
  const category = getCategory(material.subject);
  const styles = categoryStyles[category];
  const TypeIcon = materialTypeIcons[material.type] || File;

  return (
    <button
      onClick={() => navigate(`/listing/${material.id}`)}
      className={`bg-card rounded-lg border overflow-hidden text-left w-full animate-fade-in hover:shadow-md transition-shadow ${
        isPromoted
          ? "border-primary ring-1 ring-primary/30"
          : styles.border
      }`}
    >
      <div
        className={`aspect-[4/3] relative flex items-center justify-center overflow-hidden ${
          showImage ? "bg-muted" : styles.bg
        }`}
      >
        {showImage ? (
          <img
            src={thumbnailUrl}
            alt={material.title}
            onError={() => setImgFailed(true)}
            className={`w-full h-full object-cover ${isFree ? "" : "blur-sm scale-110"}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <TypeIcon className={`w-10 h-10 ${styles.icon}`} />
            <span className={`text-[10px] font-medium ${styles.icon} opacity-70`}>
              {material.type}
            </span>
          </div>
        )}
        {isPromoted && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
            ⭐ Promoted
          </span>
        )}
        {(material as any).teacher_approved && !isPromoted && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 flex items-center gap-0.5">
            <ShieldCheck className="w-3 h-3" /> Approved
          </span>
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
        <span className={`text-[10px] font-medium uppercase tracking-wide ${styles.icon}`}>
          {material.subject} · {material.type}
        </span>
        <h3 className="font-sans text-sm font-semibold text-foreground mt-0.5 line-clamp-2 leading-snug">
          {material.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            {material.profiles?.name || "Anonymous"}
            {material.profiles?.has_featured_badge && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary">⭐</span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ListingCard;
