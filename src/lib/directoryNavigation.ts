import type { Location, NavigateFunction } from 'react-router-dom';
import type { Service } from '../hooks/useServices';

type DirectoryLocation = Pick<Location, 'pathname' | 'search' | 'state'>;
export interface DirectoryNavigationState {
  directoryOrigin: string;
  directoryPrevious?: string;
}

export function getHomeView(search: string): 'browse' | 'services' {
  const params = new URLSearchParams(search);
  return params.get('view') === 'services' || params.get('tool') === 'search' ? 'services' : 'browse';
}

export function categoryUrl(sectionSlug: string, childSlug?: string): string {
  const path = `/category/${encodeURIComponent(sectionSlug)}`;
  return childSlug ? `${path}?${new URLSearchParams({ sub: childSlug })}` : path;
}

export interface ServiceNavigationState extends DirectoryNavigationState {
  categoryId: Service['categoryId'];
  categorySlug: string;
  serviceCategoryUrl: string;
}

export function openServiceDetails(
  navigate: NavigateFunction, location: DirectoryLocation,
  service: Service, placement?: { sectionSlug: string; childSlug?: string },
): void {
  if (!Number.isSafeInteger(Number(service.id)) || Number(service.id) <= 0) return;
  const parentUrl = categoryUrl(placement?.sectionSlug ?? service.categorySlug, placement?.childSlug);
  const state = directoryEntryState(location);
  // Both navigations run in the same click: only details render. The inserted
  // category entry makes browser/device Back work without intercepting popstate.
  if (`${location.pathname}${location.search}` !== parentUrl) {
    navigate(parentUrl, { state });
  }
  navigate(`/service/${encodeURIComponent(String(service.id))}`, {
    state: {
      ...state, directoryPrevious: parentUrl,
      categoryId: service.categoryId, categorySlug: service.categorySlug,
      serviceCategoryUrl: parentUrl,
    } satisfies ServiceNavigationState,
  });
}

export function readCategoryUrl(url?: string): { slug: string; childSlug?: string } | undefined {
  if (!url?.startsWith('/category/')) return undefined;
  const [path, search = ''] = url.split('?');
  try {
    return { slug: decodeURIComponent(path.slice('/category/'.length)), childSlug: new URLSearchParams(search).get('sub') ?? undefined };
  } catch { return undefined; }
}

function publicDirectoryUrl(value: unknown): value is string {
  return typeof value === 'string' && (/^\/(?:\?[^#]*)?$/.test(value) || /^\/category\/[^/?#]+(?:\?[^#]*)?$/.test(value));
}

export function getDirectoryNavigationState(state: unknown): DirectoryNavigationState {
  const candidate = state as Partial<DirectoryNavigationState> | null;
  return {
    directoryOrigin: publicDirectoryUrl(candidate?.directoryOrigin) && candidate.directoryOrigin.startsWith('/?')
      ? candidate.directoryOrigin : candidate?.directoryOrigin === '/' ? '/' : '/?view=services',
    directoryPrevious: publicDirectoryUrl(candidate?.directoryPrevious) ? candidate.directoryPrevious : undefined,
  };
}

export function directoryEntryState(location: DirectoryLocation): DirectoryNavigationState {
  const currentUrl = `${location.pathname}${location.search}`;
  const inherited = getDirectoryNavigationState(location.state);
  return {
    directoryOrigin: location.pathname === '/' ? currentUrl : inherited.directoryOrigin,
    directoryPrevious: publicDirectoryUrl(currentUrl) ? currentUrl : undefined,
  };
}

/** Use real history when it contains the required parent/source; direct links
 * and direct specialty search get a deterministic parent without a back loop. */
export function directoryBackAction(options: {
  state: unknown; parentUrl: string; isChild: boolean;
  previousIsParent: boolean; hasHistory: boolean;
}): { delta: -1 } | { to: string; state: DirectoryNavigationState; replace: true } {
  const state = getDirectoryNavigationState(options.state);
  if (options.isChild && !options.previousIsParent) return { to: options.parentUrl, state, replace: true };
  if (state.directoryPrevious && options.hasHistory) return { delta: -1 };
  return { to: options.isChild ? options.parentUrl : state.directoryPrevious ?? state.directoryOrigin, state, replace: true };
}
