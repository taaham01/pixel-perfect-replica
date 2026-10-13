import { supabase } from "@/integrations/supabase/client";

export type CustomerDetails = {
  customerNumber: string;
  fullName: string;
  country: string;
  phone: string;
  phoneVerified: boolean;
} | null;

/** The signed-in customer's own profile. Phone numbers can't be selected directly, so the phone comes from get_customer_phones (which only ever returns your own to a customer). */
export async function fetchCustomerDetails(userId: string): Promise<CustomerDetails> {
  const { data: p, error } = await supabase
    .from("profiles")
    .select("customer_number, full_name, country, phone_verified")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const { data: phones } = await supabase.rpc("get_customer_phones", { _user_ids: [userId] });
  return {
    customerNumber: p.customer_number,
    fullName: p.full_name ?? "",
    country: p.country ?? "",
    phone: phones?.[0]?.phone ?? "",
    phoneVerified: p.phone_verified,
  };
}
