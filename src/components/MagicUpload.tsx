import { useState, useRef } from "react";
import { Camera, Upload, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MagicUploadProps {
  onAnalysisComplete: (analysis: {
    title: string;
    description: string;
    subject: string;
    type: string;
  }) => void;
  onFilesSelected: (files: File[]) => void;
}

const MagicUpload = ({ onAnalysisComplete, onFilesSelected }: MagicUploadProps) => {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const mimeType = file.type;

        const response = await fetch("/functions/v1/analyze-material", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
          },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
          }),
        });

        if (!response.ok) {
          throw new Error("Analysis failed");
        }

        const analysis = await response.json();
        onFilesSelected([file]);
        onAnalysisComplete(analysis);

        toast({
          title: "✨ Sage analyzed your material!",
          description: "Review the suggestions and adjust as needed.",
        });
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Could not analyze the image",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeImage(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/heic"].includes(file.type)) {
        toast({
          title: "Unsupported format",
          description: "Please use JPG, PNG, or HEIC images",
          variant: "destructive",
        });
        return;
      }
      analyzeImage(file);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <img src="/sage-avatar.png" alt="Sage" className="w-5 h-5 object-contain" />
        <h3 className="text-sm font-semibold text-foreground">Sage's Magic Upload</h3>
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Let Sage read your material and auto-fill the details. Take a photo or upload a file.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={analyzing}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {analyzing ? "Analyzing..." : "Take Photo"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {analyzing ? "Analyzing..." : "Upload File"}
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default MagicUpload;
