import { supabase } from "@/integrations/supabase/client";

export async function logAudit(args: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    action: args.action,
    entity_type: args.entity_type ?? null,
    entity_id: args.entity_id ?? null,
    details: (args.details ?? {}) as never,
    user_id: u.user?.id ?? null,
  });
}
