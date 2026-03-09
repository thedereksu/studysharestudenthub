import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Trash2, Users, BookOpen, ClipboardList, Flag, Ban, CheckCircle, Coins, HelpCircle, Award, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReportsTab from "@/components/admin/ReportsTab";

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  created_at: string;
  credit_balance: number;
  is_blocked: boolean;
}

interface AdminMaterial {
  id: string;
  title: string;
  subject: string;
  exchange_type: string;
  uploader_id: string;
  created_at: string;
  ownership_confirmed?: boolean;
  is_promoted?: boolean;
  promotion_expires_at?: string | null;
  profiles?: { name: string } | null;
}

interface AdminRequest {
  id: string;
  title: string;
  description: string;
  reward_credits: number;
  status: string;
  requester_user_id: string;
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

interface BadgeApplication {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  created_at: string;
  applicant_name: string | null;
  applicant_email: string | null;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdmin();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [badgeApplications, setBadgeApplications] = useState<BadgeApplication[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Credit adjustment state
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditUser, setCreditUser] = useState<AdminUser | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const callAdmin = async (body: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body,
    });
    if (error) {
      console.error("Admin call error:", error);
      throw new Error(error.message || "Admin action failed");
    }
    return data;
  };

  const fetchAll = useCallback(async () => {
    setLoadingData(true);

    const [usersRes, matsRes, reqsRes, logsRes, reportsRes, badgeRes] = await Promise.allSettled([
      callAdmin({ action: "list_users" }),
      callAdmin({ action: "list_materials" }),
      callAdmin({ action: "list_requests" }),
      callAdmin({ action: "list_audit_log" }),
      callAdmin({ action: "list_reports" }),
      callAdmin({ action: "list_badge_applications" }),
    ]);

    setUsers(usersRes.status === "fulfilled" ? usersRes.value.users || [] : []);
    setMaterials(matsRes.status === "fulfilled" ? matsRes.value.materials || [] : []);
    setRequests(reqsRes.status === "fulfilled" ? reqsRes.value.requests || [] : []);
    setAuditLog(logsRes.status === "fulfilled" ? logsRes.value.logs || [] : []);
    setReports(reportsRes.status === "fulfilled" ? reportsRes.value.reports || [] : []);
    setBadgeApplications(badgeRes.status === "fulfilled" ? badgeRes.value.applications || [] : []);

    const failedSections = [
      usersRes.status === "rejected" ? "users" : null,
      matsRes.status === "rejected" ? "materials" : null,
      reqsRes.status === "rejected" ? "requests" : null,
      logsRes.status === "rejected" ? "audit log" : null,
      reportsRes.status === "rejected" ? "reports" : null,
      badgeRes.status === "rejected" ? "badges" : null,
    ].filter(Boolean);

    if (failedSections.length) {
      toast({
        title: "Some admin data failed to load",
        description: `Couldn't load: ${failedSections.join(", ")}`,
        variant: "destructive",
      });
    }

    setLoadingData(false);
  }, [toast]);

  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (!user || !isAdmin) {
      navigate("/", { replace: true });
      return;
    }

    void fetchAll();
  }, [user, isAdmin, authLoading, roleLoading, navigate, fetchAll]);

  const handleDeleteMaterial = async (id: string) => {
    try {
      await callAdmin({ action: "delete_material", targetId: id });
      toast({ title: "Material deleted" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Delete failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      await callAdmin({ action: "delete_request", targetId: id });
      toast({ title: "Request deleted and credits refunded" });
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

  const handleBlockEmail = async (userId: string, email: string) => {
    try {
      await callAdmin({ action: "block_email", targetId: userId, email });
      toast({ title: "Email blocked" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Block failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  const handleUnblockEmail = async (userId: string, email: string) => {
    try {
      await callAdmin({ action: "unblock_email", targetId: userId, email });
      toast({ title: "Email unblocked" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Unblock failed", description: sanitizeError(e), variant: "destructive" });
    }
  };

  const openCreditDialog = (u: AdminUser) => {
    setCreditUser(u);
    setAdjustType("add");
    setAdjustAmount("");
    setAdjustReason("");
    setCreditDialogOpen(true);
  };

  const handleAdjustCredits = async () => {
    if (!creditUser || !adjustAmount) return;
    setAdjusting(true);
    try {
      const res = await callAdmin({
        action: "adjust_credits",
        targetUserId: creditUser.id,
        amount: adjustAmount,
        adjustmentType: adjustType,
        reason: adjustReason,
      });
      toast({ title: `Credits ${adjustType === "add" ? "added" : "subtracted"} successfully`, description: `New balance: ${res.new_balance}` });
      setCreditDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Adjustment failed", description: sanitizeError(e), variant: "destructive" });
    }
    setAdjusting(false);
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
          <TabsTrigger value="badges"><Award className="w-4 h-4 mr-1" /> Badges</TabsTrigger>
          <TabsTrigger value="reports"><Flag className="w-4 h-4 mr-1" /> Reports</TabsTrigger>
          <TabsTrigger value="audit"><ClipboardList className="w-4 h-4 mr-1" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {loadingData ? <p className="text-muted-foreground text-sm">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">{u.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{u.email || "—"}</TableCell>
                    <TableCell className="text-foreground font-medium">{u.credit_balance}</TableCell>
                    <TableCell>
                      {u.is_blocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><Ban className="w-3 h-3" /> Blocked</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle className="w-3 h-3" /> Active</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {u.id !== user?.id && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title="Adjust Credits" onClick={() => openCreditDialog(u)}>
                            <Coins className="w-4 h-4 text-primary" />
                          </Button>
                          {u.email && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title={u.is_blocked ? "Unblock Email" : "Block Email"}>
                                  {u.is_blocked ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Ban className="w-4 h-4 text-amber-500" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{u.is_blocked ? "Unblock" : "Block"} email "{u.email}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {u.is_blocked
                                      ? "This will allow the user to log in again."
                                      : "This will prevent the user from logging in or creating a new account with this email."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => u.is_blocked ? handleUnblockEmail(u.id, u.email!) : handleBlockEmail(u.id, u.email!)}
                                    className={u.is_blocked ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                                  >
                                    {u.is_blocked ? "Unblock" : "Block"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Delete User"><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
                        </div>
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
                   <TableHead>Exchange</TableHead>
                   <TableHead>Ownership</TableHead>
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
                    <TableCell className="text-muted-foreground">{m.exchange_type}</TableCell>
                    <TableCell>
                      {m.ownership_confirmed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle className="w-3 h-3" /> Confirmed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
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

          {/* Requests Section */}
          <h3 className="text-lg font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" /> Material Requests
          </h3>
          {loadingData ? <p className="text-muted-foreground text-sm">Loading...</p> : requests.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.title}</TableCell>
                    <TableCell className="text-foreground">{r.reward_credits} credits</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${r.status === 'open' ? 'text-primary' : r.status === 'fulfilled' ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{(r.profiles as any)?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete request "{r.title}"?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete the request{r.status === 'open' ? ' and refund the reserved credits to the requester' : ''}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteRequest(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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

        <TabsContent value="badges">
          {loadingData ? <p className="text-muted-foreground text-sm">Loading...</p> : badgeApplications.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No badge applications.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badgeApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-foreground">{app.applicant_name || "—"}</span>
                        {app.applicant_email && <p className="text-xs text-muted-foreground">{app.applicant_email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{app.reason}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${
                        app.status === 'pending' ? 'text-amber-500' :
                        app.status === 'approved' ? 'text-green-600' :
                        'text-destructive'
                      }`}>
                        {app.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {app.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Approve">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Approve badge application?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will grant {app.applicant_name || "this user"} the Featured Contributor badge.
                                  <br /><br />
                                  <strong>Reason:</strong> {app.reason}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  try {
                                    await callAdmin({ action: "review_badge_application", targetId: app.id, decision: "approved" });
                                    toast({ title: "Application approved — badge granted" });
                                    fetchAll();
                                  } catch (e: any) {
                                    toast({ title: "Failed", description: sanitizeError(e), variant: "destructive" });
                                  }
                                }}>Approve</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Deny">
                                <XCircle className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deny badge application?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will deny the application and refund 15 credits to {app.applicant_name || "the user"}.
                                  <br /><br />
                                  <strong>Reason:</strong> {app.reason}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  try {
                                    await callAdmin({ action: "review_badge_application", targetId: app.id, decision: "denied" });
                                    toast({ title: "Application denied — credits refunded" });
                                    fetchAll();
                                  } catch (e: any) {
                                    toast({ title: "Failed", description: sanitizeError(e), variant: "destructive" });
                                  }
                                }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deny</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab reports={reports} loading={loadingData} onRefresh={fetchAll} />
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

      {/* Credit Adjustment Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits — {creditUser?.name || "User"}</DialogTitle>
            <DialogDescription>Add or subtract credits from this user's balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-semibold text-foreground">{creditUser?.credit_balance ?? 0} credits</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Adjustment Type</label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "add" | "subtract")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Credits</SelectItem>
                  <SelectItem value="subtract">Subtract Credits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Amount</label>
              <Input type="number" min="1" placeholder="Enter amount" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Reason (optional)</label>
              <Textarea placeholder="e.g. Promotional bonus, error correction..." value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjustCredits} disabled={adjusting || !adjustAmount || parseInt(adjustAmount) <= 0}>
              {adjusting ? "Adjusting..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
