"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { type FAQ } from "@/app/actions/types";

export function FAQ({ faqs, className }: { faqs: FAQ[]; className?: string }) {
  return (
    <div
      className={`w-full max-w-4xl mx-auto my-8 md:my-16 ${className || ""}`}
    >
      <h2 className="text-lg md:text-4xl font-bold text-center text-primary mb-4 md:mb-8">
        Frequently Asked Questions
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map(faq => (
          <AccordionItem
            key={faq.id}
            value={`item-${faq.id}`}
            className="border-b border-border px-4 md:px-6"
          >
            <AccordionTrigger className="text-left hover:no-underline">
              <span className="text-sm md:text-base font-semibold">
                {faq.question}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
