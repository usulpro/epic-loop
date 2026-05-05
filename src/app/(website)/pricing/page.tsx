import ComparisonTable from '@/components/pages/pricing/comparison-table';
import FaqColumn from '@/components/pages/pricing/faq--column';
import HeroPricing from '@/components/pages/pricing/hero--pricing';
import { getMetadata } from '@/lib/get-metadata';
import {
  BarChart,
  Copy,
  FileText,
  Folder,
  Heart,
  Lock,
  MessagesSquare,
  Rocket,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { Metadata } from 'next';

const contentData = {
  'hero--pricing': {
    description:
      "Transparent pricing designed to deliver measurable quality assurance value. Select a plan that matches your project's scale and unlock efficiency gains today.",
    logos: [
      {
        alt: 'Case Status',
        height: 24,
        src: '/images/logos/hex.svg',
        width: 69,
      },
      {
        alt: 'Mark',
        height: 24,
        src: '/images/logos/mark.svg',
        width: 109,
      },
      {
        alt: 'Diamond',
        height: 24,
        src: '/images/logos/diamond.svg',
        width: 99,
      },
      {
        alt: 'Soft',
        height: 24,
        src: '/images/logos/soft.svg',
        width: 101,
      },
      {
        alt: 'Block',
        height: 24,
        src: '/images/logos/block.svg',
        width: 110,
      },
      {
        alt: 'Shield',
        height: 24,
        src: '/images/logos/shield.svg',
        width: 102,
      },
      {
        alt: 'Mono',
        height: 24,
        src: '/images/logos/mono.svg',
        width: 100,
      },
      {
        alt: 'Round',
        height: 24,
        src: '/images/logos/round.svg',
        width: 72,
      },
      {
        alt: 'Wave',
        height: 24,
        src: '/images/logos/wave.svg',
        width: 101,
      },
      {
        alt: 'Cluster',
        height: 24,
        src: '/images/logos/cluster.svg',
        width: 97,
      },
      {
        alt: 'Heavy',
        height: 24,
        src: '/images/logos/heavy.svg',
        width: 98,
      },
    ],
    plans: [
      {
        annualPrice: 90,
        currency: 'USD',
        description: 'Ideal for solo testers and small projects seeking essential QA coverage.',
        features: {
          items: [
            {
              label: 'Basic test case management',
              lucideIcon: <Copy />,
            },
            {
              label: 'Automated test runs up to 100/month',
              lucideIcon: <MessagesSquare />,
            },
            {
              label: 'Email support response within 48h',
              lucideIcon: <Users />,
            },
            {
              label: 'Basic analytics',
              lucideIcon: <BarChart />,
            },
          ],
          title: 'What you get',
        },
        id: 'basic',
        link: {
          href: '/sign-up/basic',
          label: 'Start for free',
        },
        lucideIcon: <Sparkles />,
        monthlyPrice: 9,
        name: 'Basic',
        priceAnnualLabel: '/yr',
        priceMonthlyLabel: '/mo',
        priceType: 'number' as const,
      },
      {
        annualPrice: 290,
        currency: 'USD',
        description: 'For growing teams requiring advanced automation and enhanced reporting.',
        features: {
          items: [
            {
              label: 'Unlimited test cases',
              lucideIcon: <Folder />,
            },
            {
              label: 'Automated test runs up to 1000/month',
              lucideIcon: <MessagesSquare />,
            },
            {
              label: 'Priority email and chat support',
              lucideIcon: <BarChart />,
            },
            {
              label: 'Detailed analytics dashboard',
              lucideIcon: <Users />,
            },
          ],
          title: 'Expanded capabilities',
        },
        id: 'pro',
        isMostPopular: true,
        link: {
          href: '/sign-up/pro',
          label: 'Get started',
        },
        lucideIcon: <Rocket />,
        monthlyPrice: 29,
        name: 'Pro',
        priceAnnualLabel: '/yr',
        priceMonthlyLabel: '/mo',
        priceType: 'number' as const,
      },
      {
        annualPriceDisplay: 'Custom',
        currency: 'USD',
        description:
          'Custom solutions for large organizations with dedicated support and integrations.',
        features: {
          items: [
            {
              label: 'Unlimited test runs and users',
              lucideIcon: <Lock />,
            },
            {
              label: 'Dedicated account manager',
              lucideIcon: <FileText />,
            },
            {
              label: 'Onsite training and onboarding',
              lucideIcon: <FileText />,
            },
            {
              label: 'Advanced security and compliance',
              lucideIcon: <Heart />,
            },
          ],
          title: 'Premium benefits',
        },
        id: 'business',
        link: {
          href: '/contact',
          label: 'Contact sales',
        },
        lucideIcon: <Shield />,
        monthlyPriceDisplay: 'Custom',
        name: 'Enterprise',
        priceType: 'string' as const,
      },
    ],
    title: 'Choose the right QA tuesday plan for your needs',
  },
  'comparison-table': {
    featureCategories: [
      {
        features: [
          {
            name: 'Test cases limit',
            plans: [
              {
                planId: 'basic',
                value: '1',
              },
              {
                planId: 'pro',
                value: 'Unlimited',
              },
              {
                planId: 'business',
                value: 'Unlimited',
              },
            ],
          },
          {
            name: 'Automated test runs/month',
            plans: [
              {
                planId: 'basic',
                value: '1',
              },
              {
                planId: 'pro',
                value: '5',
              },
              {
                planId: 'business',
                value: 'Unlimited',
              },
            ],
          },
          {
            name: 'Email support',
            plans: [
              {
                planId: 'basic',
                value: '1',
              },
              {
                planId: 'pro',
                value: '1',
              },
              {
                planId: 'business',
                value: '1',
              },
            ],
          },
        ],
        name: 'Test Management',
      },
      {
        features: [
          {
            name: 'Support response time',
            plans: [
              {
                planId: 'basic',
                value: '1',
              },
              {
                planId: 'pro',
                value: '1',
              },
              {
                planId: 'business',
                value: '1',
              },
            ],
          },
          {
            name: 'Onboarding assistance',
            plans: [
              {
                planId: 'basic',
                value: '1',
              },
              {
                planId: 'pro',
                value: '1',
              },
              {
                planId: 'business',
                value: '1',
              },
            ],
          },
          {
            name: 'Compliance reports',
            plans: [
              {
                planId: 'basic',
                value: '1',
              },
              {
                planId: 'pro',
                value: '1',
              },
              {
                planId: 'business',
                value: '1',
              },
            ],
          },
        ],
        name: 'Support & SLA',
      },
    ],
    plans: [
      {
        annualPrice: 90,
        currency: 'USD',
        description: 'Ideal for solo testers and small projects seeking essential QA coverage.',
        features: {
          items: [
            {
              label: 'Basic test case management',
              lucideIcon: <Copy />,
            },
            {
              label: 'Automated test runs up to 100/month',
              lucideIcon: <MessagesSquare />,
            },
            {
              label: 'Email support response within 48h',
              lucideIcon: <Users />,
            },
            {
              label: 'Basic analytics',
              lucideIcon: <BarChart />,
            },
          ],
          title: 'Basic Plan Features',
        },
        id: 'basic',
        link: {
          href: '/sign-up/basic',
          label: 'Start for free',
        },
        lucideIcon: <Sparkles />,
        monthlyPrice: 9,
        name: 'Basic',
        priceAnnualLabel: '/yr',
        priceMonthlyLabel: '/mo',
        priceType: 'number' as const,
      },
      {
        annualPrice: 290,
        currency: 'USD',
        description: 'For growing teams requiring advanced automation and enhanced reporting.',
        features: {
          items: [
            {
              label: 'Unlimited test cases',
              lucideIcon: <Folder />,
            },
            {
              label: 'Automated test runs up to 1000/month',
              lucideIcon: <MessagesSquare />,
            },
            {
              label: 'Priority email and chat support',
              lucideIcon: <BarChart />,
            },
            {
              label: 'Detailed analytics dashboard',
              lucideIcon: <Users />,
            },
          ],
          title: 'Pro Plan Features',
        },
        id: 'pro',
        isMostPopular: true,
        link: {
          href: '/sign-up/pro',
          label: 'Get started',
        },
        lucideIcon: <Rocket />,
        monthlyPrice: 29,
        name: 'Pro',
        priceAnnualLabel: '/yr',
        priceMonthlyLabel: '/mo',
        priceType: 'number' as const,
      },
      {
        annualPriceDisplay: 'Custom',
        currency: 'USD',
        description:
          'Custom solutions for large organizations with dedicated support and integrations.',
        features: {
          items: [
            {
              label: 'Unlimited test runs and users',
              lucideIcon: <Lock />,
            },
            {
              label: 'Dedicated account manager',
              lucideIcon: <FileText />,
            },
            {
              label: 'Onsite training and onboarding',
              lucideIcon: <FileText />,
            },
            {
              label: 'Advanced security and compliance',
              lucideIcon: <Heart />,
            },
          ],
          title: 'Enterprise Plan Features',
        },
        id: 'business',
        link: {
          href: '/contact',
          label: 'Contact sales',
        },
        lucideIcon: <Shield />,
        monthlyPriceDisplay: 'Custom',
        name: 'Enterprise',
        priceType: 'string' as const,
      },
    ],
  },
  'faq--column': {
    items: [
      {
        answer:
          'Connect cloud warehouses, spreadsheets, and API sources with role-based access for every workspace.',
        question: 'What data sources can be connected?',
      },
      {
        answer:
          'Permissions are centralized and scoped by role so each team sees only what they are meant to use.',
        question: 'How is access managed across teams?',
      },
      {
        answer:
          'Every action is tracked with time-stamped logs to keep reviews, audits, and compliance checks reliable.',
        question: 'Do you support audit trails and logs?',
      },
      {
        answer:
          'Teams can tailor views, filters, and saved reports without affecting other departments or shared baselines.',
        question: 'Can dashboards be customized per group?',
      },
      {
        answer:
          'Most teams are live within a week with guided setup, data validation, and hands-on training.',
        question: 'What does onboarding look like?',
      },
    ],
    title: 'Need help? <strong>Find what you need.</strong>',
  },
};

const pageData = {
  pathname: '/pricing',
  metadata: {
    title: 'Pricing | QA tuesday',
    description: 'Upgrade for premium support and advanced features.',
    pathname: '/pricing',
  },
};

export const metadata: Metadata = getMetadata({
  title: pageData.metadata?.title,
  description: pageData.metadata?.description,
  pathname: pageData.pathname,
});

export default function PricingPage() {
  return (
    <main className="pb-12 md:pb-14 lg:pb-16 xl:pb-24">
      <HeroPricing {...contentData['hero--pricing']} />
      <ComparisonTable {...contentData['comparison-table']} />
      <FaqColumn {...contentData['faq--column']} />
    </main>
  );
}
