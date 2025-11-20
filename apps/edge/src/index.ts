/**
 * Cloudflare Worker for Fundr Edge Cache Layer
 * 
 * Architecture: apps/api → apps/edge → apps/web
 * 
 * This worker:
 * - Fetches data exclusively from apps/api
 * - Uses KV for read-through caching
 * - Provides backward-compatible routes
 * - NEVER accesses blockchain directly
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

interface Env {
	KV: KVNamespace;
	API_URL: string; // Base URL for apps/api (e.g., "http://localhost:3001")
}

interface ApiSuccessResponse<T = unknown> {
	success: true;
	data: T;
}

interface ApiErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
	};
}

type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Campaign list response (backward compatible with old format)
interface CampaignListResponse {
	campaigns: CampaignRecord[];
	cursor: number;
	nextCursor: number | null;
	hasMore: boolean;
	sort: 'latest' | 'deadline';
	total: number;
}

interface CampaignRecord {
	address: string;
	creator: string;
	goal: string;
	deadline: number;
	status: number | string;
	totalPledged: string;
	metadataURI: string;
	createdAt: number;
	createdBlock: number;
}

// ============================================================================
// CORS & Response Helpers
// ============================================================================

const corsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
	'Access-Control-Max-Age': '86400',
	Vary: 'Origin',
};

function withCors(init: ResponseInit = {}, body?: BodyInit | null): Response {
	const headers = new Headers(init.headers ?? {});
	for (const [key, value] of Object.entries(corsHeaders)) {
		headers.set(key, value);
	}
	if (body === undefined) {
		return new Response(null, { ...init, headers });
	}
	return new Response(body, { ...init, headers });
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers ?? {});
	headers.set('Content-Type', 'application/json');
	return withCors({ ...init, headers }, JSON.stringify(body));
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Fetches data from apps/api with error handling
 */
