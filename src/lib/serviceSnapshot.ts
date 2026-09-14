import type { Service } from '../types/models';

/** Partial pages enrich the current view; only a complete read removes old rows. */
export function mergeServiceSnapshot(previous: Service[], incoming: Service[], complete = false): Service[] {
  const previousById = new Map(previous.filter(service => service.id != null).map(service => [String(service.id), service]));
  const previousBySlug = new Map(previous.map(service => [service.slug, service]));
  const bySlug = new Map<string, Service>();
  for (const service of incoming) {
    const old = (service.id == null ? undefined : previousById.get(String(service.id))) ?? previousBySlug.get(service.slug);
    const withCachedMedia: Service = old ? {
      ...service,
      image: service.image || old.image,
      images: service.images?.length ? service.images : old.images,
      video: service.video || old.video,
    } : service;
    const existing = bySlug.get(service.slug);
    if (!existing || existing.status !== 'approved' || service.status === 'approved') bySlug.set(service.slug, withCachedMedia);
  }
  const next = [...bySlug.values()];
  if (!complete) {
    const ids = new Set(next.filter(s => s.id != null).map(s => String(s.id)));
    next.push(...previous.filter(s => !bySlug.has(s.slug) && (s.id == null || !ids.has(String(s.id)))));
  }
  return next;
}
