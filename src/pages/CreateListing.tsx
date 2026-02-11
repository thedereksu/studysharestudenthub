import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subjects, materialTypes } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";

const exchangeOptions = ["Free", "Trade", "Paid"];

const CreateListing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [exchange, setExchange] = useState("Free");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = () => {
    if (!title || !subject || !type || !confirmed) {
      toast({ title: "Please fill all fields and confirm the integrity checkbox", variant: "destructive" });
      return;
    }
    toast({ title: "Listing created!", description: "Your study material has been posted." });
    navigate("/");
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

      {/* Upload area */}
      <div className="border-2 border-dashed border-border rounded-lg aspect-video flex flex-col items-center justify-center gap-2 mb-5 bg-card">
        <Upload className="w-8 h-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">Upload preview image</span>
        <span className="text-[10px] text-muted-foreground">Images only · Partial/blurred preview recommended</span>
      </div>

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

      <Button className="w-full mb-8" onClick={handleSubmit} disabled={!confirmed}>
        Post Material
      </Button>
    </div>
  );
};

export default CreateListing;
