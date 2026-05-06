import { useState, useRef } from "react";
import { Camera, Upload, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SelectedFile {
  file: File;
  preview: string | null;
}

interface MagicUploadProps {
  onAnalysisComplete: (analysis: {
    title: string;
    description: string;
    subject: string;
    type: string;
  }) => void;
  onFilesSelected: (files: SelectedFile[]) => void;
}

const MagicUpload = ({ onAnalysisComplete, onFilesSelected }: MagicUploadProps) => {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createSelectedFile = (file: File): SelectedFile => {
    return {
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    };
  };

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(",")[1];
          const mimeType = file.type;

          // Get the session token from Supabase
          const { data: { session } } = await supabase.auth.getSession();
          
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            throw new Error("Supabase configuration missing");
          }

          console.log("[MagicUpload] Supabase URL:", supabaseUrl);
          console.log("[MagicUpload] Image size:", base64.length, "bytes");
          console.log("[MagicUpload] MIME type:", mimeType);
          console.log("[MagicUpload] Calling analyze-material function...");
          
          const functionUrl = `${supabaseUrl}/functions/v1/analyze-material`;
          console.log("[MagicUpload] Function URL:", functionUrl);

          const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token || ""}`,
              apikey: supabaseKey,
            },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType,
            }),
          });

          console.log("[MagicUpload] Response status:", response.status);
          
          if (!response.ok) {
            const text = await response.text();
            console.error("[MagicUpload] Error response:", text);
            
            let errorMessage = "Analysis failed";
            try {
              const errorJson = JSON.parse(text);
              errorMessage = errorJson.error || text;
            } catch (e) {
              errorMessage = text;
            }
            
            console.error("[MagicUpload] Parsed error:", errorMessage);
            
            // Even if analysis fails, attach the file so user doesn't lose it
            const selectedFile = createSelectedFile(file);
            onFilesSelected([selectedFile]);
            
            toast({
              title: "⚠️ Sage couldn't analyze this one",
              description: "Your file is attached! You can fill in the details manually.",
              variant: "destructive",
            });
            setAnalyzing(false);
            return;
          }

          const analysis = await response.json();
          console.log("[MagicUpload] Analysis result:", analysis);
          
          // Create SelectedFile object with preview
          const selectedFile = createSelectedFile(file);
          
          // Pass the SelectedFile object to parent
          onFilesSelected([selectedFile]);
          onAnalysisComplete(analysis);

          toast({
            title: "✨ Sage analyzed your material!",
            description: "Review the suggestions and adjust as needed.",
          });
        } catch (error: any) {
          console.error("[MagicUpload] Analysis error:", error);
          
          // Attach file even if analysis fails
          const selectedFile = createSelectedFile(file);
          onFilesSelected([selectedFile]);
          
          toast({
            title: "⚠️ Analysis couldn't complete",
            description: "Your file is attached. Fill in the details manually or try again.",
            variant: "destructive",
          });
        } finally {
          setAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("[MagicUpload] File read error:", error);
      toast({
        title: "Error reading file",
        description: error.message || "Could not read the file",
        variant: "destructive",
      });
      setAnalyzing(false);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeImage(file);
      // Reset input
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast({
          title: "Unsupported format",
          description: "Please use JPG, PNG, or WEBP images (HEIC isn't supported)",
          variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      analyzeImage(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default MagicUpload;
