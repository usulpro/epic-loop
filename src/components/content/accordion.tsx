import { Children, cloneElement, isValidElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  AccordionContent as AccordionContentUI,
  AccordionItem as AccordionItemUI,
  AccordionTrigger as AccordionTriggerUI,
  Accordion as AccordionUI,
} from '@/components/ui/accordion';

interface AccordionProps {
  children: ReactNode;
  className?: string;
  defaultValue?: string;
}

interface AccordionItemProps {
  label: string;
  value: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AccordionItem({ label, value, icon, children, className }: AccordionItemProps) {
  return (
    <AccordionItemUI className={cn(className)} value={value}>
      <AccordionTriggerUI className="not-prose group flex items-center justify-start gap-x-3 rounded-2xl p-4 leading-normal text-foreground ring-inset hover:text-foreground/80 hover:no-underline focus-visible:ring-offset-8 focus-visible:duration-0 data-[state=open]:text-foreground data-[state=open]:hover:text-foreground [&>svg]:hidden">
        <div className="transform-origin-center text-sm transition-transform duration-150 group-data-[state=open]:rotate-90 before:text-xs before:content-['▶']" />
        {icon}
        <span className="text-base font-medium tracking-tight md:text-lg md:leading-normal">
          {label}
        </span>
      </AccordionTriggerUI>
      <AccordionContentUI className="prose-inside-content pt-2 pr-4 pb-4 pl-9">
        {children}
      </AccordionContentUI>
    </AccordionItemUI>
  );
}

export function Accordion({ children, defaultValue, className }: AccordionProps) {
  const count = Children.count(children);
  const renderedChildren = Children.map(children, (child, index) => {
    if (isValidElement<AccordionItemProps>(child)) {
      return cloneElement(child, {
        className: cn(child.props.className, index === count - 1 && 'border-none'),
        value: child.props.value ?? `item-${index + 1}`,
      });
    }
    return child;
  });

  return (
    <AccordionUI
      className={cn(
        'accordion mt-5 mb-8 w-full overflow-hidden rounded-lg border border-border',
        className,
      )}
      type="single"
      collapsible
      defaultValue={defaultValue}
    >
      {renderedChildren}
    </AccordionUI>
  );
}
