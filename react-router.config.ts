import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'src',
  ssr: false,
  basename: '/ludo/',
  prerender: ['/', '/how-to-play', '/setup', '/404'],
} satisfies Config;