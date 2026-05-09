"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";

import ReaderHud from "../../../components/ReaderHud";
import Toast from "../../../components/Toast";
import { useToast } from "../../../lib/use-toast";
import { USER_ID } from "../../../lib/user";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "intro",
  role: "assistant",
  content: "I’m Shelf Agent. Ask me what to read next, how to write a review, or what your shelf says about you. I may be rude, but only to patterns.",
};

const SUGGESTIONS = [
  "What does my shelf say about my taste?",
  "What should I review next?",
  "Recommend music based on my shelf.",
  "Give me a cozy recommendation prompt.",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { toast, toastVisible, showToast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function sendMessage(content: string) {
    const trimmedContent = content.trim();

    if (!trimmedContent || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedContent,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: USER_ID,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Agent failed");
      }

      const data = (await response.json()) as { reply?: unknown };

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: typeof data.reply === "string" && data.reply.trim()
            ? data.reply.trim()
            : "I stared at your shelf and got nothing. This is rare, but not flattering.",
        },
      ]);
    } catch {
      showToast("Shelf Agent got wedged. Try again.", "error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="screen-shell agent-shell">
      <ReaderHud />

      <header className="screen-header">
        <span className="screen-kicker">
          <Bot size={14} />
          Shelf Agent
        </span>
        <h1 className="font-display text-[38px] leading-tight text-ink sm:text-[46px]">
          One agent. Many opinions.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          Chat with a reading agent that can see your shelf, reviews, and taste signals.
        </p>
      </header>

      <section className="agent-card">
        <div className="agent-card-header">
          <div>
            <p className="hero-chip w-fit">
              <Sparkles size={14} />
              Live shelf context
            </p>
            <p className="mt-3 text-sm leading-6 text-page/70">
              It reads your ComfyReads data. Not your mind. Manage expectations.
            </p>
          </div>
          <Bot size={34} className="text-gold" />
        </div>

        <div className="agent-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void sendMessage(suggestion)}
              disabled={isSending}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="agent-thread">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`agent-message agent-message--${message.role}`}
            >
              <p>{message.content}</p>
            </div>
          ))}

          {isSending ? (
            <div className="agent-message agent-message--assistant">
              <p className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                Thinking with unnecessary judgement.
              </p>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <form
          className="agent-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask the agent about your shelf"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!draft.trim() || isSending}
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
          </button>
        </form>
      </section>

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          visible={toastVisible}
        />
      ) : null}
    </div>
  );
}
