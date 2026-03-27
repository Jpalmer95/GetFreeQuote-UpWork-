'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { storageService, StorageBucket, UploadResult } from '@/services/storageService';
import styles from './FileUpload.module.css';

interface FileUploadProps {
    bucket: StorageBucket;
    userId: string;
    existingUrls?: string[];
    maxFiles?: number;
    label?: string;
    hint?: string;
    single?: boolean;
    onUpload: (urls: string[]) => void;
    onRemove?: (url: string) => void;
    disabled?: boolean;
}

interface PreviewFile {
    id: string;
    url: string;
    name: string;
    path?: string;
    isExisting: boolean;
}

export default function FileUpload({
    bucket,
    userId,
    existingUrls = [],
    maxFiles = 10,
    label,
    hint,
    single = false,
    onUpload,
    onRemove,
    disabled = false,
}: FileUploadProps) {
    const [previews, setPreviews] = useState<PreviewFile[]>(() =>
        existingUrls.map((url, i) => ({
            id: `existing-${i}`,
            url,
            name: url.split('/').pop() || 'file',
            isExisting: true,
        }))
    );

    useEffect(() => {
        setPreviews(prev => {
            const uploadedPreviews = prev.filter(p => !p.isExisting);
            const existingPreviews: PreviewFile[] = existingUrls.map((url, i) => ({
                id: `existing-${i}`,
                url,
                name: url.split('/').pop() || 'file',
                isExisting: true,
            }));
            return [...existingPreviews, ...uploadedPreviews];
        });
    }, [existingUrls]);

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const effectiveMax = single ? 1 : maxFiles;

    const handleFiles = useCallback(async (fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        if (files.length === 0) return;

        setError(null);
        const available = effectiveMax - previews.length;
        if (available <= 0) {
            setError(`Maximum ${effectiveMax} file${effectiveMax > 1 ? 's' : ''} allowed`);
            return;
        }
        const toUpload = files.slice(0, available);

        for (const f of toUpload) {
            const validationError = storageService.validateFile(f, bucket);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        setUploading(true);
        try {
            const results: UploadResult[] = await storageService.uploadFiles(toUpload, bucket, userId);
            const newPreviews: PreviewFile[] = results.map(r => ({
                id: r.path,
                url: r.url,
                name: r.fileName,
                path: r.path,
                isExisting: false,
            }));

            const updated = single ? newPreviews : [...previews, ...newPreviews];
            setPreviews(updated);
            onUpload(updated.map(p => p.url));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    }, [previews, effectiveMax, bucket, userId, single, onUpload]);

    const handleRemove = useCallback(async (preview: PreviewFile) => {
        if (preview.path) {
            await storageService.deleteFile(preview.path, bucket);
        }
        const updated = previews.filter(p => p.id !== preview.id);
        setPreviews(updated);
        onUpload(updated.map(p => p.url));
        if (onRemove) onRemove(preview.url);
    }, [previews, bucket, onUpload, onRemove]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled || uploading) return;
        handleFiles(e.dataTransfer.files);
    }, [disabled, uploading, handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragOver(true);
    }, [disabled, uploading]);

    const handleDragLeave = useCallback(() => setDragOver(false), []);

    const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
    const canAdd = previews.length < effectiveMax;

    return (
        <div className={styles.wrapper}>
            {label && <label className={styles.label}>{label}</label>}
            {hint && <span className={styles.hint}>{hint}</span>}

            {canAdd && !disabled && (
                <div
                    className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !uploading && inputRef.current?.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className={styles.hiddenInput}
                        multiple={!single}
                        accept={bucket === 'job-attachments'
                            ? 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
                            : 'image/jpeg,image/png,image/webp,image/gif'}
                        onChange={e => e.target.files && handleFiles(e.target.files)}
                    />
                    {uploading ? (
                        <div className={styles.uploading}>
                            <span className={styles.spinner} />
                            <span>Uploading...</span>
                        </div>
                    ) : (
                        <>
                            <div className={styles.dropIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <span className={styles.dropText}>
                                Drop files here or <span className={styles.browse}>browse</span>
                            </span>
                            <span className={styles.dropHint}>
                                {bucket === 'job-attachments'
                                    ? 'JPG, PNG, WebP, GIF, PDF up to 10MB'
                                    : 'JPG, PNG, WebP, GIF up to 10MB'}
                                {!single && ` \u00B7 ${previews.length}/${effectiveMax} files`}
                            </span>
                        </>
                    )}
                </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            {previews.length > 0 && (
                <div className={styles.previewGrid}>
                    {previews.map(p => (
                        <div key={p.id} className={styles.previewItem}>
                            {isImage(p.url) ? (
                                <img src={p.url} alt={p.name} className={styles.previewImg} />
                            ) : (
                                <div className={styles.previewFile}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <span className={styles.fileName}>{p.name}</span>
                                </div>
                            )}
                            {!disabled && (
                                <button
                                    className={styles.removeBtn}
                                    onClick={(e) => { e.stopPropagation(); handleRemove(p); }}
                                    type="button"
                                    title="Remove"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
