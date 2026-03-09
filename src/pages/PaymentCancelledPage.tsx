import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentCancelledPage = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-4 pt-16 text-center animate-fade-in">
      <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
      <h1 className="text-2xl font-semibold text-foreground mb-2">Payment Cancelled</h1>
      <p className="text-sm text-muted-foreground mb-6">
        No charges were made. You can try again anytime.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => navigate("/buy-credits")}>Try Again</Button>
        <Button variant="outline" onClick={() => navigate("/profile")}>Back to Profile</Button>
      </div>
    </div>
  );
};

export default PaymentCancelledPage;
