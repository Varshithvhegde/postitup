import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import EmbedCanvas from "@/components/canvas/EmbedCanvas";

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("boards").select("*").eq("slug", slug).single();

  if (!board) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: notes }, { data: ratings }] = await Promise.all([
    supabase.from("notes").select("*").eq("board_id", board.id).order("created_at", { ascending: true }),
    supabase.from("ratings").select("*").eq("board_id", board.id).order("created_at", { ascending: true }),
  ]);

  return (
    <EmbedCanvas
      board={board}
      initialNotes={notes ?? []}
      initialRatings={ratings ?? []}
      currentUser={user ? { id: user.id, email: user.email ?? "" } : null}
    />
  );
}
