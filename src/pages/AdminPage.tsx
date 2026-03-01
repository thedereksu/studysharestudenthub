import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Trash2, Users, BookOpen, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminUser {
  id: string;
  name: string;
  school: string | null;
  created_at: string;
}

interface AdminMaterial {
  id: string;
  title: string;
  subject: string;
  uploader_id: string;
  created_at: string;
  profiles?: { name: string } | null;
}

interface AuditEntry {
  id: string;
  admin_id: string;
  action_type: string;
  target_id: string;
  created_at: string;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdmin();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const callAdmin = async (body: Record<string, string>) => {
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
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Admin action failed");
    }
    return res.json();
  };

  const fetchAll = async () => {
    setLoadingData(true);
    try {
      const [usersRes, matsRes, logsRes] = await Promise.all([
        callAdmin({ action: "list_users" }),
        callAdmin({ action: "list_materials" }),
        callAdmin({ action: "list_audit_log" }),
      ]);
      setUsers(usersRes.users || []);
      setMaterials(matsRes.materials || []);
      setAuditLog(logsRes.logs || []);
    } catch (e: any) {
      toast({ title: "Failed to load admin data", description: sanitizeError(e), variant: "destructive" });
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user || !isAdmin) {
        navigate("/", { replace: true });
      } else {
        fetchAll();
      }
    }
  }, [user, isAdmin, authLoading, roleLoading]);

  const handleDeleteMaterial = async (id: string) => {
    try {
      await callAdmin({ action: "delete_material", targetId: id });
      toast({ title: "Material deleted" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Delete failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await callAdmin({ action: "delete_user", targetId: id });
      toast({ title: "User deleted" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Delete failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  if (authLoading || roleLoading) return <div className="max-w-4xl mx-auto px-4 pt-12 text-center text-muted-foreground">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 animate-fade-in pb-8">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl text-foreground">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" /> Users</TabsTrigger>
          <TabsTrigger value="materials"><BookOpen className="w-4 h-4 mr-1" /> Materials</TabsTrigger>
          <TabsTrigger value="audit"><ClipboardList className="w-4 h-4 mr-1" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {loadingData ? <p className="text-muted-foreground text-sm">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">{u.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.school || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {u.id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete user "{u.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>This action is irreversible. All materials, messages, reviews, and data for this user will be permanently deleted.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="materials">
          {loadingData ? <p className="text-muted-foreground text-sm">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Uploader</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground">{m.title}</TableCell>
                    <TableCell className="text-muted-foreground">{m.subject}</TableCell>
                    <TableCell className="text-muted-foreground">{(m.profiles as any)?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete material "{m.title}"?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this material, its files, reviews, and unlock records.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMaterial(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="audit">
          {loadingData ? <p className="text-muted-foreground text-sm">Loading...</p> : auditLog.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No admin actions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-foreground">{l.action_type}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{l.target_id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
