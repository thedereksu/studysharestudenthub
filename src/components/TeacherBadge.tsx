import { GraduationCap } from "lucide-react";

const TeacherBadge = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 ${className}`}>
    <GraduationCap className="w-3 h-3" /> Teacher
  </span>
);

export default TeacherBadge;
