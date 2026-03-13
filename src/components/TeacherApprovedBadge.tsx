import { ShieldCheck } from "lucide-react";

const TeacherApprovedBadge = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 ${className}`}>
    <ShieldCheck className="w-3 h-3" /> Teacher Approved
  </span>
);

export default TeacherApprovedBadge;
