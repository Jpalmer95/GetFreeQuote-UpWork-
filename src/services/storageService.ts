import { supabase } from '@/lib/supabase';

export type StorageBucket = 'job-attachments' | 'vendor-assets' | 'community-images';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_TYPES = [...IMAGE_TYPES, 'application/pdf'];

export interface UploadResult {
    url: string;
    path: string;
    fileName: string;
}

function isImageType(type: string): boolean {
    return IMAGE_TYPES.includes(type);
}

async function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<File> {
    if (!isImageType(file.type) || file.type === 'image/gif') return file;
    if (file.size < 200 * 1024) return file;

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width <= maxWidth) {
                resolve(file);
                return;
            }
            const ratio = maxWidth / width;
            width = maxWidth;
            height = Math.round(height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(file); return; }
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) { resolve(file); return; }
                    resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                },
                file.type,
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

export const storageService = {
    validateFile(file: File, bucket: StorageBucket): string | null {
        if (file.size > MAX_FILE_SIZE) {
            return `File "${file.name}" exceeds 10MB limit`;
        }
        const allowed = bucket === 'job-attachments' ? ALLOWED_TYPES : IMAGE_TYPES;
        if (!allowed.includes(file.type)) {
            const types = allowed.map(t => t.split('/')[1]).join(', ');
            return `File "${file.name}" type not allowed. Accepted: ${types}`;
        }
        return null;
    },

    async uploadFile(file: File, bucket: StorageBucket, userId: string): Promise<UploadResult> {
        const error = this.validateFile(file, bucket);
        if (error) throw new Error(error);

        const compressed = await compressImage(file);
        const ext = compressed.name.split('.').pop() || 'bin';
        const safeName = compressed.name
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 50);
        const path = `${userId}/${Date.now()}_${safeName}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(path, compressed, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

        return {
            url: urlData.publicUrl,
            path,
            fileName: compressed.name,
        };
    },

    async uploadFiles(files: File[], bucket: StorageBucket, userId: string): Promise<UploadResult[]> {
        const results: UploadResult[] = [];
        const errors: string[] = [];
        for (const file of files) {
            try {
                const result = await this.uploadFile(file, bucket, userId);
                results.push(result);
            } catch (err) {
                errors.push(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
            }
        }
        if (errors.length > 0 && results.length === 0) {
            throw new Error(errors.join('; '));
        }
        if (errors.length > 0) {
            console.warn('Some uploads failed:', errors);
        }
        return results;
    },

    async deleteFile(path: string, bucket: StorageBucket): Promise<void> {
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) console.error('Error deleting file:', error.message);
    },

    getPublicUrl(path: string, bucket: StorageBucket): string {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    },
};
