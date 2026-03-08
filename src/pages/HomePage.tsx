import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Upload, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import RequestCard from "@/components/RequestCard";
import { supabase } from "@/integrations/supabase/client";
import { subjects } from "@/lib/types";
import type { Material, MaterialRequest } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const HomePage = () => {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: matData, error: matErr }, { data: reqData }] = await Promise.all([
        supabase
          .from("materials")
          .select("*, profiles!materials_uploader_id_profiles_fkey(*)")
          .order("created_at", { ascending: false }),
        supabase
          .from("material_requests")
          .select("*, profiles!material_requests_requester_user_id_fkey(*)")
          .eq("status", "open")
          .order("created_at", { ascending: false }),
      ]);

      if (matData) {
        const now = new Date().toISOString();
        matData.sort((a: any, b: any) => {
          const aPromoted = a.is_promoted && a.promotion_expires_at && a.promotion_expires_at > now;
          const bPromoted = b.is_promoted && b.promotion_expires_at && b.promotion_expires_at > now;
          if (aPromoted && !bPromoted) return -1;
          if (!aPromoted && bPromoted) return 1;
          if (aPromoted && bPromoted) return new Date(b.promotion_expires_at).getTime() - new Date(a.promotion_expires_at).getTime();
          const aFeatured = a.profiles?.has_featured_badge;
          const bFeatured = b.profiles?.has_featured_badge;
          if (aFeatured && !bFeatured) return -1;
          if (!aFeatured && bFeatured) return 1;
          return 0;
        });
      }
      if (matErr) console.error("Feed query error:", matErr);
      setMaterials((matData as unknown as Material[]) || []);
      setRequests((reqData as unknown as MaterialRequest[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = materials.filter((l) => {
    const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = activeSubject === "All" || l.subject === activeSubject;
    return matchesSearch && matchesSubject;
  });

  const filteredRequests = requests.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="pt-6 pb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground mt-0.5">Share knowledge, grow together</p>
        {user && (
          <Button variant="outline" size="sm" onClick={() => navigate("/request")}>
            <HelpCircle className="w-4 h-4 mr-1" /> Request
          </Button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search notes, guides, subjects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-lg pl-9 pr-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted transition-colors">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
        {subjects.map((subject) => (
          <button
            key={subject}
            onClick={() => setActiveSubject(subject)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeSubject === subject
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            {subject}
          </button>
        ))}
      </div>

      {/* Active requests */}
      {filteredRequests.length > 0 && (
        <div className="space-y-3 mb-4">
          {filteredRequests.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pb-6">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 && filteredRequests.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            No materials uploaded yet. Click "Post" to add your notes or study guides.
          </div>
        ) : (
          filtered.map((material) => (
            <ListingCard key={material.id} material={material} />
          ))
        )}
      </div>
    </div>
  );
};

export default HomePage;
