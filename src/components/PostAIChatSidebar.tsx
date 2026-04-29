import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PostAIChatSidebarProps {
  materialId: string;
  materialTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const PostAIChatSidebar = ({
  materialId,
  materialTitle,
  isOpen,
  onClose,
}: PostAIChatSidebarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [extractedContext, setExtractedContext] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history and extract context on first open
  useEffect(() => {
    if (isOpen && !initialized && user) {
      console.log("[AI Chat] Initializing for material:", materialId);
      loadConversation();
      extractFileContext();
      setInitialized(true);
    }
  }, [isOpen, initialized, user]);

  const loadConversation = async () => {
    try {
      const { data } = await supabase
        .from("post_ai_conversations")
        .select("messages")
        .eq("material_id", materialId)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (data?.messages) {
        setMessages(data.messages as unknown as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const extractFileContext = async () => {
    try {
      console.log("[AI Chat] Fetching material context...");
      
      // First check cache
      const { data: cache } = await supabase
        .from("post_ai_file_cache")
        .select("extracted_text")
        .eq("material_id", materialId)
        .maybeSingle();

      if (cache?.extracted_text) {
        console.log("[AI Chat] Using cached text context");
        setExtractedContext(cache.extracted_text);
        return;
      }

      const { data: material } = await supabase
        .from("materials")
        .select("files, file_url, file_type, title, description")
        .eq("id", materialId)
        .single();

      if (!material) return;

      let context = `Title: ${material.title}\nDescription: ${material.description || "No description provided."}\n`;

      const files = Array.isArray(material.files) 
        ? material.files 
        : material.file_url 
          ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }] 
          : [];

      console.log("[AI Chat] Files found:", files.length);

      for (const f of files.slice(0, 3)) {
        const file: any = f;
        if (!file.file_url) continue;
        
        // We only attempt frontend extraction for small text-based files
        if (file.file_type?.includes("text") || file.file_type?.includes("plain") || file.file_name?.endsWith(".txt")) {
          try {
            const response = await fetch(file.file_url);
            if (response.ok) {
              const text = await response.text();
              context += `\n--- Content from ${file.file_name} ---\n${text.slice(0, 3000)}\n`;
            }
          } catch (e) {
            console.warn("[AI Chat] Could not fetch file text on frontend:", file.file_name);
          }
        }
      }

      setExtractedContext(context);
    } catch (err) {
      console.error("Context extraction error:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      console.log("[AI Chat] Invoking Edge Function...");
      const { data, error } = await supabase.functions.invoke("post-ai-chat", {
        body: {
          materialId,
          message: userMessage,
          frontendContext: extractedContext,
          history: messages.slice(-6), // Send last 3 turns for context
        },
      });

      if (error) throw error;

      if (data?.success) {
        const newAssistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
        };

        const updatedMessages = [...messages, newUserMessage, newAssistantMessage];
        setMessages(updatedMessages);

        // Save conversation history
        await supabase.from("post_ai_conversations").upsert({
          material_id: materialId,
          user_id: user.id,
          messages: updatedMessages as any,
          updated_at: new Date().toISOString(),
        });
      } else {
        throw new Error(data?.error || "Failed to get AI response");
      }
    } catch (err: any) {
      console.error("[AI Chat] Chat error:", err);
      toast({
        title: "Error",
        description: sanitizeError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className={`relative ml-auto w-full bg-card border-l border-border shadow-lg flex flex-col animate-in slide-in-from-right-96 transition-all duration-300 ${
        isExpanded ? "max-w-4xl" : "max-w-sm"
      }`}>
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative">
              <img 
                src="/sage-avatar.png" 
                alt="Sage" 
                className="w-10 h-10 rounded-full border border-border bg-muted object-cover"
              />
              {loading && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-border shadow-sm">
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Sage
                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium uppercase tracking-wider">AI</span>
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {loading ? "Sage is thinking..." : materialTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="w-5 h-5 text-foreground" />
              ) : (
                <Maximize2 className="w-5 h-5 text-foreground" />
              )}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Sparkles className="w-8 h-8 text-primary/30 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                Ask me anything about this material!
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                I can summarize the content or help you understand complex topics.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0 [&>strong]:font-bold [&>em]:italic [&_code]:bg-black/20 [&_code]:px-1 [&_code]:rounded">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2 max-w-[80%]">
                <img 
                  src="/sage-avatar.png" 
                  alt="Sage" 
                  className="w-6 h-6 rounded-full border border-border bg-muted shrink-0 mt-1"
                />
                <div className="bg-muted rounded-2xl px-4 py-2 text-sm text-foreground flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  Sage is thinking...
                </div>
              </div>
            </div>
          )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-background pb-20 md:pb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="icon" className="rounded-full shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
            AI can make mistakes. Verify important info.
          </p>
        </form>
      </div>
    </div>
  );
};

export default PostAIChatSidebar;
