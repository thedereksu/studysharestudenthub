import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { mockListings, subjects } from "@/data/mockData";

const HomePage = () => {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");

  const filtered = mockListings.filter((l) => {
    const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = activeSubject === "All" || l.subject === activeSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="max-w-lg mx-auto px-4">
      {/* Header */}
      <div className="pt-6 pb-4">
        <h1 className="text-2xl text-foreground">StudySwap</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Share knowledge, grow together</p>
      </div>

      {/* Search */}
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

      {/* Subject pills */}
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

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 pb-6">
        {filtered.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            No materials found. Try a different search or subject.
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
