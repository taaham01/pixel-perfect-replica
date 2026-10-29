import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "@/lib/notify";
import { askQuestion, myQuestions } from "@/lib/inquiries";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";
import { fieldCls } from "./vehicles";

/** Customer portal: ask the team a question and read their replies. Questions land in admin Inquiries. */
export function AskQuestion({ name, email, phone, country }: { name: string; email: string; phone?: string; country?: string }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const list = useQuery({ queryKey: ["my-questions"], queryFn: myQuestions });

  const send = useMutation({
    mutationFn: () => askQuestion({ name, email, phone, country, subject, message }),
    onSuccess: async () => {
      setSubject(""); setMessage("");
      toast.success("Question sent. Our team will reply here and may contact you directly.");
      await qc.invalidateQueries({ queryKey: ["my-questions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) { toast.error("Please write your question."); return; }
    send.mutate();
  }

  return (
    <div>
      <h2 id="questions" className="scroll-mt-28 text-xl font-bold">Ask us a question</h2>
      <p className="mt-1 text-sm text-muted-foreground">About a car, shipping, payment or anything else. Our team's answer appears here.</p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-sm border border-border bg-card p-4">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Subject (optional)" className={fieldCls} />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={4} required placeholder="Write your question…" className={cn(fieldCls, "h-auto py-3")} />
        <div><button disabled={send.isPending} className={btn({ variant: "primary", size: "sm" })}>{send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send question</button></div>
      </form>

      {!!list.data?.length && (
        <div className="mt-4 grid gap-3">
          {list.data.map((q) => {
            const answered = !!q.reply;
            return (
              <article key={q.id} className="rounded-sm border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{q.subject || (q.kind === "question" ? "Question" : "Message")}</p>
                  <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    answered ? "bg-emerald-600/15 text-emerald-800" : q.status === "closed" ? "bg-secondary text-muted-foreground" : "bg-champagne/25 text-foreground")}>
                    {answered ? <><CheckCircle2 className="h-3 w-3" /> Answered</> : q.status === "closed" ? "Closed" : <><Clock className="h-3 w-3" /> Waiting for reply</>}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Sent {new Date(q.created_at).toLocaleString()}</p>
                {q.message && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{q.message}</p>}
                {q.reply && (
                  <div className="mt-3 rounded-sm border-l-2 border-crimson bg-secondary/50 p-3 text-sm">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-crimson"><MessageSquare className="h-3.5 w-3.5" /> Reply from our team{q.replied_at ? ` · ${new Date(q.replied_at).toLocaleString()}` : ""}</p>
                    <p className="whitespace-pre-line">{q.reply}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
