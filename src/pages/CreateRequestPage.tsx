import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

const CreateRequestPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardCredits, setRewardCredits] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (rewardCredits < 1) {
      toast({ title: "Reward must be at least 1 credit", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_material_request" as any, {
        p_title: title.trim(),
        p_description: description.trim(),
        p_reward_credits: rewardCredits,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: result.error || "Failed to create request", variant: "destructive" });
      } else {
        toast({ title: "Request posted! Credits have been reserved." });
        navigate("/");
      }
    } catch (e: any) {
      toast({ title: "Failed to create request", description: sanitizeError(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 text-center">
        <p className="text-muted-foreground mb-4">Sign in to request materials</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="flex items-center gap-3 pt-4 pb-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">Request Material</span>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 mt-2 space-y-4">
        <div className="flex items-start gap-3 p-3 bg-accent/10 rounded-lg">
          <HelpCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Post a request for study materials you need. Your credits will be reserved and transferred to whoever fulfills your request.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Request Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 150))}
            placeholder="e.g. BIO101 Midterm Study Guide"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Describe what you need..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Credit Reward *
          </label>
          <input
            type="number"
            min={1}
            max={1000}
            value={rewardCredits}
            onChange={(e) => setRewardCredits(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            This amount will be reserved from your balance and paid to the user who fulfills your request.
          </p>
        </div>

        <Button onClick={handleSubmit} disabled={submitting || !title.trim()} className="w-full">
          {submitting ? "Posting..." : `Post Request (${rewardCredits} credits)`}
        </Button>
      </div>
    </div>
  );
};

export default CreateRequestPage;
