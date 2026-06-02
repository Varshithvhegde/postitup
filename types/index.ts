export type BoardMode = "free" | "grid" | "ruled";
export type BoardVisibility = "public" | "link" | "private";
export type NoteColor = "yellow" | "blue" | "pink" | "green" | "orange";

export interface Board {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  owner_id: string;
  visibility: BoardVisibility;
  mode: BoardMode;
  prompt: string | null;
  background: BoardMode; // same as mode — controls canvas bg
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  board_id: string;
  content: string;
  color: NoteColor;
  x: number;
  y: number;
  width: number;
  rotation: number;
  author_name: string;
  user_id: string | null;
  upvotes: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}
