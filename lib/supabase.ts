import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
  );
}

type CachedFetchResponse = {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  expiresAt: number;
};

const GET_CACHE_TTL_MS = 20_000;
const responseCache = new Map<string, CachedFetchResponse>();
const inFlightGets = new Map<string, Promise<CachedFetchResponse>>();

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input;
  }

  if (typeof URL !== 'undefined' && input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    init?.headers ??
      (typeof Request !== 'undefined' && input instanceof Request
        ? input.headers
        : undefined)
  );

  // Authorization changes when the user/session changes, so it is part of the key.
  return `${headers.get('authorization') ?? ''}|${headers.get('accept-profile') ?? ''}`;
}

function makeCacheKey(input: RequestInfo | URL, init?: RequestInit) {
  return `${requestUrl(input)}|${requestHeaders(input, init)}`;
}

function responseFromCache(cached: CachedFetchResponse) {
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers: cached.headers,
  });
}

export function clearSupabaseReadCache() {
  responseCache.clear();
  inFlightGets.clear();
}

async function cachedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = requestMethod(input, init);

  if (method !== 'GET') {
    clearSupabaseReadCache();
    return fetch(input, init);
  }

  const key = makeCacheKey(input, init);
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached && cached.expiresAt > now) {
    return responseFromCache(cached);
  }

  const existing = inFlightGets.get(key);

  if (existing) {
    return responseFromCache(await existing);
  }

  const request = fetch(input, init).then(async (response) => {
    const body = await response.text();

    const entry: CachedFetchResponse = {
      body,
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      expiresAt: Date.now() + GET_CACHE_TTL_MS,
    };

    if (response.ok) {
      responseCache.set(key, entry);
    }

    return entry;
  });

  inFlightGets.set(key, request);

  try {
    return responseFromCache(await request);
  } finally {
    inFlightGets.delete(key);
  }
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    global: {
      fetch: cachedFetch,
    },
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
