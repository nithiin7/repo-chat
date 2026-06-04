import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/api/queryKeys";

describe("queryKeys", () => {
  it("repos returns stable key", () => {
    expect(queryKeys.repos()).toEqual(["repos"]);
  });

  it("repoStatus includes repoId", () => {
    expect(queryKeys.repoStatus("abc")).toEqual(["repos", "abc", "status"]);
  });

  it("chats includes repoId", () => {
    expect(queryKeys.chats("repo-1")).toEqual(["chats", "repo-1"]);
  });

  it("chatMessages includes chatId", () => {
    expect(queryKeys.chatMessages("chat-1")).toEqual(["chatMessages", "chat-1"]);
  });

  it("settings returns stable key", () => {
    expect(queryKeys.settings()).toEqual(["settings"]);
  });

  it("ollamaModels returns stable key", () => {
    expect(queryKeys.ollamaModels()).toEqual(["ollamaModels"]);
  });

  it("embeddingModels returns stable key", () => {
    expect(queryKeys.embeddingModels()).toEqual(["embeddingModels"]);
  });

  it("search includes repoId, query, topK", () => {
    expect(queryKeys.search("repo-1", "foo", 5)).toEqual(["search", "repo-1", "foo", 5]);
  });

  it("navigate includes repoId, query, kind", () => {
    expect(queryKeys.navigate("repo-1", "foo", "function")).toEqual([
      "navigate",
      "repo-1",
      "foo",
      "function",
    ]);
  });

  it("navigate handles undefined kind", () => {
    expect(queryKeys.navigate("repo-1", "foo", undefined)).toEqual([
      "navigate",
      "repo-1",
      "foo",
      undefined,
    ]);
  });

  it("deps includes repoId", () => {
    expect(queryKeys.deps("repo-1")).toEqual(["deps", "repo-1"]);
  });

  it("health includes repoId", () => {
    expect(queryKeys.health("repo-1")).toEqual(["health", "repo-1"]);
  });

  it("different repoIds produce different keys", () => {
    expect(queryKeys.chats("repo-a")).not.toEqual(queryKeys.chats("repo-b"));
  });
});
