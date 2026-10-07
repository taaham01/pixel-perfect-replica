import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { PageHero } from "@/components/site/primitives";

const t = `Privacy Policy — ${site.name}`;
const d = `How ${site.name} collects, uses and protects personal information submitted through this website.`;

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <article className="container-x max-w-3xl space-y-6 py-16 leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground">
        <p className="font-mono text-xs">[Placeholder — have this policy reviewed by a legal professional before publishing.]</p>
        <h2>Information we collect</h2>
        <p>When you submit an inquiry, vehicle request or dealer application, we collect the details you provide such as your name, country, email address and WhatsApp number.</p>
        <h2>How we use it</h2>
        <p>We use this information only to respond to your inquiry, prepare quotations and coordinate vehicle exports.</p>
        <h2>Sharing</h2>
        <p>We do not sell your personal information. We may share necessary details with shipping and inspection partners solely to complete your order.</p>
        <h2>Contact</h2>
        <p>For privacy questions, contact {site.contact.email}.</p>
      </article>
    </>
  ),
});
