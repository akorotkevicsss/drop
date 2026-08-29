export type CachedDropAuthor = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CachedJoinStatus =
  | 'none'
  | 'pending'
  | 'accepted'
  | 'declined';

export type CachedDropSnapshot = {
  drop: Record<string, unknown>;
  author: CachedDropAuthor | null;
  likeCount?: number;
  liked?: boolean;
  joinStatus?: CachedJoinStatus;
  participantCount?: number;
  cachedAt: number;
};

const dropCache = new Map<string, CachedDropSnapshot>();

export function getCachedDropSnapshot(
  dropId: string | null | undefined
) {
  if (!dropId) {
    return null;
  }

  return dropCache.get(dropId) ?? null;
}

export function primeDropSnapshot(
  dropId: string,
  snapshot: Omit<CachedDropSnapshot, 'cachedAt'>
) {
  const previous = dropCache.get(dropId);

  dropCache.set(dropId, {
    drop: {
      ...(previous?.drop ?? {}),
      ...snapshot.drop,
    },
    author:
      snapshot.author ??
      previous?.author ??
      null,
    likeCount:
      snapshot.likeCount ??
      previous?.likeCount,
    liked:
      snapshot.liked ??
      previous?.liked,
    joinStatus:
      snapshot.joinStatus ??
      previous?.joinStatus,
    participantCount:
      snapshot.participantCount ??
      previous?.participantCount,
    cachedAt: Date.now(),
  });
}

export function patchDropSnapshot(
  dropId: string,
  patch: Partial<Omit<CachedDropSnapshot, 'cachedAt'>>
) {
  const previous = dropCache.get(dropId);

  if (!previous) {
    return;
  }

  dropCache.set(dropId, {
    ...previous,
    ...patch,
    drop: patch.drop
      ? {
          ...previous.drop,
          ...patch.drop,
        }
      : previous.drop,
    cachedAt: Date.now(),
  });
}