async function fetchFromApi<T = unknown>(
	env: Env,
	path: string,
	options: RequestInit = {}
): Promise<ApiResponse<T>> {
	const apiUrl = env.API_URL.replace(/\/$/, ''); // Remove trailing slash
	const url = `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;

	try {
		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: {
					code: `HTTP_${response.status}`,
					message: `API request failed: ${response.statusText}`,
				},
			};
		}

		const data = await response.json();
		return data as ApiResponse<T>;
	} catch (error) {
		console.error('API fetch error:', error);
		return {
			success: false,
			error: {
				code: 'FETCH_ERROR',
				message: error instanceof Error ? error.message : 'Unknown fetch error',
			},
		};
	}
}

// ============================================================================
// KV Cache Helpers (Skeleton - to be implemented in detail later)
// ============================================================================

const CACHE_TTL = 60; // Default cache TTL in seconds (30-120s range)

/**
 * KV key prefixes for backward compatibility
 */
function kvKeyLatest(env: Env): string {
	return 'kv:crowd:latest';
}

function kvKeyCampaign(env: Env, address: string): string {
	const normalized = address.toLowerCase();
	return `kv:crowd:campaign:${normalized}`;
}

function kvKeyMeta(env: Env, address: string): string {
	const normalized = address.toLowerCase();
	return `kv:crowd:meta:${normalized}`;
}

/**
 * Get cached value from KV
 */
async function cacheGet<T = unknown>(env: Env, key: string): Promise<T | null> {
	try {
		const cached = await env.KV.get(key, 'json');
		if (!cached) return null;
		return cached as T;
	} catch (error) {
		console.warn(`Cache get error for key ${key}:`, error);
		return null;
	}
}

/**
 * Set cached value in KV with TTL
 */
async function cacheSet(env: Env, key: string, value: unknown, ttlSeconds: number = CACHE_TTL): Promise<void> {
	try {
		await env.KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
	} catch (error) {
		console.warn(`Cache set error for key ${key}:`, error);
	}
}

/**
 * Read-through cache wrapper (stale-while-revalidate pattern)
 * 
 * TODO: Implement detailed caching rules in next iteration
 */
async function withCache<T>(
	env: Env,
	key: string,
	fetcher: () => Promise<T>,
	ttlSeconds: number = CACHE_TTL
): Promise<T> {
	// Try to get from cache first
	const cached = await cacheGet<T>(env, key);
	if (cached !== null) {
		// Return cached value immediately, refresh in background
		// Note: In Cloudflare Workers, we can't truly background refresh,
		// but we can return stale data if fetch fails
		return cached;
	}

	// Cache miss: fetch fresh data
	const fresh = await fetcher();
	await cacheSet(env, key, fresh, ttlSeconds);
	return fresh;
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /campaigns
 * Maps to API /projects with backward-compatible response format
 */
async function handleCampaignsRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const limitParam = url.searchParams.get('limit');
	const cursorParam = url.searchParams.get('cursor');
	const sortParam = url.searchParams.get('sort');

	// Parse query params
	const limit = limitParam ? Number.parseInt(limitParam, 10) : 12;
	const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : 0;
	const sort = sortParam === 'deadline' ? 'deadline' : 'latest';

	// Validate params
	if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
		return jsonResponse({ error: 'Invalid limit' }, { status: 400 });
	}
	if (Number.isNaN(cursor) || cursor < 0) {
		return jsonResponse({ error: 'Invalid cursor' }, { status: 400 });
	}

	// Calculate page number from cursor (API uses page-based pagination)
	const page = Math.floor(cursor / limit) + 1;

	// Fetch from API with caching
	const cacheKey = `campaigns:${sort}:${page}:${limit}`;
	const apiResponse = await withCache(
		env,
		cacheKey,
		async () => {
			const response = await fetchFromApi<{
				items: CampaignRecord[];
				pagination: {
					page: number;
					limit: number;
					total: number;
					totalPages: number;
				};
			}>(env, `/projects?page=${page}&limit=${limit}&sort=${sort}`);

			if (!response.success) {
				throw new Error(response.error.message);
			}

			return response.data;
		},
		60 // Cache for 60 seconds
	);

	// Transform API response to backward-compatible format
	const campaigns = apiResponse.items || [];
	const total = apiResponse.pagination.total || 0;
	const nextCursor = cursor + campaigns.length < total ? cursor + campaigns.length : null;

	const body: CampaignListResponse = {
		campaigns,
		cursor,
		nextCursor,
		hasMore: nextCursor !== null,
		sort,
		total,
	};

	return jsonResponse(body, { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } });
}

/**
 * GET /campaigns/:id
 * Maps to API /projects/:address
 */
async function handleCampaignDetailRequest(request: Request, env: Env, address: string): Promise<Response> {
	// Validate address format
	if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
		return jsonResponse({ error: 'Invalid address format' }, { status: 400 });
	}

	// Fetch from API with caching
	const cacheKey = kvKeyCampaign(env, address);
	const apiResponse = await withCache(
		env,
		cacheKey,
		async () => {
			const response = await fetchFromApi<CampaignRecord>(env, `/projects/${address}`);

			if (!response.success) {
				throw new Error(response.error.message);
			}

			return response.data;
		},
		120 // Cache for 120 seconds
	);

	return jsonResponse(apiResponse, { status: 200, headers: { 'Cache-Control': 'public, max-age=120' } });
}

/**
 * GET /health
 * Maps to API /healthz with additional edge worker status
 */
async function handleHealthRequest(env: Env): Promise<Response> {
	// Check API health
	const apiHealth = await fetchFromApi<{ status: string; timestamp: string }>(env, '/healthz');

	const body = {
		status: apiHealth.success ? 'ok' : 'degraded',
		edge: 'ok',
		api: apiHealth.success ? apiHealth.data : { error: apiHealth.error.message },
		timestamp: new Date().toISOString(),
	};

	return jsonResponse(body, {
		status: apiHealth.success ? 200 : 503,
		headers: { 'Cache-Control': 'no-store' },
	});
}

/**
 * GET /stats
 * Maps to API /stats
 */
async function handleStatsRequest(env: Env): Promise<Response> {
	const cacheKey = 'stats:global';
	const apiResponse = await withCache(
		env,
		cacheKey,
		async () => {
			const response = await fetchFromApi(env, '/stats');

			if (!response.success) {
				throw new Error(response.error.message);
			}

			return response.data;
		},
		120 // Cache for 120 seconds
	);

	return jsonResponse(apiResponse, { status: 200, headers: { 'Cache-Control': 'public, max-age=120' } });
}

/**
 * GET /debug
 * Debug endpoint for inspecting worker state
 */
async function handleDebugRequest(env: Env): Promise<Response> {
	const kvList = await env.KV.list();
	const body = {
		kvCount: kvList.keys.length,
		apiUrl: env.API_URL,
		timestamp: new Date().toISOString(),
	};

	return jsonResponse(body, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

// ============================================================================
// Main Worker Handler
// ============================================================================

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return withCors({ status: 204 });
		}

		// Validate API_URL is configured
		if (!env.API_URL || env.API_URL.trim().length === 0) {
			console.error('API_URL is not configured');
			return jsonResponse({ error: 'Server configuration error' }, { status: 500 });
		}

		let response: Response;

		try {
			// Route handling
			if (request.method === 'GET' && url.pathname === '/campaigns') {
				response = await handleCampaignsRequest(request, env);
			} else if (request.method === 'GET' && url.pathname.startsWith('/campaigns/')) {
				// Extract address from path: /campaigns/:address
				const address = url.pathname.split('/campaigns/')[1]?.split('?')[0];
				if (!address) {
					response = jsonResponse({ error: 'Missing address parameter' }, { status: 400 });
				} else {
					response = await handleCampaignDetailRequest(request, env, address);
				}
			} else if (request.method === 'GET' && url.pathname === '/health') {
				response = await handleHealthRequest(env);
			} else if (request.method === 'GET' && url.pathname === '/stats') {
				response = await handleStatsRequest(env);
			} else if (request.method === 'GET' && url.pathname === '/debug') {
				response = await handleDebugRequest(env);
			} else {
				response = jsonResponse({ error: 'Not Found' }, { status: 404 });
			}
		} catch (err) {
			console.error('Request failed:', err);
			response = jsonResponse(
				{
					error: 'Internal Server Error',
					message: err instanceof Error ? err.message : 'Unknown error',
				},
				{ status: 500 }
			);
		}

		return response;
	},
} satisfies ExportedHandler<Env>;
