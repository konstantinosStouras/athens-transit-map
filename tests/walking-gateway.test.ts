import { describe, expect, it, vi } from 'vitest';
import { billingPeriod, handle, RESERVE_SQL, type Env } from '../walking-gateway/worker';
const now = new Date('2026-10-28T12:00:00Z');
function setup() {
  const first = vi.fn().mockResolvedValue({used:1});
  const statement = {bind:vi.fn(),first}; statement.bind.mockReturnValue(statement);
  const env: Env = {DB:{prepare:vi.fn().mockReturnValue(statement)},GOOGLE_ROUTES_KEY:'test-secret',WALKING_ENABLED:'true',ALLOWANCE_MONTH:'2026-10',MONTHLY_LIMIT:'9000'};
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({routes:[{distanceMeters:250,duration:'210s',polyline:{geoJsonLinestring:{type:'LineString',coordinates:[[23.7,38],[23.7,38.001]]}}}]})));
  return {env,first,statement,fetcher};
}
const request = (body: unknown = {from:[38,23.7],to:[38.001,23.7]}) => new Request('https://walking.example/walk',{method:'POST',headers:{Origin:'https://www.stouras.com','Content-Type':'application/json'},body:JSON.stringify(body)});
describe('walking gateway billing guards', () => {
  it('reserves durably before one Essentials WALK call and returns no key', async () => {
    const {env,first,fetcher,statement}=setup();
    const response=await handle(request(),env,fetcher,now);
    expect(response.status).toBe(200);
    expect(statement.bind).toHaveBeenCalledWith('2026-10','2026-10-28',9000);
    expect(first.mock.invocationCallOrder[0]).toBeLessThan(fetcher.mock.invocationCallOrder[0]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const options=fetcher.mock.calls[0][1];
    expect(JSON.parse(options.body)).toMatchObject({travelMode:'WALK',computeAlternativeRoutes:false});
    expect(options.headers['X-Goog-FieldMask']).not.toMatch(/steps|description|traffic/);
    expect(await response.text()).not.toContain('test-secret');
  });
  it('makes zero calls when quota is exhausted or durable counting fails', async () => {
    for (const fail of [false,true]) {
      const {env,first,fetcher}=setup();
      if(fail) first.mockRejectedValue(new Error('D1 unavailable')); else first.mockResolvedValue(null);
      expect((await handle(request(),env,fetcher,now)).status).toBe(fail?503:429);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it('fails closed for disabled, unreviewed month, missing key, or excessive allocation', async () => {
    for(const patch of [{WALKING_ENABLED:'false'},{ALLOWANCE_MONTH:'2026-09'},{GOOGLE_ROUTES_KEY:''},{MONTHLY_LIMIT:'10000'},{MONTHLY_LIMIT:'0'}]){
      const {env,fetcher,first}=setup();Object.assign(env,patch);
      expect((await handle(request(),env,fetcher,now)).status).toBe(503);
      expect(first).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it('rejects invalid coordinates, overlong walks, extra modes and bad origins before counting', async () => {
    const {env,fetcher,first}=setup();
    for(const body of [{from:[0,0],to:[38,23.7]},{from:[38,23.7],to:[38.4,23.7]}, {}, {from:['38',23.7],to:[38,23.7]}]) expect((await handle(request(body),env,fetcher,now)).status).toBe(400);
    expect((await handle(new Request('https://walking.example/walk'),env,fetcher,now)).status).toBe(403);
    expect(first).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  });
  it('counts failed upstream attempts and never retries them', async () => {
    const {env,first,fetcher}=setup();fetcher.mockResolvedValue(new Response('{}',{status:500}));
    expect((await handle(request(),env,fetcher,now)).status).toBe(503);
    expect(first).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('aligns month and day with Google billing in Pacific time, including DST', () => {
    expect(billingPeriod(new Date('2026-11-01T06:59:59Z'))).toEqual({month:'2026-10',day:'2026-10-31'});
    expect(billingPeriod(new Date('2026-11-01T07:00:00Z')).month).toBe('2026-11');
    expect(billingPeriod(new Date('2026-12-01T07:59:59Z')).month).toBe('2026-11');
  });
});
