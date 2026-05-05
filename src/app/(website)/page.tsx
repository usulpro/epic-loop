import BentoWrapCentered from '@/components/pages/home/bento--wrap-centered';
import CtaColumnCentered from '@/components/pages/home/cta--column-centered';
import FeaturesSplit from '@/components/pages/home/features--split';
import HeroColumn from '@/components/pages/home/hero--column';
import IntegrationsCircles from '@/components/pages/home/integrations--circles';
import SectionSplitMediaLeft from '@/components/pages/home/section-split--media-left';
import SectionSplitMediaRight from '@/components/pages/home/section-split--media-right';
import { Button } from '@/components/ui/button';
import { getMetadata } from '@/lib/get-metadata';
import { AlertCircle, BarChart2, ClipboardList, FileText, Play, Plug } from 'lucide-react';
import { Metadata } from 'next';
import NextLink from 'next/link';

const contentData = {
  'hero--column': {
    actions: (
      <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-6 md:mt-6 md:justify-center lg:flex-nowrap lg:gap-x-4">
        <Button variant="default" asChild>
          <NextLink href={'/placeholder'}>Get started</NextLink>
        </Button>{' '}
        <Button variant="secondary" asChild>
          <NextLink href={'/docs'}>View documentation</NextLink>
        </Button>
      </div>
    ),
    description:
      'A unified QA platform for engineering, product, and QA teams to plan, run, and report on testing, ensuring faster releases and fewer defects.',
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
    title: 'Quality you can ship with confidence.',
  },
  'features--split': {
    description:
      'Our platform unifies your QA efforts, providing the tools you need to deliver quality software faster and with greater assurance.',
    items: [
      {
        description: 'Organize test cases, requirements, and user stories in one central hub.',
        lucideIcon: <ClipboardList />,
        title: 'Plan with precision',
      },
      {
        description: 'Streamline test execution across manual and automated workflows.',
        lucideIcon: <Play />,
        title: 'Execute efficiently',
      },
      {
        description: 'Integrate automated tests to accelerate feedback loops and releases.',
        lucideIcon: <AlertCircle />,
        title: 'Automate for speed',
      },
      {
        description: 'Monitor test cycles, defect rates, and team performance in real-time.',
        lucideIcon: <BarChart2 />,
        title: 'Track progress clearly',
      },
      {
        description: 'Generate comprehensive reports for stakeholders and audit trails.',
        lucideIcon: <FileText />,
        title: 'Report with insight',
      },
      {
        description: 'Connect with your existing development and CI/CD tools.',
        lucideIcon: <Plug />,
        title: 'Integrate seamlessly',
      },
    ],
    label: 'Product overview',
    title: 'Core capabilities for confident releases',
  },
  'section-split--media-right': {
    description:
      'Organize test cases, requirements, and user stories in one intuitive platform. Gain full visibility into your testing scope and ensure alignment across teams.',
    image: {
      alt: '',
      height: 544,
      src: '/images/cover-3.jpg',
      width: 544,
    },
    label: 'Plan',
    title: 'Centralized planning for every release',
  },
  'section-split--media-left': {
    description:
      'Streamline your test execution across manual and automated workflows. Our platform provides intuitive interfaces for running test cycles, managing test data, and capturing results efficiently, ensuring every test counts.',
    image: {
      alt: '',
      height: 544,
      src: '/images/cover-8.jpg',
      width: 544,
    },
    label: 'Run',
    title: 'Execute tests with precision and speed',
  },
  'section-split--media-right-2': {
    description:
      'Monitor test cycles, defect rates, and team performance in real-time. Generate comprehensive, audit-friendly reports for stakeholders, ensuring full visibility and clear accountability.',
    image: {
      alt: '',
      height: 544,
      src: '/images/cover-8.jpg',
      width: 544,
    },
    label: 'Track & Report',
    title: 'Gain clarity with powerful reporting',
  },
  'integrations--circles': {
    actions: (
      <Button className="mt-5 md:mt-6 lg:mt-7" variant="default" asChild>
        <NextLink href={'/docs'}>View all integrations</NextLink>
      </Button>
    ),
    content: "Explore our <a href='/docs'>documentation</a> for a full list of integrations.",
    description:
      'Connect our platform with your existing development and CI/CD tools for a seamless workflow and enhanced productivity.',
    logos: [
      {
        alt: 'Bloom',
        height: 40,
        src: '/images/logos/mini/bloom.svg',
        width: 36,
      },
      {
        alt: 'Layers',
        height: 40,
        src: '/images/logos/mini/layers.svg',
        width: 50,
      },
      {
        alt: 'Burst',
        height: 40,
        src: '/images/logos/mini/burst.svg',
        width: 40,
      },
      {
        alt: 'Arc',
        height: 40,
        src: '/images/logos/mini/arc.svg',
        width: 40,
      },
      {
        alt: 'Loop',
        height: 40,
        src: '/images/logos/mini/loop.svg',
        width: 40,
      },
      {
        alt: 'Axis',
        height: 40,
        src: '/images/logos/mini/axis.svg',
        width: 40,
      },
      {
        alt: 'Nodes',
        height: 40,
        src: '/images/logos/mini/nodes.svg',
        width: 40,
      },
    ],
    title: 'Integrate with your essential tools',
  },
  'bento--wrap-centered': {
    description:
      "Whether you're ready to buy, explore features, or learn more, we have a path for you.",
    items: [
      {
        description: "Find the right plan for your team's needs and scale.",
        image: {
          alt: '',
          height: 640,
          src: '/images/cover-2.jpg',
          width: 640,
        },
        label: 'For Buyers',
        title: 'Transparent pricing',
      },
      {
        description: 'Explore our features, APIs, and integration guides.',
        image: {
          alt: '',
          height: 640,
          src: '/images/cover-3.jpg',
          width: 640,
        },
        label: 'For Evaluators',
        title: 'Comprehensive documentation',
      },
      {
        description: 'Stay updated with product news, best practices, and industry trends.',
        image: {
          alt: '',
          height: 640,
          src: '/images/cover-4.jpg',
          width: 640,
        },
        label: 'For Learners',
        title: 'Latest insights',
      },
      {
        description: 'Discuss tailored plans and dedicated support for large organizations.',
        image: {
          alt: '',
          height: 640,
          src: '/images/cover-5.jpg',
          width: 640,
        },
        label: 'For Enterprises',
        title: 'Custom solutions',
      },
    ],
    label: 'Evaluate our platform',
    title: 'Choose your path to quality',
  },
  'cta--column-centered': {
    actions: (
      <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-6 md:mt-6 md:justify-center lg:flex-nowrap lg:gap-x-4">
        <Button variant="default" asChild>
          <NextLink href={'/placeholder'}>Get started</NextLink>
        </Button>{' '}
        <Button variant="secondary" asChild>
          <NextLink href={'/docs'}>View documentation</NextLink>
        </Button>
      </div>
    ),
    description:
      'Join teams already delivering flawless software. Create your free account and start building better products today.',
    label: 'Ready to start?',
    title: 'Unlock quality you can ship.',
  },
};

const pageData = {
  pathname: '/',
  metadata: {
    title: 'Home',
    description: 'Build your next generation website with ease',
    pathname: '/',
  },
};

export const metadata: Metadata = getMetadata({
  title: pageData.metadata?.title,
  description: pageData.metadata?.description,
  pathname: pageData.pathname,
});

export default function HomePage() {
  return (
    <main className="pb-14 md:pb-16 lg:pb-16 xl:pb-24">
      <HeroColumn {...contentData['hero--column']} />
      <FeaturesSplit {...contentData['features--split']} />
      <SectionSplitMediaRight {...contentData['section-split--media-right']} />
      <SectionSplitMediaLeft {...contentData['section-split--media-left']} />
      <SectionSplitMediaRight {...contentData['section-split--media-right-2']} />
      <IntegrationsCircles {...contentData['integrations--circles']} />
      <BentoWrapCentered {...contentData['bento--wrap-centered']} />
      <CtaColumnCentered {...contentData['cta--column-centered']} />
    </main>
  );
}
