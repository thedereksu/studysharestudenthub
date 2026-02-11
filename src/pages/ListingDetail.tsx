import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MessageCircle, Flag, Lock, BookOpen } from "lucide-react";
import { mockListings } from "@/data/mockData";
import { Button } from "@/components/ui/button";

const exchangeBadgeClass: Record<string, string> = {
  Free: "bg-[hsl(var(--badge-free))] text-[hsl(var(--badge-free-text))]",
  Trade: "bg-[hsl(var(--badge-trade))] text-[hsl(var(--badge-trade-text))]",
  Paid: "bg-[hsl(var(--badge-paid))] text-[hsl(var(--badge-paid-text))]",
};

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const listing = mockListings.find((l) => l.id === id);

  if (!listing) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">
        Listing not found.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">Details</span>
      </div>

      {/* Preview image */}
      <div className="aspect-[4/3] bg-muted mx-4 rounded-lg flex items-center justify-center relative">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Lock className="w-8 h-8" />
          <span className="text-xs font-medium">Preview locked</span>
          <span className="text-[10px]">Complete exchange to view full material</span>
        </div>
        <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${exchangeBadgeClass[listing.exchangeType]}`}>
          {listing.exchangeType === "Paid" ? `${listing.credits} credits` : listing.exchangeType}
        </span>
      </div>

      <div className="px-4 pt-4 pb-6">
        {/* Subject & type */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">{listing.subject}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] font-medium text-muted-foreground">{listing.type}</span>
        </div>

        <h1 className="text-xl text-foreground leading-tight mb-2">{listing.title}</h1>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-4">
          <Star className="w-4 h-4 fill-accent text-accent" />
          <span className="text-sm font-semibold text-foreground">{listing.rating}</span>
          <span className="text-xs text-muted-foreground">({listing.ratingCount} reviews)</span>
          <span className="text-xs text-muted-foreground ml-2">{listing.createdAt}</span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{listing.description}</p>

        {/* Author */}
        <div className="flex items-center gap-3 bg-secondary rounded-lg p-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-foreground">{listing.author.name}</span>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-accent text-accent" />
              <span className="text-xs text-muted-foreground">{listing.author.rating} rating</span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate(`/chat/${listing.author.id}`)}>
            <MessageCircle className="w-3.5 h-3.5 mr-1" />
            Chat
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => navigate(`/chat/${listing.author.id}`)}>
            {listing.exchangeType === "Free" ? "Request Material" : listing.exchangeType === "Trade" ? "Propose Trade" : "Purchase"}
          </Button>
          <Button variant="outline" size="icon">
            <Flag className="w-4 h-4" />
          </Button>
        </div>

        {/* Integrity notice */}
        <div className="mt-6 bg-secondary rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">📚 Study with integrity</span>
          <br />
          This platform is for sharing study aids only. Active tests, quizzes, or graded assignments are not permitted.
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
