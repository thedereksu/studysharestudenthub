import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, MessageCircle, User, Search } from "lucide-react";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: PlusCircle, label: "Post", path: "/create" },
  { icon: MessageCircle, label: "Messages", path: "/messages" },
  { icon: User, label: "Profile", path: "/profile" },
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide bottom nav on chat detail page
  const hideNav = location.pathname.startsWith("/chat/");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
          <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
            {navItems.map(({ icon: Icon, label, path }) => {
              const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
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
