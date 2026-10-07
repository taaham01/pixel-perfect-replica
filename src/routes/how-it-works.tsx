import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { PageHero, SectionHeader } from "@/components/site/primitives";
import { CTASection, ProcessSteps } from "@/components/site/sections";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const t = `How Japanese Car Export Works — ${site.name}`;
const d = "Our four-step export process: choose a vehicle, receive a quote, complete your purchase and we ship it to your port.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: HowPage,
});

const faqs = [
  ["What is the difference between FOB and CIF?", "FOB covers the vehicle delivered onto the vessel in Japan. CIF also includes ocean freight and insurance to your destination port. We can quote either."],
  ["How long does shipping take?", "Transit time depends on your destination and vessel schedules. Your quotation will include an estimated timeline."],
  ["Which documents will I receive?", "Typically an export certificate, bill of lading and commercial invoice. Requirements vary by country and our team will advise."],
  ["Can you arrange pre-export inspection?", "Yes, where required by the destination country, inspection can be arranged before shipment."],
  ["How do I pay?", "Payment instructions are provided with your confirmed invoice. Our team will walk you through each step."],
] as const;

function HowPage() {
  return (
    <>
      <PageHero eyebrow="Export process" title="How It Works" subtitle="A clear, guided process from selecting your vehicle in Japan to receiving it at your port." />
      <section className="container-x py-20 md:py-28"><ProcessSteps /></section>
      <section className="container-x grid gap-12 pb-24 lg:grid-cols-12">
        <div className="lg:col-span-4"><SectionHeader eyebrow="FAQ" title="Common questions" /></div>
        <Accordion type="single" collapsible className="lg:col-span-8">
          {faqs.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-left text-base font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <CTASection />
    </>
  );
}
