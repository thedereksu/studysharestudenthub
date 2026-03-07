import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

interface Prefs {
  email_ratings: boolean;
  email_purchases: boolean;
  email_comments: boolean;
  email_messages: boolean;
}

const defaults: Prefs = { email_ratings: false, email_purchases: false, email_comments: false, email_messages: false };

const NotificationPreferences = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as unknown as Prefs);
      setLoaded(true);
    })();
  }, [user]);

  const update = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);

    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });

    if (error) {
      toast({ title: "Failed to save", description: sanitizeError(error), variant: "destructive" });
      setPrefs(prefs); // revert
    }
  };

  if (!loaded) return null;

  const items: { key: keyof Prefs; label: string }[] = [
    { key: "email_ratings", label: "Email me when my material receives a rating" },
    { key: "email_purchases", label: "Email me when someone purchases my material" },
    { key: "email_comments", label: "Email me when someone comments on my material" },
    { key: "email_messages", label: "Email me when I receive a message" },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-base font-sans font-semibold text-foreground mb-4">Email Notifications</h3>
      <div className="space-y-4">
        {items.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Switch checked={prefs[key]} onCheckedChange={(v) => update(key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationPreferences;
