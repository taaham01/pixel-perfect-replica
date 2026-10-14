import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ProfileInput = { fullName: string; country: string; phone: string };

/** Saves the signed-in customer's name, country and phone, then refreshes everything that shows them. */
export function useSaveProfile(userId: string, onSaved?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ProfileInput) => {
      const row = { full_name: v.fullName, country: v.country, phone: v.phone };
      const { data: existing, error: readErr } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (readErr) throw readErr;
      const { error } = existing
        ? await supabase.from("profiles").update(row).eq("id", userId)
        : await supabase.from("profiles").insert({ id: userId, ...row });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customer-details", userId] }),
        qc.invalidateQueries({ queryKey: ["customer-summary", userId] }),
      ]);
      toast.success("Your details have been saved.");
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save your details."),
  });
}
