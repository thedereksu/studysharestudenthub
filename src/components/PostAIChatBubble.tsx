import { Sparkles } from "lucide-react";

interface PostAIChatBubbleProps {
  onClick: () => void;
}

const PostAIChatBubble = ({ onClick }: PostAIChatBubbleProps) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group"
      title="Ask AI about this material"
    >
      <Sparkles className="w-6 h-6" />
      <span className="absolute bottom-full right-0 mb-2 px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Ask AI
      </span>
    </button>
  );
};

export default PostAIChatBubble;
