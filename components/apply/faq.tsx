"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Minus, Plus } from "lucide-react";
import { applyPage, faqs, RECRUITMENT_EMAIL } from "@/lib/apply/page";

// Board 34's questions: the title and the contact line on the left, from lg;
// the questions on the right, each over a hairline, with a plus that turns to
// a minus when open. Every answer starts closed, as every accordion on /apply
// does (issue #157); the board draws one open only to show the open look. Phones
// (34m) stack the two. It is the repo's Radix accordion, one answer open at a
// time, opening and closing at once.
export function Faq() {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto grid max-w-[1312px] gap-6 lg:grid-cols-[296px_1fr] lg:gap-[60px]">
        <div>
          <h2 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
            {applyPage.faqTitle}
          </h2>
          <p className="mt-3 text-[15px] leading-[1.7] text-text-2 md:mt-4">
            Still unsure? Write to us at{" "}
            <a href={`mailto:${RECRUITMENT_EMAIL}`} className="transition-colors duration-300 ease-out hover:text-accent">
              {RECRUITMENT_EMAIL}
            </a>{" "}
            or on our socials.
          </p>
        </div>
        <AccordionPrimitive.Root type="single" collapsible className="lg:pt-3">
          {faqs.map((faq) => (
            <AccordionPrimitive.Item key={faq.question} value={faq.question} className="border-b border-white-5">
              <AccordionPrimitive.Header asChild>
                <h3>
                  <AccordionPrimitive.Trigger className="group/faq flex w-full items-center justify-between gap-6 py-4 text-left text-[15px] font-semibold leading-snug transition-colors duration-300 ease-out hover:text-accent md:py-5 md:text-[18px]">
                    {faq.question}
                    <Plus aria-hidden className="h-4 w-4 shrink-0 text-text-2 group-data-[state=open]/faq:hidden md:h-[18px] md:w-[18px]" />
                    <Minus aria-hidden className="hidden h-4 w-4 shrink-0 text-text-2 group-data-[state=open]/faq:block md:h-[18px] md:w-[18px]" />
                  </AccordionPrimitive.Trigger>
                </h3>
              </AccordionPrimitive.Header>
              {/* No display class on Content itself: it would beat the hidden attribute Radix sets on a closed answer. */}
              <AccordionPrimitive.Content className="-mt-1 pb-6 text-[14px] leading-[1.7] text-text-2 md:text-[15px]">
                <div className="flex flex-col gap-3">
                  {faq.answer.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>
      </div>
    </section>
  );
}
