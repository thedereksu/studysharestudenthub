import { useState } from "react";
import { Search } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { mockListings, subjects, materialTypes, exchangeTypes } from "@/data/mockData";

const SearchPage = () => {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [activeExchange, setActiveExchange] = useState("All");

  const filtered = mockListings.filter((l) => {
    const matchesSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = activeSubject === "All" || l.subject === activeSubject;
    const matchesType = activeType === "All" || l.type === activeType;
    const matchesExchange = activeExchange === "All" || l.exchangeType === activeExchange;
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
        {filtered.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">No results found.</div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
