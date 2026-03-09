import { useState, useEffect } from "react";
import { Search, Upload } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { subjects, materialTypes, exchangeTypes } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import type { Material } from "@/lib/types";

const SearchPage = () => {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [activeExchange, setActiveExchange] = useState("All");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaterials = async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*, profiles!materials_uploader_id_profiles_fkey(id, name, school, bio, has_featured_badge, created_at, updated_at)")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Search query error:", error);
      }
      if (data) {
        const now = new Date().toISOString();
        data.sort((a: any, b: any) => {
          const aPromoted = a.is_promoted && a.promotion_expires_at && a.promotion_expires_at > now;
          const bPromoted = b.is_promoted && b.promotion_expires_at && b.promotion_expires_at > now;
          if (aPromoted && !bPromoted) return -1;
          if (!aPromoted && bPromoted) return 1;
          return 0;
        });
      }
      setMaterials((data as unknown as Material[]) || []);
      setLoading(false);
    };
    fetchMaterials();
  }, []);

  const filtered = materials.filter((l) => {
    const matchesSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = activeSubject === "All" || l.subject === activeSubject;
    const matchesType = activeType === "All" || l.type === activeType;
    const matchesExchange = activeExchange === "All" || l.exchange_type === activeExchange;
    return matchesSearch && matchesSubject && matchesType && matchesExchange;
  });

  const FilterRow = ({ label, options, active, onSelect }: { label: string; options: string[]; active: string; onSelect: (v: string) => void }) => (
    <div className="mb-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</span>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active === opt ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl text-foreground">Search</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search materials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <FilterRow label="Subject" options={subjects} active={activeSubject} onSelect={setActiveSubject} />
      <FilterRow label="Type" options={materialTypes} active={activeType} onSelect={setActiveType} />
      <FilterRow label="Exchange" options={exchangeTypes} active={activeExchange} onSelect={setActiveExchange} />

      <div className="grid grid-cols-2 gap-3 pb-6 mt-2">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            No materials found.
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

export default SearchPage;
