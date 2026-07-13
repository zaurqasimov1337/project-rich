'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

const SUGGESTIONS = [
  'Bu ay ən gəlirli kurs hansıdır?',
  'Ödənişi gecikən tələbələri göstər',
  'Davamiyyəti aşağı olan tələbələr kimlərdir?',
  'Bu ayın CRM konversiyası necədir?',
  'Müəllimlərin yükü necə bölünüb?',
];

export default function AiPage() {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.get<Conversation[]>('/ai/conversations'),
  });

  const { data: conversation } = useQuery({
    queryKey: ['ai-conversation', conversationId],
    queryFn: () =>
      api.get<{ messages: ChatMessage[] }>(`/ai/conversations/${conversationId}`),
    enabled: !!conversationId,
  });

  const messages = conversationId ? (conversation?.messages ?? []) : localMessages;

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.post<{ conversationId: string; reply: string }>('/ai/chat', {
        message,
        conversationId: conversationId ?? undefined,
      }),
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setLocalMessages([]);
      void qc.invalidateQueries({ queryKey: ['ai-conversation', data.conversationId] });
      void qc.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  const send = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;
    if (!conversationId) {
      setLocalMessages((m) => [...m, { id: `local-${m.length}`, role: 'user', content: text }]);
    } else {
      qc.setQueryData(
        ['ai-conversation', conversationId],
        (old: { messages: ChatMessage[] } | undefined) =>
          old
            ? { ...old, messages: [...old.messages, { id: 'local', role: 'user' as const, content: text }] }
            : old,
      );
    }
    chatMutation.mutate(text);
    setInput('');
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, chatMutation.isPending]);

  return (
    <div className="grid h-[calc(100vh-140px)] gap-4 lg:grid-cols-[260px_1fr]">
      <div className="hidden space-y-2 overflow-y-auto lg:block">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setConversationId(null);
            setLocalMessages([]);
          }}
        >
          <Sparkles className="h-4 w-4" /> Yeni söhbət
        </Button>
        {conversations?.map((c) => (
          <button
            key={c.id}
            onClick={() => setConversationId(c.id)}
            className={cn(
              'w-full truncate rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-primary',
              conversationId === c.id && 'border-primary ring-1 ring-primary/20',
            )}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="font-semibold">AI Copilot</div>
            <div className="text-xs text-muted">Mərkəzinizin məlumatları üzrə analitik köməkçi</div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && !chatMutation.isPending && (
            <div className="mx-auto max-w-md pt-10 text-center">
              <Bot className="mx-auto h-10 w-10 text-muted" />
              <p className="mt-3 text-sm text-muted">
                Mərkəziniz haqqında istənilən analitik sual verin:
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-bg text-foreground',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-muted-bg px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
              </div>
            </div>
          )}
          {chatMutation.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(chatMutation.error as Error).message}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-border p-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Sualınızı yazın..."
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button type="submit" disabled={!input.trim()} loading={chatMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
