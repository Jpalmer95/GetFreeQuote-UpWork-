import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const base = 'https://getfreequote.org';
    const now = new Date();
    return [
        { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: `${base}/marketplace`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
        { url: `${base}/local`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
        { url: `${base}/jit`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
        { url: `${base}/community`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
        { url: `${base}/post-job`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
        { url: `${base}/docs/mcp`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${base}/connect`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
        { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
        { url: `${base}/llms.txt`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
        { url: `${base}/AGENTS.md`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ];
}
