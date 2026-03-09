import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-4 pt-16 text-center animate-fade-in">
      <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
      <h1 className="text-2xl font-semibold text-foreground mb-2">Payment Successful!</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Your credits have been added to your account. It may take a moment to reflect.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => navigate("/profile")}>View Profile</Button>
        <Button variant="outline" onClick={() => navigate("/")}>Browse Materials</Button>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
