import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, Pencil, Trash2, Upload, BookOpen, Award, X, Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import ListingCard from "@/components/ListingCard";
import ContributorBadge from "@/components/ContributorBadge";
import NotificationPreferences from "@/components/NotificationPreferences";
import { Badge } from "@/components/ui/badge";
import type { Material, Profile, MaterialRequest } from "@/lib/types";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [myRequests, setMyRequests] = useState<MaterialRequest[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [buyingBadge, setBuyingBadge] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: profileData }, { data: materialsData }, { data: reqData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("materials").select("*, profiles!materials_uploader_id_profiles_fkey(*)").eq("uploader_id", user.id).order("created_at", { ascending: false }),
      supabase.from("material_requests").select("*").eq("requester_user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const p = profileData as Profile | null;
    setProfile(p);
    setMaterials((materialsData as unknown as Material[]) || []);
    setMyRequests((reqData as unknown as MaterialRequest[]) || []);
    if (p) {
      setEditName(p.name);
      setEditSchool(p.school || "");
      setEditBio(p.bio || "");
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name: editName,
      school: editSchool,
      bio: editBio,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to update", description: sanitizeError(error), variant: "destructive" });
    } else {
      setEditing(false);
      fetchData();
      toast({ title: "Profile updated!" });
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    const { error } = await supabase.from("materials").delete().eq("id", materialId);
    if (error) {
      toast({ title: "Failed to delete", description: sanitizeError(error), variant: "destructive" });
    } else {
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
      toast({ title: "Material deleted" });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 text-center">
        <p className="text-muted-foreground mb-4">Sign in to view your profile</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="flex items-center justify-between pt-6 pb-4">
        <h1 className="text-2xl text-foreground">Profile</h1>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)} className="p-2 rounded-full hover:bg-muted transition-colors">
            <Pencil className="w-5 h-5 text-muted-foreground" />
          </button>
          <button onClick={handleLogout} className="p-2 rounded-full hover:bg-muted transition-colors">
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">School</label>
              <input
                value={editSchool}
                onChange={(e) => setEditSchool(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-sans font-semibold text-foreground">{profile?.name || "Set your name"}</h2>
                {profile?.school && <p className="text-xs text-muted-foreground">{profile.school}</p>}
                <ContributorBadge uploadCount={materials.length} />
                {profile?.has_featured_badge && (
                  <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30">
                    <Award className="w-3 h-3" /> Featured Contributor
                  </Badge>
                )}
              </div>
            </div>
            {profile?.bio && <p className="text-sm text-muted-foreground leading-relaxed mb-4">{profile.bio}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <span className="text-lg font-semibold text-foreground">{materials.length}</span>
                <p className="text-[10px] text-muted-foreground">Materials Posted</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <span className="text-lg font-semibold text-foreground">{profile?.credit_balance ?? 0}</span>
                <p className="text-[10px] text-muted-foreground">Credits</p>
              </div>
            </div>
            {!profile?.has_featured_badge && (
              <Button
                variant="outline"
                className="w-full mt-3"
                disabled={buyingBadge}
                onClick={async () => {
                  if (!user) return;
                  if (!confirm("Purchase Featured Contributor Badge for 50 credits?")) return;
                  setBuyingBadge(true);
                  try {
                    const { data, error } = await supabase.rpc("purchase_featured_badge" as any);
                    if (error) throw error;
                    const result = data as unknown as { success: boolean; error?: string };
                    if (!result.success) {
                      toast({ title: result.error || "Purchase failed", variant: "destructive" });
                    } else {
                      toast({ title: "Featured Contributor Badge purchased!" });
                      fetchData();
                    }
                  } catch (e: any) {
                    toast({ title: "Purchase failed", description: sanitizeError(e), variant: "destructive" });
                  } finally {
                    setBuyingBadge(false);
                  }
                }}
              >
                <Award className="w-4 h-4 mr-1" />
                {buyingBadge ? "Purchasing..." : "Purchase Featured Contributor Badge — 50 Credits"}
              </Button>
            )}
          </>
        )}
      </div>

      {/* My Requests */}
      {myRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-sans font-semibold text-foreground mb-3">My Requests</h2>
          <div className="space-y-2">
            {myRequests.map((req) => (
              <div key={req.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      req.status === 'open' ? 'bg-accent/20 text-accent-foreground' :
                      req.status === 'fulfilled' ? 'bg-primary/20 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {req.status}
                    </span>
                    <span className="text-xs font-semibold text-primary flex items-center gap-0.5">
                      <Coins className="w-3 h-3" /> {req.reward_credits}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{req.title}</h3>
                  {req.description && <p className="text-xs text-muted-foreground line-clamp-1">{req.description}</p>}
                </div>
                {req.status === 'open' && (
                  <button
                    onClick={async () => {
                      if (!confirm("Cancel this request? Your credits will be refunded.")) return;
                      try {
                        const { data, error } = await supabase.rpc("cancel_material_request" as any, { p_request_id: req.id });
                        if (error) throw error;
                        const result = data as unknown as { success: boolean; error?: string };
                        if (!result.success) {
                          toast({ title: result.error || "Failed to cancel", variant: "destructive" });
                        } else {
                          toast({ title: "Request cancelled. Credits refunded." });
                          fetchData();
                        }
                      } catch (e: any) {
                        toast({ title: "Failed to cancel", description: sanitizeError(e), variant: "destructive" });
                      }
                    }}
                    className="p-2 rounded-full hover:bg-destructive/10 transition-colors"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification preferences */}
      <div className="mb-6">
        <NotificationPreferences />
      </div>

      {/* My materials */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-sans font-semibold text-foreground">My Materials</h2>
      </div>

      {materials.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          No materials uploaded yet. Click "Post" to add your notes or study guides.
        </div>
      ) : (
        <div className="space-y-3 pb-6">
          {materials.map((material) => (
            <div key={material.id} className="flex gap-3 items-start">
              <div className="flex-1">
                <ListingCard material={material} />
              </div>
              <button
                onClick={() => handleDeleteMaterial(material.id)}
                className="p-2 rounded-full hover:bg-destructive/10 transition-colors mt-2"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
