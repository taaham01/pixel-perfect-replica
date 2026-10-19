import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { site } from "@/config/site";
import { PageHero } from "@/components/site/primitives";
import { AccountSettings, SETTINGS_TABS, type SettingsTab } from "@/components/site/AccountSettings";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (s: Record<string, unknown>): { tab: SettingsTab; from?: "admin" } => ({
    tab: (SETTINGS_TABS as readonly string[]).includes(s.tab as string) ? (s.tab as SettingsTab) : "profile",
    // Opened from the admin sidebar: the only place the Admin panel section is shown.
    from: s.from === "admin" ? "admin" : undefined,
  }),
  head: () => ({ meta: [{ title: `Settings — ${site.name}` }, { name: "robots", content: "noindex" }] }),
  component: Settings,
});

function Settings() {
  const { user, roles } = Route.useRouteContext();
  const { tab, from } = Route.useSearch();
  const navigate = useNavigate({ from: "/settings" });

  return (
    <>
      <PageHero eyebrow="Settings" title="Account settings" subtitle="Manage your profile, security, preferences and privacy in one place." />
      <section className="container-x py-10 md:py-14">
        <AccountSettings userId={user.id} email={user.email} isStaff={roles.length > 0} showAdmin={from === "admin"} tab={tab} onTabChange={(id) => navigate({ search: { tab: id, from } })} />
      </section>
    </>
  );
}
