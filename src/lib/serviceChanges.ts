import type { Service } from '../hooks/useServices';

export type ServiceChange = { kind: 'created' } | { kind: 'updated'; service: Service } | { kind: 'deleted'; id: string | number };
// A notification to re-query, or a row returned by a successful server mutation.
// This event never authorizes access: admin lists still live beneath AdminRoute.
export function notifyServiceChange(change: ServiceChange) {
  window.dispatchEvent(new CustomEvent<ServiceChange>('services:committed', { detail: change }));
}
