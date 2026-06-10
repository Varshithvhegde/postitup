import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BoardCanvas from "@/components/canvas/BoardCanvas";
import LaneCanvas from "@/components/canvas/LaneCanvas";
import type { Metadata } from "next";

const SITE_URL = "https://postitup.varshithvhegde.in";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: board } = await supabase.from("boards").select("title,description,prompt").eq("slug", slug).single();

  if (!board) return { title: "Board not found — PostItUp" };

  const title = `${board.title} — PostItUp`;
  const desc  = board.description ?? board.prompt ?? "A collaborative sticky note board on PostItUp.";
  const image = `${SITE_URL}/og.png`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE_URL}/board/${slug}`,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [image],
    },
  };
}

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const isOwner = user?.id === board.owner_id;

  if (board.mode === "lane") {
    return (
      <LaneCanvas
        board={board}
        initialNotes={notes ?? []}
        currentUser={user ? { id: user.id, email: user.email ?? "" } : null}
        isOwner={isOwner}
      />
    );
  }

  return (
    <BoardCanvas
      board={board}
      initialNotes={notes ?? []}
      initialRatings={ratings ?? []}
      currentUser={user ? { id: user.id, email: user.email ?? "" } : null}
      isOwner={isOwner}
    />
  );
}
