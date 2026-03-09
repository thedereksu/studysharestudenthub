import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import HomePage from "@/pages/HomePage";
import SearchPage from "@/pages/SearchPage";
import ListingDetail from "@/pages/ListingDetail";
import CreateListing from "@/pages/CreateListing";
import CreateRequestPage from "@/pages/CreateRequestPage";
import EditMaterialPage from "@/pages/EditMaterialPage";
import ProfilePage from "@/pages/ProfilePage";
import MessagesPage from "@/pages/MessagesPage";
import ChatPage from "@/pages/ChatPage";
import AuthPage from "@/pages/AuthPage";
import AdminPage from "@/pages/AdminPage";
import BuyCreditsPage from "@/pages/BuyCreditsPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import PaymentCancelledPage from "@/pages/PaymentCancelledPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AuthLoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};

const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route
      path="/auth"
      element={
        <PublicOnlyRoute>
          <AuthPage />
        </PublicOnlyRoute>
      }
    />

    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/listing/:id" element={<ListingDetail />} />
      <Route path="/create" element={<CreateListing />} />
      <Route path="/request" element={<CreateRequestPage />} />
      <Route path="/edit/:id" element={<EditMaterialPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/buy-credits" element={<BuyCreditsPage />} />
      <Route path="/payment-success" element={<PaymentSuccessPage />} />
      <Route path="/payment-cancelled" element={<PaymentCancelledPage />} />
    </Route>

    <Route
      path="/chat/:userId"
      element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      }
    />

    <Route
      path="*"
      element={
        <ProtectedRoute>
          <NotFound />
        </ProtectedRoute>
      }
    />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
