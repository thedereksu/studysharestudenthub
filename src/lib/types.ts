export interface Profile {
  id: string;
  name: string;
  school: string;
  bio: string;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialFile {
  file_url: string;
  file_type: string;
  file_name: string;
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
  files: MaterialFile[];
  credit_price: number;
  ownership_confirmed: boolean;
  is_promoted: boolean;
  promotion_expires_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface Review {
  id: string;
  material_id: string;
  reviewer_id: string;
  rating: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  material_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  profiles_user1?: Profile;
  profiles_user2?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const subjects = ["All", "Biology", "Chemistry", "Computer Science", "Economics", "Engineering", "English", "Environmental Science", "History", "Mathematics", "Physics", "Spanish"];
export const materialTypes = ["All", "Notes", "Study Guide", "Practice Problems", "Summary", "Exam Prep"];
export const exchangeTypes = ["All", "Free", "Trade", "Paid"];
