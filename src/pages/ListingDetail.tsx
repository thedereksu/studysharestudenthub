import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Flag, Lock, BookOpen, FileText, Download, Eye, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import type { Material } from "@/lib/types";

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("materials")
        .select("*, profiles!materials_uploader_id_profiles_fkey(*)")
        .eq("id", id)
        .single();
      setMaterial(data as unknown as Material | null);

      // Check if user has unlocked this material
      if (user && data) {
        const { data: unlockData } = await supabase
          .from("unlocks")
          .select("id")
          .eq("user_id", user.id)
          .eq("material_id", data.id)
          .maybeSingle();
        setUnlocked(!!unlockData);
      }
      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  const isOwner = user && material && user.id === material.uploader_id;
  const isFree = material?.exchange_type === "Free";
  const isPaid = material?.exchange_type === "Paid";
  const isTrade = material?.exchange_type === "Trade";
  const canAccess = isFree || isOwner || unlocked;

  const handleUnlock = async () => {
    if (!user || !material) return;
    setUnlocking(true);
    try {
      const { data, error } = await supabase.rpc("unlock_material", {
        p_material_id: material.id,
        p_buyer_id: user.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: "Cannot unlock", description: result.error, variant: "destructive" });
      } else {
        setUnlocked(true);
        toast({ title: "Material unlocked!", description: "You now have full access." });
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

  if (loading) return <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">Loading...</div>;
  if (!material) return <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">Material not found.</div>;

  const isImage = material.file_type.startsWith("image/");
  const uploaderName = material.profiles?.name || "Anonymous";

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">Details</span>
      </div>

      <div className="aspect-[4/3] bg-muted mx-4 rounded-lg flex items-center justify-center relative overflow-hidden">
        {isImage ? (
          <img
            src={material.file_url}
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
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">{material.subject}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] font-medium text-muted-foreground">{material.type}</span>
        </div>

        <h1 className="text-xl text-foreground leading-tight mb-2">{material.title}</h1>

        <span className="text-xs text-muted-foreground">
          {new Date(material.created_at).toLocaleDateString()}
        </span>

        {material.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-4 mb-6">{material.description}</p>
        )}

        <button
          onClick={handleOpenDM}
          disabled={!user || isOwner}
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

        <div className="flex gap-3">
          {isFree && (
            <Button className="flex-1" asChild>
              <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                {isImage ? (
                  <><Eye className="w-4 h-4 mr-1" /> View</>
                ) : (
                  <><Download className="w-4 h-4 mr-1" /> Download</>
                )}
              </a>
            </Button>
          )}

          {isPaid && !canAccess && (
            <Button className="flex-1" onClick={handleUnlock} disabled={unlocking || !user}>
              <Coins className="w-4 h-4 mr-1" />
              {unlocking ? "Unlocking..." : `Unlock for ${material.credit_price} Credits`}
            </Button>
          )}

          {isPaid && canAccess && (
            <Button className="flex-1" asChild>
              <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                {isImage ? (
                  <><Eye className="w-4 h-4 mr-1" /> View</>
                ) : (
                  <><Download className="w-4 h-4 mr-1" /> Download</>
                )}
              </a>
            </Button>
          )}

          {isTrade && !canAccess && (
            <Button className="flex-1" onClick={handleOpenDM} disabled={!user}>
              Propose Trade
            </Button>
          )}

          {isTrade && canAccess && !isOwner && (
            <Button className="flex-1" asChild>
              <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                {isImage ? <><Eye className="w-4 h-4 mr-1" /> View</> : <><Download className="w-4 h-4 mr-1" /> Download</>}
              </a>
            </Button>
          )}

          <Button variant="outline" size="icon">
            <Flag className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-6 bg-secondary rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">📚 Study with integrity</span>
          <br />
          This platform is for sharing study aids only. Active tests, quizzes, or graded assignments are not permitted.
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
