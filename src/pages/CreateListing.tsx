import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckSquare, X, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subjects, materialTypes } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const exchangeOptions = ["Free", "Trade", "Paid"];
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "application/pdf"];

const CreateListing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [exchange, setExchange] = useState("Free");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      toast({ title: "Unsupported file type", description: "Please upload JPG, PNG, HEIC, or PDF files.", variant: "destructive" });
      return;
    }

    setFile(selected);
    if (selected.type.startsWith("image/")) {
      const url = URL.createObjectURL(selected);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!file || !title || !subject || !type || !confirmed || !user) {
      toast({ title: "Please fill all fields, upload a file, and confirm the integrity checkbox", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("materials")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("materials").insert({
        uploader_id: user.id,
        title,
        subject,
        type,
        exchange_type: exchange,
        description,
        file_url: publicUrl,
        file_type: file.type,
      });

      if (insertError) throw insertError;

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
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.filter((o) => o !== "All").map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
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
        onChange={handleFileSelect}
        className="hidden"
      />

      {!file ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg aspect-video flex flex-col items-center justify-center gap-2 mb-5 bg-card hover:bg-muted/50 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium">Upload File</span>
          <span className="text-[10px] text-muted-foreground">JPG, PNG, HEIC, or PDF</span>
        </button>
      ) : (
        <div className="relative border border-border rounded-lg aspect-video mb-5 bg-card flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileText className="w-10 h-10" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
          )}
          <button
            onClick={clearFile}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Title */}
      <div className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Title</label>
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
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
        <textarea
          placeholder="Describe what's included in your study material..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Integrity checkbox */}
      <div className="bg-secondary rounded-lg p-4 mb-6">
        <button
          onClick={() => setConfirmed(!confirmed)}
          className="flex items-start gap-3 text-left w-full"
        >
          <CheckSquare
            className={`w-5 h-5 mt-0.5 flex-shrink-0 ${confirmed ? "text-primary" : "text-muted-foreground"}`}
          />
          <span className="text-xs text-foreground leading-relaxed">
            I confirm this material is <strong>for studying purposes only</strong>. It does not contain active tests, quizzes, or graded homework assignments.
          </span>
        </button>
      </div>

      <Button className="w-full mb-8" onClick={handleSubmit} disabled={!confirmed || uploading}>
        {uploading ? "Uploading..." : "Post Material"}
      </Button>
    </div>
  );
};

export default CreateListing;
