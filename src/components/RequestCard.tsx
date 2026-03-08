import { Coins, User, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MaterialRequest } from "@/lib/types";

const RequestCard = ({ request }: { request: MaterialRequest }) => {
  const navigate = useNavigate();
  const timeAgo = getTimeAgo(request.created_at);

  return (
    <div className="bg-card border-2 border-dashed border-accent/40 rounded-lg p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
          📢 Request
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> {timeAgo}
        </span>
      </div>
      <h3 className="font-sans text-sm font-semibold text-foreground leading-snug mb-1">
        {request.title}
      </h3>
      {request.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{request.description}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <User className="w-3 h-3" />
          {request.profiles?.name || "Anonymous"}
        </span>
        <span className="text-xs font-semibold text-primary flex items-center gap-1">
          <Coins className="w-3.5 h-3.5" /> {request.reward_credits} credits
        </span>
      </div>
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default RequestCard;
