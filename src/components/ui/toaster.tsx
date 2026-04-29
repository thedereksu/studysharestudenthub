import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // @ts-ignore - custom property for mascot
        const mascot = props.mascot;

        return (
          <Toast key={id} {...props}>
            <div className="flex gap-3 items-start">
              {mascot === "success" && (
                <div className="mt-1 shrink-0">
                  <img src="/sage-success.png" alt="Sage" className="w-12 h-12 object-contain animate-bounce-short" />
                </div>
              )}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
