import { useNavigate } from "react-router-dom";
import { mockMessages } from "@/data/mockData";

const MessagesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl text-foreground">Messages</h1>
      </div>

      <div className="flex flex-col gap-1">
        {mockMessages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => navigate(`/chat/${msg.userId}`)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-card transition-colors text-left w-full"
          >
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">{msg.userName[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{msg.userName}</span>
                <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{msg.lastMessage}</p>
            </div>
            {msg.unread > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                {msg.unread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MessagesPage;
