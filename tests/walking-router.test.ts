import { describe, expect, it, vi } from 'vitest';
import { parseWalkRoute, routeWalking } from '../src/lib/walking-router';
import type { WalkingLeg } from '../src/lib/walking';
const route = { provider: 'google', metres: 250, seconds: 210, geometry: { type: 'LineString', coordinates: [[23.7,38],[23.701,38],[23.7,38.001]] } };
const leg: WalkingLeg = { from: [38,23.7], to: [38.001,23.7], name: 'Stop', kind: 'board' };
describe('street walking client', () => {
  it('rejects malformed responses instead of inventing a distance', () => {
    expect(parseWalkRoute(route)).toEqual(route);
    for (const value of [null, {}, {...route, metres: NaN}, {...route, seconds:-1}, {...route, geometry:{type:'LineString',coordinates:[[999,38],[23,38]]}}]) expect(parseWalkRoute(value)).toBeNull();
  });
  it('makes one request per nonzero uncached leg and sends only endpoints', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(route)));
    const result = await routeWalking([leg, {...leg, to:leg.from}], 'https://walking.example/walk', new AbortController().signal, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({from:leg.from,to:leg.to});
    expect(result[0].route).toEqual(route);
  });
  it('stops the entire calculation on quota exhaustion with no retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}',{status:429}));
    await expect(routeWalking([leg,leg], 'https://walking.example/walk', new AbortController().signal, fetcher)).rejects.toThrow('limit');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not fetch after cancellation or for an already calculated leg', async () => {
    const fetcher = vi.fn(); const controller = new AbortController(); controller.abort();
    await expect(routeWalking([leg], 'https://walking.example/walk', controller.signal, fetcher)).rejects.toThrow();
    await routeWalking([{...leg,route:parseWalkRoute(route)!}], 'https://walking.example/walk', new AbortController().signal, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
