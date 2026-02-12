import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subjects, materialTypes } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const exchangeOptions = ["Free", "Trade", "Paid"];
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "application/pdf"];

interface SelectedFile {
  file: File;
  preview: string | null;
}

const CreateListing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [exchange, setExchange] = useState("Free");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid: SelectedFile[] = [];

    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: "Skipped unsupported file", description: `${file.name} is not a supported format.`, variant: "destructive" });
        continue;
      }
      valid.push({
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }

    setFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !user) {
      toast({ title: "Please upload at least one file and sign in", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      for (const { file } of files) {
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("materials")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("materials")
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase.from("materials").insert({
          uploader_id: user.id,
          title: title || file.name,
          subject: subject || "Other",
          type: type || "Notes",
          exchange_type: exchange,
          description,
          file_url: publicUrl,
          file_type: file.type,
        });

        if (insertError) throw insertError;
      }

      toast({ title: "Material posted!", description: "Your study material is now live." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const SelectPills = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="mb-5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{label} <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
      <div className="flex flex-wrap gap-2">
        {options.filter((o) => o !== "All").map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? "" : opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              value === opt ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="flex items-center gap-3 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl text-foreground">Post Material</h1>
      </div>

      {/* File upload area */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.heic,.pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {files.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg aspect-video flex flex-col items-center justify-center gap-2 mb-5 bg-card hover:bg-muted/50 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium">Upload Files</span>
          <span className="text-[10px] text-muted-foreground">JPG, PNG, HEIC, or PDF · Multiple files supported</span>
        </button>
      ) : (
        <div className="mb-5 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative border border-border rounded-lg aspect-square bg-card flex items-center justify-center overflow-hidden">
                {f.preview ? (
                  <img src={f.preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px] font-medium truncate w-full text-center">{f.file.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/80 text-background flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center gap-1 bg-card hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-5 h-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Add more</span>
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Title <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
        <input
          type="text"
          placeholder="e.g. AP Bio Unit 3 Notes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <SelectPills label="Subject" options={subjects} value={subject} onChange={setSubject} />
      <SelectPills label="Material Type" options={materialTypes} value={type} onChange={setType} />
      <SelectPills label="Exchange Type" options={exchangeOptions} value={exchange} onChange={setExchange} />

      {/* Description */}
      <div className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Description <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
        <textarea
          placeholder="Describe what's included in your study material..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <Button className="w-full mb-8" onClick={handleSubmit} disabled={files.length === 0 || uploading}>
        {uploading ? "Uploading..." : `Post Material${files.length > 1 ? `s (${files.length})` : ""}`}
      </Button>
    </div>
  );
};

export default CreateListing;
