import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountPage from "@/components/AccountPage";

export default async function Account() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const { count: boardCount } = await supabase
    .from("boards").select("*", { count: "exact", head: true }).eq("owner_id", user.id);

  const { count: noteCount } = await supabase
    .from("notes").select("*", { count: "exact", head: true }).eq("user_id", user.id);

  return (
    <AccountPage
      user={{ id: user.id, email: user.email ?? "" }}
      profile={profile}
      boardCount={boardCount ?? 0}
      noteCount={noteCount ?? 0}
    />
  );
}
