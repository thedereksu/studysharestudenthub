import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

const packages = [
  { key: "5credits", credits: 5, price: "$1.00", icon: Coins, label: "Starter", description: "Great for trying things out" },
  { key: "20credits", credits: 20, price: "$2.00", icon: Zap, label: "Popular", description: "Best value for regular users", popular: true },
  { key: "100credits", credits: 100, price: "$5.00", icon: Sparkles, label: "Power Pack", description: "For power users & contributors" },
];

const BuyCreditsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (packageKey: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(packageKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { packageKey },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      toast({ title: "Purchase failed", description: sanitizeError(e), variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="text-2xl text-foreground">Buy Credits</h1>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Credits let you unlock materials, promote listings, and more.
      </p>

      <div className="space-y-3">
        {packages.map((pkg) => (
          <button
            key={pkg.key}
            onClick={() => handlePurchase(pkg.key)}
            disabled={loading !== null}
            className={`w-full text-left bg-card border rounded-lg p-4 transition-all hover:shadow-md ${
              pkg.popular ? "border-primary ring-1 ring-primary/20" : "border-border"
            } ${loading === pkg.key ? "opacity-70" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                pkg.popular ? "bg-primary/10" : "bg-secondary"
              }`}>
                <pkg.icon className={`w-6 h-6 ${pkg.popular ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{pkg.credits} Credits</span>
                  {pkg.popular && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Best Value
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{pkg.description}</p>
              </div>
              <span className="text-lg font-bold text-foreground">{pkg.price}</span>
            </div>
            {loading === pkg.key && (
              <p className="text-xs text-muted-foreground mt-2 text-center">Redirecting to checkout...</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BuyCreditsPage;
