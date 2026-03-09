import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, MessageCircle, User, Search, Shield, HelpCircle } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useAdmin } from "@/hooks/useAdmin";
import NotificationDropdown from "@/components/NotificationDropdown";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/logo.png";

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const totalUnread = useUnreadCount();
  const { isAdmin } = useAdmin();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return null;
  }

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: PlusCircle, label: "Post", path: "/create" },
    { icon: MessageCircle, label: "Messages", path: "/messages", badge: totalUnread },
    { icon: User, label: "Profile", path: "/profile" },
    ...(isAdmin ? [{ icon: Shield, label: "Admin", path: "/admin", badge: 0 }] : []),
  ];

  const hideNav = location.pathname.startsWith("/chat/");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!hideNav && (
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-2">
              <img src={logoImg} alt="StudySwap" className="w-9 h-9" />
              <span className="font-serif text-lg font-semibold text-foreground">StudySwap</span>
            </button>
            {user && <NotificationDropdown />}
          </div>
        </header>
      )}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
          <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
            {navItems.map(({ icon: Icon, label, path, badge }) => {
              const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                  {(badge ?? 0) > 0 && (
                    <span className="absolute -top-1 right-0 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center px-1">
                      {badge! > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default AppLayout;
