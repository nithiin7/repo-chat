"use client";

import { useState } from "react";
import { MessageSquarePlus, Trash2, Check, X, Pencil, Pin, PinOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { createChat, deleteChatSession, listChats, pinChat, renameChat } from "@/lib/api/chats";
import { queryKeys } from "@/lib/api/queryKeys";
import { toast } from "@/components/ui/toast";
import type { Chat } from "@/types";

interface ChatSidebarProps {
  repoId: string;
  activeChatId: string;
  onSelectChat: (chat: Chat) => void;
}

const ChatSidebar = ({ repoId, activeChatId, onSelectChat }: ChatSidebarProps) => {
  const queryClient = useQueryClient();
  const { data: chats = [] } = useQuery({
    queryKey: queryKeys.chats(repoId),
    queryFn: () => listChats(repoId),
  });

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const handleNewChat = async () => {
    const emptyChat = chats.find((c) => c.title === "New Chat");
    if (emptyChat) {
      onSelectChat(emptyChat);
      return;
    }
    setCreating(true);
    try {
      const chat = await createChat(repoId);
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (old = []) => [chat, ...old]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats(repoId) });
      onSelectChat(chat);
    } catch {
      toast("Failed to create chat. Is the backend running?");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteChatSession(id);
      const updated = chats.filter((c) => c.id !== id);
      if (id === activeChatId) {
        if (updated.length > 0) {
          queryClient.setQueryData(queryKeys.chats(repoId), updated);
          onSelectChat(updated[0]);
        } else {
          const fresh = await createChat(repoId);
          queryClient.setQueryData(queryKeys.chats(repoId), [fresh]);
          onSelectChat(fresh);
        }
      } else {
        queryClient.setQueryData(queryKeys.chats(repoId), updated);
      }
    } catch {
      toast("Failed to delete chat");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditValue(chat.title);
  };

  const commitEdit = async (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await renameChat(id, trimmed);
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (old = []) =>
        old.map((c) => (c.id === id ? updated : c))
      );
    } catch {
      toast("Failed to rename chat");
    } finally {
      setEditingId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const handlePin = async (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setPinningId(chat.id);
    try {
      const updated = await pinChat(chat.id, !chat.is_pinned);
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (old = []) => {
        const replaced = old.map((c) => (c.id === chat.id ? updated : c));
        return [...replaced.filter((c) => c.is_pinned), ...replaced.filter((c) => !c.is_pinned)];
      });
    } catch {
      toast("Failed to update pin");
    } finally {
      setPinningId(null);
    }
  };

  const pinnedChats = chats.filter((c) => c.is_pinned);
  const recentChats = chats.filter((c) => !c.is_pinned);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Chats
        </span>
        <button
          onClick={() => void handleNewChat()}
          disabled={creating}
          title="New chat"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-40"
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chats.length === 0 && (
          <p className="text-muted-foreground px-2 py-4 text-center text-xs">No chats yet</p>
        )}

        {pinnedChats.length > 0 && (
          <>
            <p className="text-muted-foreground/60 px-1 pt-1 pb-1 text-xs font-medium tracking-wider uppercase">
              Pinned
            </p>
            <AnimatePresence initial={false}>
              {pinnedChats.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === activeChatId}
                  isEditing={editingId === chat.id}
                  isDeleting={deletingId === chat.id}
                  isPinning={pinningId === chat.id}
                  editValue={editValue}
                  onSelect={() => {
                    if (editingId !== chat.id && chat.id !== activeChatId) onSelectChat(chat);
                  }}
                  onStartEdit={(e) => startEdit(e, chat)}
                  onCommitEdit={() => void commitEdit(chat.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onEditChange={(v) => setEditValue(v)}
                  onEditKeyDown={(e) => handleEditKeyDown(e, chat.id)}
                  onDelete={(e) => void handleDelete(e, chat.id)}
                  onPin={(e) => void handlePin(e, chat)}
                />
              ))}
            </AnimatePresence>
          </>
        )}

        {recentChats.length > 0 && (
          <>
            {pinnedChats.length > 0 && (
              <p className="text-muted-foreground/60 px-1 pt-2 pb-1 text-xs font-medium tracking-wider uppercase">
                Recent
              </p>
            )}
            <AnimatePresence initial={false}>
              {recentChats.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === activeChatId}
                  isEditing={editingId === chat.id}
                  isDeleting={deletingId === chat.id}
                  isPinning={pinningId === chat.id}
                  editValue={editValue}
                  onSelect={() => {
                    if (editingId !== chat.id && chat.id !== activeChatId) onSelectChat(chat);
                  }}
                  onStartEdit={(e) => startEdit(e, chat)}
                  onCommitEdit={() => void commitEdit(chat.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onEditChange={(v) => setEditValue(v)}
                  onEditKeyDown={(e) => handleEditKeyDown(e, chat.id)}
                  onDelete={(e) => void handleDelete(e, chat.id)}
                  onPin={(e) => void handlePin(e, chat)}
                />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
};

interface ChatRowProps {
  chat: Chat;
  isActive: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isPinning: boolean;
  editValue: string;
  onSelect: () => void;
  onStartEdit: (e: React.MouseEvent) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (v: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onPin: (e: React.MouseEvent) => void;
}

function ChatRow({
  chat,
  isActive,
  isEditing,
  isDeleting,
  isPinning,
  editValue,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditChange,
  onEditKeyDown,
  onDelete,
  onPin,
}: ChatRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div
        onClick={onSelect}
        className={cn(
          "group relative mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
          isActive
            ? "text-foreground bg-indigo-500/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {isEditing ? (
          <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={onEditKeyDown}
              className="text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              onClick={onCommitEdit}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={onCancelEdit}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 truncate">{chat.title}</span>
            <div
              className={cn(
                "flex shrink-0 items-center gap-0.5 transition-opacity",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <button
                onClick={onPin}
                title={chat.is_pinned ? "Unpin" : "Pin"}
                disabled={isPinning}
                className={cn(
                  "flex size-5 items-center justify-center rounded disabled:opacity-40",
                  chat.is_pinned
                    ? "hover:text-muted-foreground text-indigo-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {chat.is_pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
              </button>
              <button
                onClick={onStartEdit}
                title="Rename"
                className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center rounded"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={onDelete}
                title="Delete"
                disabled={isDeleting}
                className="text-muted-foreground hover:text-destructive flex size-5 items-center justify-center rounded disabled:opacity-40"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default ChatSidebar;
