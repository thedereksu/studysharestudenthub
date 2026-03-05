import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

const REPORT_REASONS = [
  "Incorrect / misleading material",
  "Spam",
  "Active test / academic integrity violation",
  "Copyright violation",
  "Offensive content",
  "Other",
];

interface ReportModalProps {
  materialId: string;
}

const ReportModal = ({ materialId }: ReportModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        material_id: materialId,
        reporter_user_id: user.id,
        reason,
        optional_description: description || "",
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already reported", description: "You have already reported this material." });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Report submitted", description: "The admin will review it." });
      }
      setOpen(false);
      setReason("");
      setDescription("");
    } catch (e: any) {
      toast({ title: "Report failed", description: sanitizeError(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" disabled={!user}>
          <Flag className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Material</DialogTitle>
          <DialogDescription>Select a reason for reporting this material.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <div key={r} className="flex items-center space-x-2">
              <RadioGroupItem value={r} id={`reason-${r}`} />
              <Label htmlFor={`reason-${r}`} className="text-sm cursor-pointer">{r}</Label>
            </div>
          ))}
        </RadioGroup>
        {reason === "Other" && (
          <Textarea
            placeholder="Please describe the issue..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-2"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
