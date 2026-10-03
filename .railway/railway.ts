import { defineRailway, github, project, service } from 'railway/iac';

export default defineRailway(() => {
  const docs = service('docs', {
    source: github('itsemirhanengin/jinion', { branch: 'main', checkSuites: false }),
    build: 'pnpm --filter @jinion/docs build',
    start: 'pnpm --filter @jinion/docs start',
    healthcheck: '/',
    domains: ['docs.jinion.co'],
    replicas: { ams: 1 },
  });

  return project('jinion', {
    resources: [docs],
  });
});
