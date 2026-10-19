/** The website owner: the one VIP Super Admin who approves new staff and is the only one who can add or remove Super Admins. */
export const OWNER_EMAIL = "taaham01@gmail.com";

export const isOwnerEmail = (email: string | null | undefined) => !!email && email.trim().toLowerCase() === OWNER_EMAIL;
