import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import BoardSettings from "@/components/BoardSettings";

export default async function BoardSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: board } = await supabase
    .from("boards").select("*").eq("slug", slug).single();

  if (!board) notFound();
  if (board.owner_id !== user.id) redirect(`/board/${slug}`);

  return <BoardSettings board={board} />;
}
