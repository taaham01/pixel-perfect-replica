import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/otp.functions";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { btn } from "./primitives";

const RESEND_SECONDS = 60;

/** Two-step phone check: we text a 6-digit code to the number, the customer types it back, and the number is marked verified. */
export function PhoneVerification({ phone, userId, onVerified }: { phone: string; userId: string; onVerified?: () => void }) {
  const qc = useQueryClient();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const send = useMutation({
    mutationFn: () => sendPhoneOtp({ data: { phone } }),
    onSuccess: () => { setSent(true); setCode(""); setWait(RESEND_SECONDS); toast.success(`We sent a code to ${phone}.`); },
    onError: (e: Error) => toast.error(e.message || "Could not send the code."),
  });

  const verify = useMutation({
    mutationFn: () => verifyPhoneOtp({ data: { code } }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customer-details", userId] }),
        qc.invalidateQueries({ queryKey: ["customer-summary", userId] }),
      ]);
      toast.success("Phone verified. You can now book vehicles.");
      onVerified?.();
    },
    onError: (e: Error) => { setCode(""); toast.error(e.message || "That code didn't work."); },
  });

  return (
    <div className="rounded-sm border border-champagne/50 bg-champagne/10 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-crimson" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">Verify your phone to book vehicles</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {sent ? <>Enter the 6-digit code we sent to <strong className="text-foreground">{phone}</strong>.</> : <>We'll text a one-time code to <strong className="text-foreground">{phone}</strong>.</>}
          </p>

          {sent && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={() => verify.mutate()} disabled={verify.isPending} autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
              <button type="button" onClick={() => verify.mutate()} disabled={code.length !== 6 || verify.isPending} className={btn({ variant: "primary", size: "sm" })}>
                {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Verify
              </button>
            </div>
          )}

          <div className="mt-4">
            <button type="button" onClick={() => send.mutate()} disabled={send.isPending || wait > 0} className={btn({ variant: sent ? "link" : "primary", size: "sm" })}>
              {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {sent ? (wait > 0 ? `Resend code in ${wait}s` : "Resend code") : "Send code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
