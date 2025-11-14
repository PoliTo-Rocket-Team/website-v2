import { InfoIcon } from "lucide-react";
import { auth } from "@/auth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getFAQsByPage } from "@/app/actions/get-faq";

export default async function ProtectedPage() {
  const session = await auth();
  const faqs = await getFAQsByPage("account");

  return (
    <div className="flex-1 w-full flex flex-col gap-12 mt-10">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated
          user
        </div>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <h2 className="font-bold text-2xl mb-4">Your user details</h2>
          {JSON.stringify(session?.email, null, 2)}
      </div>
      <div className="w-full max-w-5xl mx-auto my-12 md:my-24">
        <h2 className="text-lg md:text-4xl font-bold text-center text-primary mb-4 md:mb-8">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={`item-${faq.id}`}
              className="border-b border-border px-4 md:px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline w-full">
                <span className="text-sm md:text-base font-semibold pr-4">
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
    </div>
  );
}
