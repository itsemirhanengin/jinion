import { defineRailway, github, project, service } from 'railway/iac';

export default defineRailway(() => {
  const source = github('itsemirhanengin/jinion', { branch: 'main', checkSuites: false });

  const docs = service('docs', {
    source,
    build: 'pnpm --filter @jinion/docs build',
    start: 'pnpm --filter @jinion/docs start',
    healthcheck: '/',
    domains: ['docs.jinion.co'],
    replicas: { ams: 1 },
  });

  const website = service('website', {
    source,
    build: 'pnpm --filter @jinion/website build',
    start: 'pnpm --filter @jinion/website start',
    healthcheck: '/',
    replicas: { ams: 1 },
  });

  return project('jinion', {
    resources: [docs, website],
  });
});
