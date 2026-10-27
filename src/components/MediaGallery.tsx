'use client';
import { useState } from 'react';
import styles from './MediaGallery.module.css';
import { isImageUrl, isVideoUrl } from '@/services/jobUpdates';

interface MediaGalleryProps {
    urls: string[];
    /** Shown above the strip, e.g. "6 photos · 1 video". */
    caption?: string;
}

function FileChip({ url }: { url: string }) {
    const name = decodeURIComponent(url.split('/').pop() || 'file');
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.doc}>
            <span aria-hidden>📄</span>
            <span className={styles.docName}>{name}</span>
        </a>
    );
}

/**
 * Photos and video evidence for a job. Bidders need to see the site before pricing it,
 * so media renders inline with a click-to-enlarge view rather than as bare links.
 */
export default function MediaGallery({ urls, caption }: MediaGalleryProps) {
    const [open, setOpen] = useState<string | null>(null);
    if (!urls.length) return null;

    const images = urls.filter(isImageUrl);
    const videos = urls.filter(isVideoUrl);
    const docs = urls.filter(u => !isImageUrl(u) && !isVideoUrl(u));

    return (
        <section className={styles.wrap} aria-label="Photos and video of the job">
            <div className={styles.head}>
                <h2 className={styles.title}>Site &amp; evidence</h2>
                <span className={styles.count}>
                    {caption ||
                        [
                            images.length ? `${images.length} photo${images.length === 1 ? '' : 's'}` : null,
                            videos.length ? `${videos.length} video${videos.length === 1 ? '' : 's'}` : null,
                            docs.length ? `${docs.length} document${docs.length === 1 ? '' : 's'}` : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                </span>
            </div>

            <div className={styles.strip}>
                {images.map((url, i) => (
                    <button
                        key={url}
                        type="button"
                        className={styles.thumb}
                        onClick={() => setOpen(url)}
                        aria-label={`Open photo ${i + 1} larger`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Job photo ${i + 1}`} loading="lazy" />
                    </button>
                ))}
                {videos.map((url, i) => (
                    <div key={url} className={styles.videoThumb}>
                        <video src={url} controls preload="metadata" aria-label={`Job video ${i + 1}`} />
                    </div>
                ))}
            </div>

            {docs.length > 0 && (
                <div className={styles.docs}>
                    {docs.map(url => (
                        <FileChip key={url} url={url} />
                    ))}
                </div>
            )}

            {open && (
                <div
                    className={styles.lightbox}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Photo viewer"
                    onClick={() => setOpen(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={open} alt="Job photo, enlarged" />
                    <button type="button" className={styles.close} onClick={() => setOpen(null)} autoFocus>
                        Close ✕
                    </button>
                </div>
            )}
        </section>
    );
}
