import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { mockMessages } from "@/data/mockData";
import type { ChatMessage } from "@/data/mockData";

const initialMessages: ChatMessage[] = [
  { id: "c1", senderId: "other", text: "Hey! I saw your AP Bio notes. They look great!", timestamp: "10:30 AM" },
  { id: "c2", senderId: "me", text: "Thanks! Are you interested in trading?", timestamp: "10:32 AM" },
  { id: "c3", senderId: "other", text: "Sure, I can trade my calc notes for your bio guide!", timestamp: "10:33 AM" },
];

const ChatPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");

  const contact = mockMessages.find((m) => m.userId === userId);
  const contactName = contact?.userName || "Student";

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: `c${Date.now()}`, senderId: "me", text: input.trim(), timestamp: "Now" },
    ]);
    setInput("");
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate("/messages")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">{contactName[0]}</span>
        </div>
        <span className="text-sm font-semibold text-foreground">{contactName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] ${msg.senderId === "me" ? "self-end" : "self-start"}`}
          >
            <div
              className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.senderId === "me"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border text-foreground rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>
            <span className={`text-[10px] text-muted-foreground mt-0.5 block ${msg.senderId === "me" ? "text-right" : ""}`}>
              {msg.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
