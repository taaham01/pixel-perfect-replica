import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "@/config/staff";

export type AccountType = "owner" | "super_admin" | "admin" | "customer";
export const accountTypeLabel: Record<AccountType, string> = { owner: "Owner", super_admin: "Super Admin", admin: "Admin", customer: "Customer" };

export type CustomerSummary = { customerNumber: string; fullName: string; country: string } | null;

/** The signed-in user (if any) plus their customer profile, kept in step with sign in / sign out. */
export function useCustomer() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["customer-summary", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<CustomerSummary> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("customer_number, full_name, country")
        .eq("id", user.id)
        .maybeSingle();
      if (error || !data) return null;
      return { customerNumber: data.customer_number, fullName: data.full_name ?? "", country: data.country ?? "" };
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });
  // Who is signed in: Owner, Super Admin, Admin (any other staff role) or Customer.
  const accountType: AccountType | null = !roles ? null
    : roles.includes("super_admin") ? (isOwnerEmail(user?.email) ? "owner" : "super_admin")
    : roles.length > 0 ? "admin" : "customer";

  const email = user?.email ?? "";
  // Name shown in the navbar: the saved profile name, else the name typed at signup, else the email's username.
  const rawMeta: unknown = user?.user_metadata?.["full_name"];
  const signupName = typeof rawMeta === "string" ? rawMeta.trim() : "";
  const displayName = profile?.fullName || (signupName || (email ? email.split("@")[0] ?? email : ""));
  return { user, ready, profile: profile ?? null, email, displayName, accountType };
}
