import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

const ConfigErrorScreen = ({ message }: { message: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <p className="text-sm font-medium text-destructive">App failed to start</p>
      <h1 className="mt-2 text-2xl font-semibold">Configuration issue</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Reload app
      </button>
    </div>
  </div>
);

async function bootstrap() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    console.error("Missing backend configuration in the frontend build.");
    root.render(
      <ConfigErrorScreen message="This build is missing its backend configuration. Republish the frontend to refresh the live bundle, then clear the installed app/browser cache if needed." />,
    );
    return;
  }

  try {
    const { default: App } = await import("./App.tsx");
    root.render(<App />);
  } catch (error) {
    console.error("Failed to bootstrap app:", error);
    root.render(
      <ConfigErrorScreen message="The app bundle could not be loaded correctly. Please refresh and try again." />,
    );
  }
}

void bootstrap();
