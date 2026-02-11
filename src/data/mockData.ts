export interface Listing {
  id: string;
  title: string;
  subject: string;
  type: "Notes" | "Study Guide" | "Practice Problems" | "Summary" | "Exam Prep";
  exchangeType: "Free" | "Trade" | "Paid";
  credits?: number;
  previewImage: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
  };
  rating: number;
  ratingCount: number;
  createdAt: string;
  description: string;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  name: string;
  school: string;
  bio: string;
  avatar: string;
  rating: number;
  ratingCount: number;
  subjects: string[];
  listingsCount: number;
  tradesCompleted: number;
}

export const mockListings: Listing[] = [
  {
    id: "1",
    title: "AP Biology Unit 3 - Cellular Energetics",
    subject: "Biology",
    type: "Notes",
    exchangeType: "Free",
    previewImage: "",
    author: { id: "u1", name: "Maya Chen", avatar: "", rating: 4.8 },
    rating: 4.9,
    ratingCount: 23,
    createdAt: "2 hours ago",
    description: "Comprehensive notes covering cellular respiration, photosynthesis, and energy flow. Includes diagrams and mnemonics.",
  },
  {
    id: "2",
    title: "Calculus II - Integration Techniques",
    subject: "Mathematics",
    type: "Study Guide",
    exchangeType: "Trade",
    previewImage: "",
    author: { id: "u2", name: "James Park", avatar: "", rating: 4.5 },
    rating: 4.7,
    ratingCount: 15,
    createdAt: "5 hours ago",
    description: "Step-by-step guide for integration by parts, trig substitution, and partial fractions with worked examples.",
  },
  {
    id: "3",
    title: "Organic Chemistry Practice Set",
    subject: "Chemistry",
    type: "Practice Problems",
    exchangeType: "Paid",
    credits: 5,
    previewImage: "",
    author: { id: "u3", name: "Aisha Rodriguez", avatar: "", rating: 4.9 },
    rating: 4.8,
    ratingCount: 31,
    createdAt: "1 day ago",
    description: "50 practice problems on reaction mechanisms, stereochemistry, and functional group transformations.",
  },
  {
    id: "4",
    title: "US History - Civil War Era Summary",
    subject: "History",
    type: "Summary",
    exchangeType: "Free",
    previewImage: "",
    author: { id: "u4", name: "David Kim", avatar: "", rating: 4.3 },
    rating: 4.4,
    ratingCount: 8,
    createdAt: "2 days ago",
    description: "Concise summary of key events, figures, and themes from the Civil War period. Great for quick review.",
  },
  {
    id: "5",
    title: "Physics - Mechanics Exam Prep",
    subject: "Physics",
    type: "Exam Prep",
    exchangeType: "Trade",
    previewImage: "",
    author: { id: "u1", name: "Maya Chen", avatar: "", rating: 4.8 },
    rating: 4.6,
    ratingCount: 12,
    createdAt: "3 days ago",
    description: "Key formulas, concepts, and practice problems to prepare for mechanics exams.",
  },
  {
    id: "6",
    title: "English Literature - Poetry Analysis",
    subject: "English",
    type: "Notes",
    exchangeType: "Free",
    previewImage: "",
    author: { id: "u5", name: "Sophie Williams", avatar: "", rating: 4.6 },
    rating: 4.5,
    ratingCount: 19,
    createdAt: "4 days ago",
    description: "Detailed analysis of major poems with literary devices, themes, and essay frameworks.",
  },
];

export const mockMessages: Message[] = [
  { id: "m1", userId: "u2", userName: "James Park", userAvatar: "", lastMessage: "Sure, I can trade my calc notes for your bio guide!", timestamp: "10 min ago", unread: 2 },
  { id: "m2", userId: "u3", userName: "Aisha Rodriguez", userAvatar: "", lastMessage: "Thanks for the practice problems!", timestamp: "1 hour ago", unread: 0 },
  { id: "m3", userId: "u4", userName: "David Kim", userAvatar: "", lastMessage: "Do you have notes for chapter 5?", timestamp: "3 hours ago", unread: 1 },
];

export const mockProfile: UserProfile = {
  id: "u1",
  name: "Maya Chen",
  school: "Stanford University",
  bio: "Pre-med student. Great at biology explanations and visual study guides. Love helping others learn!",
  avatar: "",
  rating: 4.8,
  ratingCount: 47,
  subjects: ["Biology", "Chemistry", "Physics"],
  listingsCount: 12,
  tradesCompleted: 34,
};

export const subjects = ["All", "Biology", "Chemistry", "Mathematics", "Physics", "History", "English", "Computer Science", "Economics"];
export const materialTypes = ["All", "Notes", "Study Guide", "Practice Problems", "Summary", "Exam Prep"];
export const exchangeTypes = ["All", "Free", "Trade", "Paid"];
