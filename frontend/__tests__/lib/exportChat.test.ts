import { describe, it, expect } from "vitest";
import { escapeHtml, safeName, buildMarkdown } from "@/lib/exportChat";
import type { Message } from "@/types";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("escapes multiple characters in one string", () => {
    expect(escapeHtml('<a href="x">link & text</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;link &amp; text&lt;/a&gt;"
    );
  });
});

describe("safeName", () => {
  it("replaces spaces with hyphens and lowercases", () => {
    expect(safeName("Hello World")).toBe("hello-world");
  });

  it("lowercases uppercase letters", () => {
    expect(safeName("MyChat")).toBe("mychat");
  });

  it("collapses consecutive non-alphanumeric chars to one hyphen", () => {
    expect(safeName("hello---world")).toBe("hello-world");
  });

  it("truncates to 60 characters", () => {
    expect(safeName("a".repeat(80))).toHaveLength(60);
  });

  it("falls back to 'chat' for empty string", () => {
    expect(safeName("")).toBe("chat");
  });

  it("handles alphanumeric only input unchanged (lowercased)", () => {
    expect(safeName("mychat123")).toBe("mychat123");
  });
});

describe("buildMarkdown", () => {
  it("includes the repo name in the heading", () => {
    const md = buildMarkdown([], "my-repo");
    expect(md).toContain("CodeLens Chat — my-repo");
  });

  it("includes an export timestamp", () => {
    const md = buildMarkdown([], "repo");
    expect(md).toContain("Exported:");
  });

  it("formats user messages under ## You", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello there", streaming: false },
    ];
    const md = buildMarkdown(messages, "repo");
    expect(md).toContain("## You\n\nHello there");
  });

  it("formats assistant messages under ## CodeLens", () => {
    const messages: Message[] = [
      { id: "2", role: "assistant", content: "Hi back", streaming: false },
    ];
    const md = buildMarkdown(messages, "repo");
    expect(md).toContain("## CodeLens\n\nHi back");
  });

  it("lists sources when present on assistant messages", () => {
    const messages: Message[] = [
      {
        id: "3",
        role: "assistant",
        content: "answer",
        streaming: false,
        sources: [
          { file_path: "src/index.ts", chunk: "", score: 0.9 },
          { file_path: "lib/utils.ts", chunk: "", score: 0.8 },
        ],
      },
    ];
    const md = buildMarkdown(messages, "repo");
    expect(md).toContain("`src/index.ts`");
    expect(md).toContain("`lib/utils.ts`");
  });

  it("omits sources section when there are none", () => {
    const messages: Message[] = [
      { id: "4", role: "assistant", content: "no sources", streaming: false },
    ];
    const md = buildMarkdown(messages, "repo");
    expect(md).not.toContain("**Sources:**");
  });

  it("produces a horizontal rule separator between messages", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "q", streaming: false },
      { id: "2", role: "assistant", content: "a", streaming: false },
    ];
    const md = buildMarkdown(messages, "repo");
    expect(md.match(/^---$/m)).not.toBeNull();
  });
});
