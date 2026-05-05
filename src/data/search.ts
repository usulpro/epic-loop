export const searchItems = [
  {
    id: 1,
    title:
      'Get Started with Prime Get Started with Prime Get Started with Prime Get Started with Prime Get Started with Prime Get Started with Prime',
    description:
      'Learn how to quickly set up and start using Prime in your projects Learn how to quickly set up and start using Prime in your projects',
    icon: 'book-open',
    category: 'guide',
    url: '/docs/getting-started',
  },
  {
    id: 2,
    title: 'Prime REST API',
    description: 'Detailed documentation of the Prime REST API endpoints and usage',
    icon: 'file-text',
    category: 'api',
    url: '/docs/api/rest',
  },
  {
    id: 3,
    title: 'Authentication with Prime',
    description: 'Secure your application with Prime authentication solutions',
    icon: 'file-text',
    category: 'documentation',
    url: '/docs/auth',
  },
  {
    id: 4,
    title: 'Prime CLI',
    description: 'Command-line interface for Prime workflows and operations',
    icon: 'file-text',
    category: 'documentation',
    url: '/docs/cli',
  },
  {
    id: 5,
    title: 'Environment Variables',
    description: 'Configure your Prime application using environment variables',
    icon: 'book-open',
    category: 'documentation',
    url: '/docs/env-vars',
  },
  {
    id: 6,
    title: 'Functions',
    description: 'Create and deploy serverless functions with Prime',
    icon: 'book-open',
    category: 'api',
    url: '/docs/functions',
  },
  {
    id: 7,
    title: 'Fluid Compute',
    description: 'Scale your compute resources automatically with workload',
    icon: 'book-open',
    category: 'documentation',
    url: '/docs/compute',
  },
  {
    id: 8,
    title: 'Authentication Components',
    description: 'Ready-to-use UI components for authentication flows',
    icon: 'book-open',
    category: 'component',
    url: '/docs/components/auth',
  },
  {
    id: 9,
    title: 'Building Your First Prime App',
    description: 'Step-by-step tutorial for building a complete application',
    icon: 'book-open',
    category: 'tutorial',
    url: '/tutorials/first-app',
  },
];

export const recentSearches = [
  {
    ...searchItems[0],
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

export const suggestions = searchItems.slice(0, 7).map((item) => ({
  ...item,
  description: undefined,
}));
