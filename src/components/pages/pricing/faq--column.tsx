import { IFaqSection } from '@/types/landing';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface IFaqProps extends IFaqSection {
  className?: string;
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path
        d="M12 5v14"
        className="origin-center transition-transform duration-200 group-data-[state=open]:-rotate-90"
      />
    </svg>
  );
}

function Faq({ className, items, title }: IFaqProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className={cn('faq py-12 md:py-14 lg:py-16 xl:py-24', className)}>
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <h2
          className="max-w-2xl font-heading text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl md:leading-tight lg:text-4xl lg:leading-tight [&_strong]:block [&_strong]:font-semibold [&_strong]:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: title }}
        />

        <Accordion
          className="mt-7 flex grow flex-col border-t border-border lg:mt-11"
          type="single"
          collapsible
        >
          {items.map(({ question, answer }, index) => (
            <AccordionItem className="group last:border-b" key={index} value={`item-${index}`}>
              <AccordionTrigger className="w-full gap-6 py-3.5 text-left hover:text-foreground/80 hover:no-underline md:py-6 [&>svg]:hidden">
                <span className="flex-1 text-lg leading-tight font-medium tracking-tight text-pretty lg:text-xl lg:leading-tight">
                  {question}
                </span>
                <span className="relative flex size-5 shrink-0 items-center justify-center md:size-6">
                  <PlusIcon className="size-5 stroke-[1.5] md:size-6" />
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3.5 md:pb-6">
                {typeof answer === 'string' ? (
                  <div className="flex max-w-3xl flex-col gap-y-5 pr-11 text-base leading-normal tracking-tight text-muted-foreground md:pr-24">
                    {answer}
                  </div>
                ) : (
                  <div className="flex max-w-3xl flex-col gap-y-5 pr-11 text-base leading-normal tracking-tight text-muted-foreground md:pr-24">
                    {answer}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export default Faq;
