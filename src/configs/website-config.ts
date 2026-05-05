const config = {
  projectName: 'QA tuesday',
  logo: {
    light: '/logo.svg',
    dark: '/logo.svg',
  },
  logoAlt: 'QA tuesday',
  logoLink: '/',
  metaThemeColors: {
    light: '#070b13',
    dark: '#070b13',
  },
  githubOrg: 'pixel-point',
  githubRepo: 'prime',
  blog: {
    contentDir: 'src/content/blog',
    postsPerPage: 20,
    contentWidth: 704,
    basePath: '/blog',
  },
  docs: {
    basePath: '/docs',
    rootPage: '/docs/introduction',
    contentDir: 'src/content/docs',
    contentWidth: 704,
  },
  changelog: {
    contentDir: 'src/content/changelog',
    postsPerPage: 20,
  },
  legal: {
    contentDir: 'src/content/',
  },
};

export default config;
