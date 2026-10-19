/** The primary owner: the most powerful account. Nobody else can remove, deactivate or delete it. */
export const OWNER_EMAIL = "taaham01@gmail.com";

/** Second owners: every owner power, except they can never change or delete the primary owner. */
export const CO_OWNER_EMAILS = ["rashidalhassanmotors@gmail.com"];

const norm = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

export const isPrimaryOwnerEmail = (email: string | null | undefined) => norm(email) === OWNER_EMAIL;

/** True for the primary owner and any second owner (both show as "Owner"). */
export const isOwnerEmail = (email: string | null | undefined) => isPrimaryOwnerEmail(email) || CO_OWNER_EMAILS.includes(norm(email));
