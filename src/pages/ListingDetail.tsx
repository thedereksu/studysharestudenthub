import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, BookOpen, FileText, Download, Eye, Coins, Star, Pencil, Megaphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherRole } from "@/hooks/useTeacherRole";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import { getSignedUrls } from "@/lib/storage";
import CommentsSection from "@/components/CommentsSection";
import ReportModal from "@/components/ReportModal";
import TeacherApprovedBadge from "@/components/TeacherApprovedBadge";
import PostAIChatBubble from "@/components/PostAIChatBubble";
import PostAIChatSidebar from "@/components/PostAIChatSidebar";
import type { Material, MaterialFile, Review } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PROMO_TIERS = [
  { id: "24h", label: "24 Hours", credits: 3 },
  { id: "3d", label: "3 Days", credits: 8 },
  { id: "7d", label: "7 Days", credits: 20 },
];

const PromoteTierMenu = ({ materialId, promoting, onPromote }: { materialId: string; promoting: boolean; onPromote: (tier: string) => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="secondary" disabled={promoting}>
        <Megaphone className="w-4 h-4 mr-1" />
        {promoting ? "Promoting..." : "Promote"}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {PROMO_TIERS.map((tier) => (
        <DropdownMenuItem key={tier.id} onClick={() => onPromote(tier.id)}>
          {tier.label} — {tier.credits} credits
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

const StarRating = ({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        disabled={!interactive}
        onClick={() => onRate?.(star)}
        className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
      >
        <Star
          className={`w-5 h-5 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
        />
      </button>
    ))}
  </div>
);

const FileItem = ({ file, canAccess }: { file: MaterialFile; canAccess: boolean }) => {
  const isImage = file.file_type.startsWith("image/");
  return (
    <a
      href={canAccess && file.file_url ? file.file_url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 bg-secondary rounded-lg p-3 ${canAccess && file.file_url ? "hover:bg-muted" : "opacity-50 pointer-events-none"} transition-colors`}
    >
      {isImage ? <Eye className="w-4 h-4 text-muted-foreground shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className="text-sm text-foreground truncate flex-1">{file.file_name}</span>
      <Download className="w-4 h-4 text-muted-foreground shrink-0" />
    </a>
  );
};

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTeacher } = useTeacherRole();
  const { toast } = useToast();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [approvingTeacher, setApprovingTeacher] = useState(false);

  // Signed URL state
  const [signedFiles, setSignedFiles] = useState<MaterialFile[]>([]);
  const [canAccessFiles, setCanAccessFiles] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const fetchSignedUrls = async (materialId: string) => {
    const result = await getSignedUrls(materialId);
    setSignedFiles(result.files);
    setCanAccessFiles(result.canAccess);
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("materials")
        .select("*, profiles!materials_uploader_id_profiles_fkey(*)")
        .eq("id", id)
        .single();
      setMaterial(data as unknown as Material | null);

      if (user && data) {
        const { data: unlockData } = await supabase
          .from("unlocks")
          .select("id")
          .eq("user_id", user.id)
          .eq("material_id", data.id)
          .maybeSingle();
        setUnlocked(!!unlockData);
      }

      // Fetch reviews
      if (data) {
        const { data: reviewsData } = await supabase
          .from("reviews")
          .select("*")
          .eq("material_id", data.id);
        const r = (reviewsData || []) as unknown as Review[];
        setReviews(r);

        if (user) {
          const mine = r.find((rev) => rev.reviewer_id === user.id);
          if (mine) {
            setExistingReview(mine);
            setUserRating(mine.rating);
          }
        }

        // Fetch signed URLs
        await fetchSignedUrls(data.id);
      }

      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  const isOwner = user && material && user.id === material.uploader_id;
  const isFree = material?.exchange_type === "Free";
  const isPaid = material?.exchange_type === "Paid";
  const isTrade = material?.exchange_type === "Trade";
  const canAccess = canAccessFiles;

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleUnlock = async () => {
    if (!user || !material) return;
    setUnlocking(true);
    try {
      const { data, error } = await supabase.rpc("unlock_material", {
        p_material_id: material.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: "Cannot unlock", description: result.error, variant: "destructive" });
      } else {
        setUnlocked(true);
        toast({ title: "Material unlocked!", description: "You now have full access." });
        // Refresh signed URLs after unlock
        await fetchSignedUrls(material.id);
      }
    } catch (error: any) {
      toast({ title: "Unlock failed", description: sanitizeError(error), variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  };

  const handleOpenDM = () => {
    if (material?.uploader_id && user && material.uploader_id !== user.id) {
      navigate(`/chat/${material.uploader_id}`);
    }
  };

  const handleSubmitReview = async (rating: number) => {
    if (!user || !material || isOwner) return;
    setSubmittingReview(true);
    setUserRating(rating);
    try {
      if (existingReview) {
        const { error } = await supabase
          .from("reviews")
          .update({ rating })
          .eq("id", existingReview.id);
        if (error) throw error;
        setExistingReview({ ...existingReview, rating });
        setReviews((prev) => prev.map((r) => r.id === existingReview.id ? { ...r, rating } : r));
        toast({ title: "Review updated!" });
      } else {
        const { data, error } = await supabase
          .from("reviews")
          .insert({ material_id: material.id, reviewer_id: user.id, rating })
          .select()
          .single();
        if (error) throw error;
        const newReview = data as unknown as Review;
        setExistingReview(newReview);
        setReviews((prev) => [...prev, newReview]);
        toast({ title: "Review submitted!" });
      }
    } catch (error: any) {
      toast({ title: "Review failed", description: sanitizeError(error), variant: "destructive" });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">Loading...</div>;
  if (!material) return <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">Material not found.</div>;

  const primarySignedFile = signedFiles[0];
  const isImage = primarySignedFile?.file_type?.startsWith("image/");
  const uploaderName = material.profiles?.name || "Anonymous";

  return (
    <>
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">Details</span>
      </div>

      {/* Preview image */}
      <div className="aspect-[4/3] bg-muted mx-4 rounded-lg flex items-center justify-center relative overflow-hidden">
        {isImage && primarySignedFile?.file_url ? (
          <img
            src={primarySignedFile.file_url}
            alt={material.title}
            className={`w-full h-full object-cover ${canAccess ? "" : "blur-md scale-110"}`}
          />
        ) : (
          <FileText className="w-12 h-12 text-muted-foreground" />
        )}
        {!canAccess && (
          <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center gap-2">
            <Lock className="w-8 h-8 text-foreground" />
            <span className="text-xs font-medium text-foreground">Preview locked</span>
            <span className="text-[10px] text-muted-foreground">
              {isPaid ? `Unlock for ${material.credit_price} credits` : "Complete exchange to view"}
            </span>
          </div>
        )}
        <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${exchangeBadgeClass[material.exchange_type] || ""}`}>
          {material.exchange_type}
        </span>
      </div>

      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">{material.subject}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] font-medium text-muted-foreground">{material.type}</span>
          {material.teacher_approved && <TeacherApprovedBadge />}
        </div>

        <h1 className="text-xl text-foreground leading-tight mb-1">{material.title}</h1>

        {/* Rating summary */}
        <div className="flex items-center gap-2 mb-2">
          {reviews.length > 0 ? (
            <>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(avgRating) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No reviews yet</span>
          )}
        </div>

        <span className="text-xs text-muted-foreground">
          {new Date(material.created_at).toLocaleDateString()}
        </span>

        {material.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-4 mb-6">{material.description}</p>
        )}

        {/* Uploader */}
        <button
          onClick={handleOpenDM}
          disabled={!user || !!isOwner}
          className="flex items-center gap-3 bg-secondary rounded-lg p-3 mb-6 w-full text-left hover:bg-muted transition-colors disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-foreground">{uploaderName}</span>
            {user && !isOwner && (
              <p className="text-[10px] text-muted-foreground">Tap to message</p>
            )}
          </div>
        </button>

        {/* Files list */}
        {signedFiles.length > 1 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Files ({signedFiles.length})
            </h3>
            <div className="space-y-2">
              {signedFiles.map((f, i) => (
                <FileItem key={i} file={f} canAccess={canAccess} />
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {isFree && primarySignedFile?.file_url && (
            <Button className="flex-1" asChild>
              <a href={primarySignedFile.file_url} target="_blank" rel="noopener noreferrer">
                {isImage ? <><Eye className="w-4 h-4 mr-1" /> View</> : <><Download className="w-4 h-4 mr-1" /> Download</>}
              </a>
            </Button>
          )}

          {isPaid && !canAccess && (
            <Button className="flex-1" onClick={handleUnlock} disabled={unlocking || !user}>
              <Coins className="w-4 h-4 mr-1" />
              {unlocking ? "Unlocking..." : `Unlock for ${material.credit_price} Credits`}
            </Button>
          )}

          {isPaid && canAccess && primarySignedFile?.file_url && (
            <Button className="flex-1" asChild>
              <a href={primarySignedFile.file_url} target="_blank" rel="noopener noreferrer">
                {isImage ? <><Eye className="w-4 h-4 mr-1" /> View</> : <><Download className="w-4 h-4 mr-1" /> Download</>}
              </a>
            </Button>
          )}

          {isTrade && !canAccess && (
            <Button className="flex-1" onClick={handleOpenDM} disabled={!user}>
              Propose Trade
            </Button>
          )}

          {isTrade && canAccess && !isOwner && primarySignedFile?.file_url && (
            <Button className="flex-1" asChild>
              <a href={primarySignedFile.file_url} target="_blank" rel="noopener noreferrer">
                {isImage ? <><Eye className="w-4 h-4 mr-1" /> View</> : <><Download className="w-4 h-4 mr-1" /> Download</>}
              </a>
            </Button>
          )}

          {isOwner && (
            <>
              <Button variant="outline" onClick={() => navigate(`/edit/${material.id}`)}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              {material.is_promoted && material.promotion_expires_at && new Date(material.promotion_expires_at) > new Date() ? (
                <Button variant="secondary" disabled>
                  <Megaphone className="w-4 h-4 mr-1" /> Promoted
                </Button>
              ) : (
                <PromoteTierMenu
                  materialId={material.id}
                  promoting={promoting}
                  onPromote={async (tier: string) => {
                    if (!user || !material) return;
                    const durations: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168 };
                    setPromoting(true);
                    try {
                      const { data, error } = await supabase.rpc("promote_material", {
                        p_material_id: material.id,
                        p_tier: tier,
                      } as any);
                      if (error) throw error;
                      const result = data as unknown as { success: boolean; error?: string };
                      if (!result.success) {
                        toast({ title: result.error || "Promotion failed", variant: "destructive" });
                      } else {
                        const hours = durations[tier] || 24;
                        toast({ title: `This item has been promoted for ${tier === "24h" ? "24 hours" : tier === "3d" ? "3 days" : "7 days"}.` });
                        setMaterial({ ...material, is_promoted: true, promotion_tier: tier, promotion_expires_at: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() });
                      }
                    } catch (e: any) {
                      toast({ title: "Promotion failed", description: sanitizeError(e), variant: "destructive" });
                    } finally {
                      setPromoting(false);
                    }
                  }}
                />
              )}
            </>
          )}

          <ReportModal materialId={material.id} />
        </div>

        {/* Teacher Approval Button */}
        {isTeacher && user && !isOwner && (
          <div className="mt-4">
            {material.teacher_approved ? (
              <Button
                variant="outline"
                className="w-full border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                disabled={approvingTeacher}
                onClick={async () => {
                  setApprovingTeacher(true);
                  try {
                    const { error } = await supabase
                      .from("materials")
                      .update({ teacher_approved: false, approved_by_teacher_id: null, approved_at: null } as any)
                      .eq("id", material.id);
                    if (error) throw error;
                    setMaterial({ ...material, teacher_approved: false, approved_by_teacher_id: null, approved_at: null });
                    toast({ title: "Teacher approval removed" });
                  } catch (e: any) {
                    toast({ title: "Failed", description: sanitizeError(e), variant: "destructive" });
                  } finally {
                    setApprovingTeacher(false);
                  }
                }}
              >
                <ShieldCheck className="w-4 h-4 mr-1" /> Remove Teacher Approval
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                disabled={approvingTeacher}
                onClick={async () => {
                  setApprovingTeacher(true);
                  try {
                    const { error } = await supabase
                      .from("materials")
                      .update({
                        teacher_approved: true,
                        approved_by_teacher_id: user.id,
                        approved_at: new Date().toISOString(),
                      } as any)
                      .eq("id", material.id);
                    if (error) throw error;
                    setMaterial({ ...material, teacher_approved: true, approved_by_teacher_id: user.id, approved_at: new Date().toISOString() });
                    toast({ title: "Material marked as Teacher Approved!" });
                  } catch (e: any) {
                    toast({ title: "Failed", description: sanitizeError(e), variant: "destructive" });
                  } finally {
                    setApprovingTeacher(false);
                  }
                }}
              >
                <ShieldCheck className="w-4 h-4 mr-1" /> Mark as Teacher Approved
              </Button>
            )}
          </div>
        )}

        {/* Review section */}
        {user && !isOwner && (
          <div className="mt-6 bg-secondary rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {existingReview ? "Edit Your Review" : "Leave a Review"}
            </h3>
            <StarRating rating={userRating} onRate={handleSubmitReview} interactive={!submittingReview} />
            {submittingReview && <p className="text-[10px] text-muted-foreground mt-1">Saving...</p>}
          </div>
        )}

        {/* Comments section */}
        <CommentsSection materialId={material.id} />

        <div className="mt-6 bg-secondary rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">📚 Study with integrity</span>
          <br />
          This platform is for sharing study aids only. Active tests, quizzes, or graded assignments are not permitted.
        </div>
      </div>
    </div>

    {/* AI Chat Bubble and Sidebar */}
    {material && (
      <div className="relative z-50">
        <PostAIChatBubble onClick={() => setAiChatOpen(true)} />
        <PostAIChatSidebar
          materialId={material.id}
          materialTitle={material.title}
          isOpen={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
        />
      </div>
    )}
    </>
  );
};

export default ListingDetail;
