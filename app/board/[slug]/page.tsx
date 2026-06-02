import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BoardCanvas from "@/components/canvas/BoardCanvas";

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!board) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .eq("board_id", board.id)
    .order("created_at", { ascending: true });

  const isOwner = user?.id === board.owner_id;

  return (
    <BoardCanvas
      board={board}
      initialNotes={notes ?? []}
      currentUser={user ? { id: user.id, email: user.email ?? "" } : null}
      isOwner={isOwner}
    />
  );
}
