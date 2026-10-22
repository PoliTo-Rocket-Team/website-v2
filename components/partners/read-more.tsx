"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// Phones have no hover (board 31m): "Read more" opens the partner's own text
// in the card, above the row that holds it and the website link. It is the
// repo's Radix accordion, one per card, so the button reports its state and
// controls the text. It opens and closes at once, with no animation.
export function ReadMore({ story, link }: { story: ReactNode; link: ReactNode }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible>
      <AccordionPrimitive.Item value="story">
        <AccordionPrimitive.Content className="pt-3">{story}</AccordionPrimitive.Content>
        <div className="mt-4 flex items-center justify-between gap-4">
          <AccordionPrimitive.Header asChild>
            <div>
              <AccordionPrimitive.Trigger className="group/read inline-flex items-center gap-2 text-[14px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text">
                Read more
                <ChevronDown aria-hidden className="h-4 w-4 transition-transform duration-300 ease-out group-data-[state=open]/read:rotate-180 motion-reduce:transition-none" />
              </AccordionPrimitive.Trigger>
            </div>
          </AccordionPrimitive.Header>
          {link}
        </div>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
