import { useState } from "react";
import { CheckCircle, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

interface Report {
  id: string;
  material_id: string;
  reporter_user_id: string;
  reason: string;
  optional_description: string;
  status: string;
  created_at: string;
  material_title?: string;
  reporter_name?: string;
}

interface ReportsTabProps {
  reports: Report[];
  loading: boolean;
  onRefresh: () => void;
}

const statusBadge = (status: string) => {
  switch (status) {
    case "open": return <Badge variant="destructive">Open</Badge>;
    case "reviewed": return <Badge variant="secondary">Reviewed</Badge>;
    case "resolved": return <Badge variant="outline">Resolved</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const ReportsTab = ({ reports, loading, onRefresh }: ReportsTabProps) => {
  const { toast } = useToast();
  const [acting, setActing] = useState<string | null>(null);

  const updateStatus = async (reportId: string, status: string) => {
    setActing(reportId);
    try {
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "update_report_status", targetId: reportId, status },
      });
      if (error) throw error;
      toast({ title: `Report marked as ${status}` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Failed", description: sanitizeError(e), variant: "destructive" });
    }
    setActing(null);
  };

  const deleteMaterialFromReport = async (reportId: string, materialId: string) => {
    setActing(reportId);
    try {
      await supabase.functions.invoke("admin-actions", {
        body: { action: "delete_material", targetId: materialId },
      });
      // Resolve the report after deletion
      await supabase.functions.invoke("admin-actions", {
        body: { action: "update_report_status", targetId: reportId, status: "resolved" },
      });
      toast({ title: "Material deleted and report resolved" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Failed", description: sanitizeError(e), variant: "destructive" });
    }
    setActing(null);
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading...</p>;
  if (reports.length === 0) return <p className="text-muted-foreground text-sm py-8 text-center">No reports yet.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead>Reporter</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-32">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium text-foreground max-w-[120px] truncate">{r.material_title || r.material_id.slice(0, 8)}</TableCell>
            <TableCell className="text-muted-foreground">{r.reporter_name || r.reporter_user_id.slice(0, 8)}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{r.reason}</TableCell>
            <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{r.optional_description || "—"}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
            <TableCell>{statusBadge(r.status)}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                {r.status === "open" && (
                  <Button variant="ghost" size="icon" title="Mark reviewed" disabled={acting === r.id} onClick={() => updateStatus(r.id, "reviewed")}>
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </Button>
                )}
                {r.status !== "resolved" && (
                  <Button variant="ghost" size="icon" title="Dismiss" disabled={acting === r.id} onClick={() => updateStatus(r.id, "resolved")}>
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Delete material" disabled={acting === r.id}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete reported material?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete the material, its files, reviews, comments, and unlock records.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMaterialFromReport(r.id, r.material_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default ReportsTab;
