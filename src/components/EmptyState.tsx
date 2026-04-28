import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconColor?: string;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconColor = "text-primary/30",
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Icon className={`w-12 h-12 mb-4 ${iconColor}`} />
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="gap-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
