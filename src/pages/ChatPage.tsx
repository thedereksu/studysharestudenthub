import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";

const ChatPage = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate("/messages")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">Chat</span>
      </div>

      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <div className="text-center">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          Messaging coming soon.
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
