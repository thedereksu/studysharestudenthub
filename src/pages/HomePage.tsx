import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, Upload, HelpCircle, RefreshCcw, X, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import RequestCard from "@/components/RequestCard";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { subjects, materialTypes, exchangeTypes } from "@/lib/types";
import type { Material, MaterialRequest } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

const HomePage = () => {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [activeExchange, setActiveExchange] = useState("All");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [{ data: matData, error: matErr }, { data: reqData, error: reqErr }] = await Promise.all([
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
        if (aPromoted && bPromoted)
          return (
            new Date(b.promotion_expires_at).getTime() - new Date(a.promotion_expires_at).getTime()
          );
        // Teacher approved below promoted
        const aApproved = !!a.teacher_approved;
        const bApproved = !!b.teacher_approved;
        if (aApproved && !bApproved) return -1;
        if (!aApproved && bApproved) return 1;
        const aFeatured = a.profiles?.has_featured_badge;
        const bFeatured = b.profiles?.has_featured_badge;
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        return 0;
      });
    }

    if (matErr || reqErr) {
      console.error("Feed query error:", { matErr, reqErr });
      setLoadError("We couldn't sync data from the server. Please retry.");
    }

    setMaterials((matData as unknown as Material[]) || []);
    setRequests((reqData as unknown as MaterialRequest[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [fetchData, authLoading, user?.id]);

  const filtered = materials.filter((l) => {
    const matchesSearch = !search || 
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = activeSubject === "All" || l.subject === activeSubject;
    const matchesType = activeType === "All" || l.type === activeType;
    const matchesExchange = activeExchange === "All" || l.exchange_type === activeExchange;
    return matchesSearch && matchesSubject && matchesType && matchesExchange;
  });

  const filteredRequests = requests.filter((r) =>
    !search || r.title.toLowerCase().includes(search.toLowerCase())
  );

  const activeFilterCount = 
    (activeSubject !== "All" ? 1 : 0) + 
    (activeType !== "All" ? 1 : 0) + 
    (activeExchange !== "All" ? 1 : 0);

  const FilterSection = ({ 
    label, 
    options, 
    active, 
    onSelect 
  }: { 
    label: string; 
    options: string[]; 
    active: string; 
    onSelect: (v: string) => void 
  }) => (
    <div className="mb-6">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active === opt
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  const resetFilters = () => {
    setActiveSubject("All");
    setActiveType("All");
    setActiveExchange("All");
  };

  const renderFilterContent = () => (
    <>
      <FilterSection 
        label="Subject" 
        options={subjects} 
        active={activeSubject} 
        onSelect={setActiveSubject} 
      />
      <FilterSection 
        label="Material Type" 
        options={materialTypes} 
        active={activeType} 
        onSelect={setActiveType} 
      />
      <FilterSection 
        label="Exchange Type" 
        options={exchangeTypes} 
        active={activeExchange} 
        onSelect={setActiveExchange} 
      />
    </>
  );

  return (
    <div className="w-full">
      {/* Container with responsive max-width for desktop */}
      <div className="mx-auto px-4 lg:px-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 py-6">
          {/* Left Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                {activeFilterCount > 0 && (
                  <button 
                    onClick={resetFilters}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-4 text-sm">
                {renderFilterContent()}
              </div>
            </div>
          </div>

          {/* Main Content - Center */}
          <div className="lg:col-span-2">
            <div className="pt-2 pb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">StudySwap</h1>
                <p className="text-xs text-muted-foreground">Share knowledge, grow together</p>
              </div>
              {user && (
                <button
                  onClick={() => navigate("/request")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-primary-foreground/20 group relative"
                  title="Request study materials from the community"
                >
                  <img src="/sage-avatar.png" alt="Sage" className="w-5 h-5 object-contain" />
                  <span className="hidden sm:inline">Request Material</span>
                  <span className="sm:hidden">Request</span>
                  <Sparkles className="w-4 h-4 ml-1 group-hover:animate-spin" />
                </button>
              )}
            </div>

            <div className="relative mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search notes, guides, subjects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              
              {/* Filter Button - Mobile Only */}
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="relative px-3 lg:hidden">
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-6">
                  <SheetHeader className="text-left mb-6">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="text-xl">Filters</SheetTitle>
                      {activeFilterCount > 0 && (
                        <button 
                          onClick={resetFilters}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Reset all
                        </button>
                      )}
                    </div>
                  </SheetHeader>
                  
                  <div className="overflow-y-auto pb-20">
                    {renderFilterContent()}
                  </div>

                  <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
                    <SheetClose asChild>
                      <Button className="w-full py-6 text-base font-semibold">
                        Show {filtered.length + (activeSubject === "All" ? filteredRequests.length : 0)} results
                      </Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Active:</span>
                {activeSubject !== "All" && (
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    {activeSubject}
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setActiveSubject("All")} />
                  </span>
                )}
                {activeType !== "All" && (
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    {activeType}
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setActiveType("All")} />
                  </span>
                )}
                {activeExchange !== "All" && (
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    {activeExchange}
                    <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setActiveExchange("All")} />
                  </span>
                )}
              </div>
            )}

            {loadError && (
              <div className="mb-4 rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{loadError}</p>
                <Button size="sm" variant="outline" onClick={fetchData}>
                  <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Retry
                </Button>
              </div>
            )}

            {/* Active requests - highest priority, only show if no subject filter or matching subject */}
            {(activeSubject === "All") && filteredRequests.length > 0 && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Requests</h2>
                  <span className="text-[10px] text-muted-foreground">{filteredRequests.length} open</span>
                </div>
                {filteredRequests.map((req) => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pb-6">
              <div className="col-span-2 flex items-center justify-between px-1 mb-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Materials</h2>
                <span className="text-[10px] text-muted-foreground">{filtered.length} items</span>
              </div>
              {loading ? (
                <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">Loading...</div>
              ) : filtered.length === 0 && (activeSubject !== "All" || filteredRequests.length === 0) ? (
                <div className="col-span-2">
                  <EmptyState
                    icon={Upload}
                    title="No matching materials found"
                    description="Try adjusting your filters or search terms to find study materials."
                    iconColor="text-primary/30"
                  />
                </div>
              ) : (
                filtered.map((material) => (
                  <ListingCard key={material.id} material={material} />
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 bg-card rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Quick Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Materials</span>
                  <span className="font-semibold text-foreground">{materials.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Requests</span>
                  <span className="font-semibold text-foreground">{requests.length}</span>
                </div>
                <hr className="my-2 border-border" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-2">Popular Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {subjects.slice(0, 5).map((subject) => (
                      <button
                        key={subject}
                        onClick={() => setActiveSubject(subject)}
                        className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded hover:bg-muted transition-colors"
                      >
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
