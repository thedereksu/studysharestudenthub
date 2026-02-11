import { useNavigate } from "react-router-dom";
import { Star, BookOpen, ArrowRight, Settings } from "lucide-react";
import { mockProfile, mockListings } from "@/data/mockData";
import ListingCard from "@/components/ListingCard";

const ProfilePage = () => {
  const navigate = useNavigate();
  const myListings = mockListings.filter((l) => l.author.id === mockProfile.id);

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="flex items-center justify-between pt-6 pb-4">
        <h1 className="text-2xl text-foreground">Profile</h1>
        <button className="p-2 rounded-full hover:bg-muted transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-sans font-semibold text-foreground">{mockProfile.name}</h2>
            <p className="text-xs text-muted-foreground">{mockProfile.school}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3.5 h-3.5 fill-accent text-accent" />
              <span className="text-xs font-semibold text-foreground">{mockProfile.rating}</span>
              <span className="text-[10px] text-muted-foreground">({mockProfile.ratingCount} reviews)</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{mockProfile.bio}</p>

        {/* Subjects */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {mockProfile.subjects.map((s) => (
            <span key={s} className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full text-[10px] font-medium">
              {s}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-lg p-3 text-center">
            <span className="text-lg font-semibold text-foreground">{mockProfile.listingsCount}</span>
            <p className="text-[10px] text-muted-foreground">Materials Posted</p>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <span className="text-lg font-semibold text-foreground">{mockProfile.tradesCompleted}</span>
            <p className="text-[10px] text-muted-foreground">Trades Completed</p>
          </div>
        </div>
      </div>

      {/* My listings */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-sans font-semibold text-foreground">My Materials</h2>
        <button className="text-xs text-primary flex items-center gap-0.5 font-medium">
          See all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6">
        {myListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
        {myListings.length === 0 && (
          <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">No materials posted yet.</div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
