import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Sparkles, Maximize2, Minimize2, Search, Paperclip, Trash2 } from "lucide-react";
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
  attachments?: Array<{
    name: string;
    type: string;
    data: string; // base64
  }>;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      const windowHeight = window.innerHeight;
      const visualViewport = (window as any).visualViewport?.height || windowHeight;
      const keyboardH = windowHeight - visualViewport;
      setKeyboardHeight(keyboardH);
      
      // Scroll input into view when keyboard appears
      if (keyboardH > 0 && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const filteredMessages = searchQuery.trim() === ""
    ? messages
    : messages.filter(msg =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchCredits = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setCredits(data.credit_balance);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast({
        title: "Error",
        description: "Could not fetch credit balance.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history and extract context on first open
  useEffect(() => {
    if (isOpen && !initialized && user) {
      fetchCredits();
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

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            data: base64,
          },
        ]);
      };

      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || !user) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setAttachments([]);

    try {
      console.log("[AI Chat] Invoking Edge Function with streaming...");
      
      // Create a placeholder for the assistant message
      const assistantMessageId = Date.now();
      let streamedContent = "";
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ]);

      const response = await supabase.functions.invoke("post-ai-chat", {
        headers: {
          Authorization: `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
        },
        body: {
          materialId,
          message: userMessage,
          frontendContext: extractedContext,
          history: messages.slice(-6), // Send last 3 turns for context
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });

      if (response.error) {
        if (response.error.message.includes("Insufficient credits")) {
          toast({
            title: "Insufficient Credits",
            description: "You need more credits to use Sage AI. Post a material to earn 5 credits!",
            variant: "destructive",
          });
        }
        throw response.error;
      }

      // Refresh credits after response
      fetchCredits();

      if (response.data?.success) {
        streamedContent = response.data.message;
        
        // Simulate streaming by updating content character by character
        const streamingSpeed = 10; // milliseconds per character
        let currentIndex = 0;
        
        const streamInterval = setInterval(() => {
          if (currentIndex < streamedContent.length) {
            currentIndex++;
            const displayContent = streamedContent.substring(0, currentIndex);
            
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.content = displayContent;
              }
              return updated;
            });
          } else {
            clearInterval(streamInterval);
            setLoading(false);
          }
        }, streamingSpeed);
      } else {
        throw new Error(response.data?.error || "Failed to get AI response");
      }
    } catch (err: any) {
      console.error("[AI Chat] Chat error:", err);
      toast({
        title: "Error",
        description: sanitizeError(err),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className={`fixed top-0 right-0 ml-auto w-full bg-card border-l border-border shadow-lg flex flex-col animate-in slide-in-from-right-96 transition-all duration-300 bottom-16 ${
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
          <div className="flex items-center gap-2">
            {credits !== null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>{credits} Credits</span>
              </div>
            )}
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
              title="Search messages"
            >
              <Search className="w-5 h-5 text-foreground" />
            </button>
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

        {isSearchOpen && (
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            {searchQuery && filteredMessages.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Found {filteredMessages.length} of {messages.length} messages
              </p>
            )}
            {searchQuery && filteredMessages.length === 0 && messages.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No messages match your search
              </p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 || (searchQuery && filteredMessages.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Sparkles className="w-8 h-8 text-primary/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No messages found" : "Ask Sage a question about this material"}
              </p>
            </div>
          ) : (
            <>
              {filteredMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex items-start gap-2 max-w-[80%] ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <img 
                        src="/sage-avatar.png" 
                        alt="Sage" 
                        className="w-6 h-6 rounded-full border border-border bg-muted shrink-0 mt-1"
                      />
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.content.includes("```") || msg.content.includes("#") ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-current/20 space-y-1">
                          {msg.attachments.map((att, i) => (
                            <p key={i} className="text-xs opacity-75">📎 {att.name}</p>
                          ))}
                        </div>
                      )}
                    </div>
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

        <form onSubmit={handleSendMessage} className={`p-4 border-t border-border bg-background flex-shrink-0 transition-all duration-200 ${
          keyboardHeight > 0 ? "pb-4" : "pb-4"
        }`}>
          {attachments.length > 0 && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Attachments ({attachments.length})</p>
              <div className="space-y-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-background rounded p-2">
                    <span className="text-xs truncate text-foreground">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.doc,.docx"
              onChange={handleFileAttachment}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full border border-border hover:bg-muted transition-colors disabled:opacity-50"
              disabled={loading}
              title="Attach files or images"
            >
              <Paperclip className="w-4 h-4 text-foreground" />
            </button>
            <Button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)} size="icon" className="rounded-full shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1 text-center">
                AI can make mistakes. Verify important info. (1 credit per question, 2 credits with attachments)
          </p>
        </form>
      </div>
    </div>
  );
};

export default PostAIChatSidebar;
