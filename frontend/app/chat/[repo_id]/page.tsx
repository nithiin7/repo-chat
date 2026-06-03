import { redirect } from "next/navigation";
import { createChat, listChats } from "@/lib/api/chats";

export const dynamic = "force-dynamic";

export default async function ChatIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ repo_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { repo_id } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  let targetChatId: string | null = null;

  try {
    const chats = await listChats(repo_id);
    if (chats.length > 0) {
      targetChatId = chats[0].id;
    } else {
      const chat = await createChat(repo_id);
      targetChatId = chat.id;
    }
  } catch {
    // Backend unreachable
  }

  const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
  redirect(targetChatId ? `/chat/${repo_id}/${targetChatId}${suffix}` : "/dashboard");
}
