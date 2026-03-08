import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, Pencil, Trash2, Upload, BookOpen, Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import ListingCard from "@/components/ListingCard";
import ContributorBadge from "@/components/ContributorBadge";
import NotificationPreferences from "@/components/NotificationPreferences";
import { Badge } from "@/components/ui/badge";
import type { Material, Profile } from "@/lib/types";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [buyingBadge, setBuyingBadge] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: profileData }, { data: materialsData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("materials").select("*, profiles!materials_uploader_id_profiles_fkey(*)").eq("uploader_id", user.id).order("created_at", { ascending: false }),
    ]);
    const p = profileData as Profile | null;
    setProfile(p);
    setMaterials((materialsData as unknown as Material[]) || []);
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
          </>
        )}
      </div>

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
