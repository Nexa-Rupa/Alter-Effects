import "server-only";


export const liveMediaUrl = (videoId: string, assetId: string) => `/api/live/${videoId}/media/${assetId}`;
export const livePageUrl = (videoId: string, version: number) => `/api/live/${videoId}?v=${version}`;
