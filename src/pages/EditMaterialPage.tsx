import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subjects, materialTypes } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Material, MaterialFile } from "@/lib/types";

const exchangeOptions = ["Free", "Trade", "Paid"];
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "application/pdf"];

interface SelectedFile {
  file: File;
  preview: string | null;
}

const EditMaterialPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [existingFiles, setExistingFiles] = useState<MaterialFile[]>([]);
  const [removedFiles, setRemovedFiles] = useState<MaterialFile[]>([]);
  const [newFiles, setNewFiles] = useState<SelectedFile[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [exchange, setExchange] = useState("Free");
  const [description, setDescription] = useState("");
  const [creditPrice, setCreditPrice] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth", { replace: true }); return; }
    if (!user || !id) return;

    const fetchMaterial = async () => {
      const { data } = await supabase
        .from("materials")
        .select("*")
        .eq("id", id)
        .single();
      const m = data as unknown as Material | null;
      if (!m || m.uploader_id !== user.id) {
        toast({ title: "Access denied", variant: "destructive" });
        navigate("/", { replace: true });
        return;
      }
      setTitle(m.title);
      setSubject(m.subject);
      setType(m.type);
      setExchange(m.exchange_type);
      setDescription(m.description || "");
      setCreditPrice(m.credit_price);
      const files: MaterialFile[] = m.files?.length
        ? m.files
        : [{ file_url: m.file_url, file_type: m.file_type, file_name: m.title }];
      setExistingFiles(files);
      setLoading(false);
    };
    fetchMaterial();
  }, [user, authLoading, id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid: SelectedFile[] = [];
    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: "Skipped unsupported file", description: `${file.name}`, variant: "destructive" });
        continue;
      }
      valid.push({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
    }
    setNewFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeExisting = (index: number) => {
    const file = existingFiles[index];
    setRemovedFiles((prev) => [...prev, file]);
    setExistingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNew = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !id) return;
    if (existingFiles.length === 0 && newFiles.length === 0) {
      toast({ title: "At least one file is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Upload new files
      const uploadedNew: MaterialFile[] = [];
      for (const { file } of newFiles) {
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("materials").upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("materials").getPublicUrl(filePath);
        uploadedNew.push({ file_url: publicUrl, file_type: file.type, file_name: file.name });
      }

      // Remove deleted files from storage
      for (const f of removedFiles) {
        const pathMatch = f.file_url.match(/\/materials\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from("materials").remove([pathMatch[1]]);
        }
      }

      const allFiles = [...existingFiles, ...uploadedNew];
      const primary = allFiles[0];

      const { error } = await supabase
        .from("materials")
        .update({
          title: title || primary.file_name,
          subject: subject || "Other",
          type: type || "Notes",
          exchange_type: exchange,
          description,
          credit_price: exchange === "Paid" ? creditPrice : 0,
          file_url: primary.file_url,
          file_type: primary.file_type,
          files: allFiles as any,
        })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Material updated!" });
      navigate(`/listing/${id}`);
    } catch (error: any) {
      toast({ title: "Update failed", description: sanitizeError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const SelectPills = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="mb-5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.filter((o) => o !== "All").map((opt) => (
          <button key={opt} onClick={() => onChange(value === opt ? "" : opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${value === opt ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="flex items-center gap-3 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl text-foreground">Edit Material</h1>
      </div>

      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.heic,.pdf" multiple onChange={handleFileSelect} className="hidden" />

      {/* Files grid */}
      <div className="mb-5 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {existingFiles.map((f, i) => (
            <div key={`existing-${i}`} className="relative border border-border rounded-lg aspect-square bg-card flex items-center justify-center overflow-hidden">
              {f.file_type.startsWith("image/") ? (
                <img src={f.file_url} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
                  <FileText className="w-6 h-6" />
                  <span className="text-[10px] font-medium truncate w-full text-center">{f.file_name}</span>
                </div>
              )}
              <button onClick={() => removeExisting(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/80 text-background flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {newFiles.map((f, i) => (
            <div key={`new-${i}`} className="relative border border-border rounded-lg aspect-square bg-card flex items-center justify-center overflow-hidden">
              {f.preview ? (
                <img src={f.preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
                  <FileText className="w-6 h-6" />
                  <span className="text-[10px] font-medium truncate w-full text-center">{f.file.name}</span>
                </div>
              )}
              <button onClick={() => removeNew(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/80 text-background flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center gap-1 bg-card hover:bg-muted/50 transition-colors">
            <Plus className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Add more</span>
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">{existingFiles.length + newFiles.length} file(s) total</p>
      </div>

      <div className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <SelectPills label="Subject" options={subjects} value={subject} onChange={setSubject} />
      <SelectPills label="Material Type" options={materialTypes} value={type} onChange={setType} />
      <SelectPills label="Exchange Type" options={exchangeOptions} value={exchange} onChange={setExchange} />

      {exchange === "Paid" && (
        <div className="mb-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Credit Price</label>
          <input type="number" min={1} value={creditPrice} onChange={(e) => setCreditPrice(parseInt(e.target.value) || 1)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      )}

      <div className="mb-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <Button className="w-full mb-8" onClick={handleSave} disabled={saving || (existingFiles.length === 0 && newFiles.length === 0)}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default EditMaterialPage;
