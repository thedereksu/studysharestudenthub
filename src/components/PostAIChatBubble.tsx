import { Sparkles } from "lucide-react";

interface PostAIChatBubbleProps {
  onClick: () => void;
}

const PostAIChatBubble = ({ onClick }: PostAIChatBubbleProps) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-2xl hover:shadow-2xl hover:scale-125 transition-all duration-200 flex items-center justify-center group border-2 border-primary-foreground/20"
      title="Ask AI about this material"
    >
      <Sparkles className="w-7 h-7" />
      <span className="absolute bottom-full right-0 mb-3 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
        Ask AI
      </span>
    </button>
  );
};

export default PostAIChatBubble;
