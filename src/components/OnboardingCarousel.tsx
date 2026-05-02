import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides = [
  {
    title: "Share Your Knowledge",
    description: "Upload your notes, essays, and study guides to help fellow students and build your academic reputation.",
    image: "/onboarding-1.png",
    color: "bg-amber-50"
  },
  {
    title: "Earn Study Credits",
    description: "Get rewarded for your contributions! Use credits to unlock premium materials from top students.",
    image: "/onboarding-2.png",
    color: "bg-blue-50"
  },
  {
    title: "Sage AI Assistant",
    description: "Meet Sage, your personal study partner. Get instant summaries, explanations, and answers for any material.",
    image: "/onboarding-3.png",
    color: "bg-emerald-50"
  }
];

const OnboardingCarousel = () => {
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setOpen(false);
  };

  const handleJoinStudySwap = () => {
    handleClose();
    // Navigate to auth page - works for both new signups and existing logins
    window.location.href = "/auth";
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-card rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors border border-border"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>

        <div className={`aspect-[4/5] flex items-center justify-center p-8 transition-colors duration-500 ${slides[currentSlide].color}`}>
          <img 
            src={slides[currentSlide].image} 
            alt={slides[currentSlide].title}
            className="w-full h-full object-contain animate-in slide-in-from-bottom-8 duration-500"
          />
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          <div className="flex gap-1.5 mb-6">
            {slides.map((_, i) => (
              <div 
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentSlide ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
            {slides[currentSlide].title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            {slides[currentSlide].description}
          </p>
          {currentSlide === slides.length - 1 && (
            <p className="text-xs text-muted-foreground/70 mb-6 italic">
              New or returning? Join thousands of students sharing knowledge and earning rewards.
            </p>
          )}

          <div className="flex flex-col w-full gap-3">
            {currentSlide === slides.length - 1 ? (
              <>
                <Button 
                  className="w-full rounded-xl py-6 text-base font-semibold"
                  onClick={handleJoinStudySwap}
                >
                  Join StudySwap
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <div className="flex gap-3">
                {currentSlide > 0 && (
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl py-6"
                    onClick={prevSlide}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                <Button 
                  className="flex-1 rounded-xl py-6"
                  onClick={nextSlide}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingCarousel;
