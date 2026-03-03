import { useState, useEffect } from "react";
import { Trash2, Pencil, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CommentRow {
  id: string;
  material_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: { name: string } | null;
}

const CommentsSection = ({ materialId }: { materialId: string }) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles!comments_user_id_fkey(name)")
      .eq("material_id", materialId)
      .order("created_at", { ascending: false });
    setComments((data as unknown as CommentRow[]) || []);
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${materialId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `material_id=eq.${materialId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [materialId]);

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("comments")
        .insert({ material_id: materialId, user_id: user.id, content: newComment.trim() });
      if (error) throw error;
      setNewComment("");
    } catch (e: any) {
      toast({ title: "Comment failed", description: sanitizeError(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const { error } = await supabase
        .from("comments")
        .update({ content: editContent.trim() })
        .eq("id", id);
      if (error) throw error;
      setEditingId(null);
    } catch (e: any) {
      toast({ title: "Update failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "Delete failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  const handleAdminDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "delete_comment", targetId: id }),
        }
      );
      if (!res.ok) throw new Error("Admin delete failed");
      fetchComments();
    } catch (e: any) {
      toast({ title: "Delete failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-4 h-4" />
        Comments ({comments.length})
      </h3>

      {user && (
        <div className="flex gap-2 mb-4">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px] text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <Button size="icon" onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
      )}

      <div className="space-y-3">
        {comments.map((c) => {
          const isOwner = user?.id === c.user_id;
          const canDelete = isOwner || isAdmin;

          return (
            <div key={c.id} className="bg-secondary rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">{c.profiles?.name || "Anonymous"}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => { setEditingId(c.id); setEditContent(c.content); }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1 rounded hover:bg-muted transition-colors">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => isOwner ? handleDelete(c.id) : handleAdminDelete(c.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {editingId === c.id ? (
                <div className="flex gap-2 mt-1">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[40px] text-sm flex-1"
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="sm" onClick={() => handleUpdate(c.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.content}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommentsSection;
