export interface Profile {
  id: string;
  name: string;
  school: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  uploader_id: string;
  title: string;
  subject: string;
  type: string;
  exchange_type: string;
  description: string;
  file_url: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export const subjects = ["All", "Biology", "Chemistry", "Mathematics", "Physics", "History", "English", "Computer Science", "Economics"];
export const materialTypes = ["All", "Notes", "Study Guide", "Practice Problems", "Summary", "Exam Prep"];
export const exchangeTypes = ["All", "Free", "Trade", "Paid"];
