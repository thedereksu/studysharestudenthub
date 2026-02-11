import { MessageCircle } from "lucide-react";

const MessagesPage = () => {
  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl text-foreground">Messages</h1>
      </div>

      <div className="text-center py-12 text-muted-foreground text-sm">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        No messages yet. Start a conversation by requesting materials from other students.
      </div>
    </div>
  );
};

export default MessagesPage;
