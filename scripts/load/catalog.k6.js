import http from 'k6/http';
import { check, sleep } from 'k6';

const base = (__ENV.BASE_URL || 'http://host.docker.internal:3010').replace(/\/$/, '');
if (!/^http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal):3010$/.test(base)) {
  throw new Error('This test only targets the isolated local frontend on port 3010.');
}
const smoke = __ENV.SMOKE === '1';
const step = Number(__ENV.STEP_VUS || 0);
if (step && ![10, 25, 50, 100, 250, 500, 1000].includes(step)) {
  throw new Error('STEP_VUS must be 10, 25, 50, 100, 250, 500 or 1000.');
}
export const options = {
  ...(step ? { vus: step, duration: '30s' } : { stages: smoke ? [{ duration: '10s', target: 1 }] : [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 250 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '60s', target: 1000 },
    { duration: '15s', target: 0 },
  ] }),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:catalog}': ['p(95)<1000'],
    'http_req_duration{endpoint:detail}': ['p(95)<1000'],
    'http_req_duration{endpoint:search}': ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function get(path, endpoint) {
  return http.get(`${base}${path}`, {
    timeout: '15s', tags: { name: endpoint, endpoint },
  });
}

export function setup() {
  const response = get('/api/v1/products/?page_size=100', 'preflight');
  if (response.status !== 200) throw new Error(`API unavailable: ${response.status}`);
  const data = response.json();
  if (data.count !== 50) throw new Error(`Expected 50 products, found ${data.count}`);
  const slugs = data.results.map(p => p.slug);
  if (!slugs.length) throw new Error('Empty catalog');
  return { slugs };
}

export default function ({ slugs }) {
  const catalog = get('/api/v1/products/?page=1', 'catalog');
  check(catalog, { 'catalog: 200 and 50 products': r => r.status === 200 && r.json('count') === 50 });
  sleep(1 + Math.random());
  const search = get('/api/v1/products/?search=Port%C3%A1til&ordering=price', 'search');
  check(search, { 'search: 200 and matching products': r => r.status === 200 && r.json('count') === 50 });
  sleep(1 + Math.random());
  const slug = slugs[Math.floor(Math.random() * slugs.length)];
  const detail = get(`/api/v1/products/${slug}/`, 'detail');
  check(detail, { 'detail: 200 and matching slug': r => r.status === 200 && r.json('slug') === slug });
  sleep(2 + Math.random() * 2);
}
