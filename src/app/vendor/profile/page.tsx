'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { INDUSTRY_VERTICALS, IndustryVertical } from '@/types';
import { db } from '@/services/db';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

export default function VendorProfileEdit() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [profileId, setProfileId] = useState<string | null>(null);

    const [form, setForm] = useState({
        companyName: '',
        companyDescription: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        logoUrl: '',
        serviceAreas: '',
        industries: [] as string[],
        specialties: '',
        certifications: [] as string[],
        insuranceDetails: '',
        insuranceExpiry: '',
        licenseNumber: '',
        yearEstablished: '',
        teamSize: '1',
        portfolioImages: [] as string[],
        portfolioDescriptions: [] as string[],
    });

    useEffect(() => {
        if (!isLoading && !user) { router.push('/login'); return; }
        if (!user) return;
        const load = async () => {
            const profile = await db.getVendorProfile(user.id);
            if (profile) {
                setProfileId(profile.id);
                setForm({
                    companyName: profile.companyName,
                    companyDescription: profile.companyDescription,
                    contactEmail: profile.contactEmail,
                    contactPhone: profile.contactPhone,
                    website: profile.website || '',
                    logoUrl: profile.logoUrl || '',
                    serviceAreas: profile.serviceAreas.join(', '),
                    industries: profile.industries,
                    specialties: profile.specialties.join(', '),
                    certifications: profile.certifications.length > 0 ? profile.certifications : [''],
                    insuranceDetails: profile.insuranceDetails || '',
                    insuranceExpiry: profile.insuranceExpiry || '',
                    licenseNumber: profile.licenseNumber || '',
                    yearEstablished: profile.yearEstablished?.toString() || '',
                    teamSize: profile.teamSize.toString(),
                    portfolioImages: profile.portfolioImages,
                    portfolioDescriptions: profile.portfolioDescriptions,
                });
            } else {
                setForm(prev => ({ ...prev, contactEmail: user.email || '' }));
            }
        };
        load();
    }, [user, isLoading, router]);

    const toggleIndustry = (industry: string) => {
        setForm(prev => ({
            ...prev,
            industries: prev.industries.includes(industry)
                ? prev.industries.filter(i => i !== industry)
                : [...prev.industries, industry],
        }));
    };

    const updateCert = (index: number, value: string) => {
        setForm(prev => {
            const certs = [...prev.certifications];
            certs[index] = value;
            return { ...prev, certifications: certs };
        });
    };

    const addCert = () => {
        setForm(prev => ({ ...prev, certifications: [...prev.certifications, ''] }));
    };

    const removeCert = (index: number) => {
        setForm(prev => ({ ...prev, certifications: prev.certifications.filter((_, i) => i !== index) }));
    };

    const handleSave = async () => {
        if (!user) return;
        if (!form.companyName.trim()) return;
        setSaving(true);
        setSaved(false);

        try {
            const result = await db.upsertVendorProfile({
                userId: user.id,
                companyName: form.companyName,
                companyDescription: form.companyDescription,
                contactEmail: form.contactEmail,
                contactPhone: form.contactPhone,
                website: form.website || undefined,
                logoUrl: form.logoUrl || undefined,
                serviceAreas: form.serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
                industries: form.industries as IndustryVertical[],
                specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
                certifications: form.certifications.filter(c => c.trim()),
                insuranceDetails: form.insuranceDetails || undefined,
                insuranceExpiry: form.insuranceExpiry || undefined,
                licenseNumber: form.licenseNumber || undefined,
                yearEstablished: form.yearEstablished ? parseInt(form.yearEstablished) : undefined,
                teamSize: parseInt(form.teamSize) || 1,
                portfolioImages: form.portfolioImages,
                portfolioDescriptions: form.portfolioDescriptions,
            });
            setProfileId(result.id);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Error saving vendor profile:', error);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading || !user) return <div className="loading-screen">Loading...</div>;

    return (
        <div className={styles.container}>
            <Navbar />
            <header className={styles.pageHeader}>
                <h2 className="gradient-text">Company Profile</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {profileId && (
                        <Link href={`/vendor/profile/${profileId}`} className={styles.viewLink}>
                            View Public Profile
                        </Link>
                    )}
                    <Link href="/vendor" className={styles.backLink}>Back to Portal</Link>
                </div>
            </header>

            <div className={styles.content}>
                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Company Information</div>
                    <div className={styles.cardDesc}>Basic details about your company</div>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Company Name *</label>
                            <input className={styles.input} value={form.companyName}
                                onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                                placeholder="Acme Services LLC" />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Year Established</label>
                            <input className={styles.input} type="number" value={form.yearEstablished}
                                onChange={e => setForm(p => ({ ...p, yearEstablished: e.target.value }))}
                                placeholder="2015" />
                        </div>
                        <div className={styles.formGroupFull}>
                            <label className={styles.label}>Company Description</label>
                            <textarea className={styles.textarea} value={form.companyDescription}
                                onChange={e => setForm(p => ({ ...p, companyDescription: e.target.value }))}
                                placeholder="Tell customers about your company, experience, and what makes you different..." />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Team Size</label>
                            <input className={styles.input} type="number" value={form.teamSize}
                                onChange={e => setForm(p => ({ ...p, teamSize: e.target.value }))}
                                placeholder="1" min="1" />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Logo URL</label>
                            <input className={styles.input} value={form.logoUrl}
                                onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))}
                                placeholder="https://..." />
                        </div>
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Contact Information</div>
                    <div className={styles.cardDesc}>How customers can reach you</div>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Contact Email</label>
                            <input className={styles.input} type="email" value={form.contactEmail}
                                onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                                placeholder="contact@company.com" />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Phone</label>
                            <input className={styles.input} value={form.contactPhone}
                                onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                                placeholder="(555) 123-4567" />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Website</label>
                            <input className={styles.input} value={form.website}
                                onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                                placeholder="https://yourcompany.com" />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Service Areas</label>
                            <input className={styles.input} value={form.serviceAreas}
                                onChange={e => setForm(p => ({ ...p, serviceAreas: e.target.value }))}
                                placeholder="New York, Brooklyn, Queens" />
                        </div>
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Industries & Specialties</div>
                    <div className={styles.cardDesc}>Select the industries you serve</div>
                    <div className={styles.pillGroup}>
                        {INDUSTRY_VERTICALS.map(v => (
                            <button key={v}
                                className={`${styles.pill} ${form.industries.includes(v) ? styles.pillActive : ''}`}
                                onClick={() => toggleIndustry(v)}>
                                {v}
                            </button>
                        ))}
                    </div>
                    <div className={styles.formGroupFull} style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>Specialties</label>
                        <input className={styles.input} value={form.specialties}
                            onChange={e => setForm(p => ({ ...p, specialties: e.target.value }))}
                            placeholder="Plumbing, HVAC, Emergency Repairs" />
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Certifications & Licensing</div>
                    <div className={styles.cardDesc}>Build trust with verified credentials</div>
                    <div className={styles.certList}>
                        {form.certifications.map((cert, i) => (
                            <div key={i} className={styles.certRow}>
                                <input className={styles.certInput} value={cert}
                                    onChange={e => updateCert(i, e.target.value)}
                                    placeholder="Licensed Master Plumber, EPA Certified..." />
                                <button className={styles.removeBtn} onClick={() => removeCert(i)}>Remove</button>
                            </div>
                        ))}
                        <button className={styles.addBtn} onClick={addCert}>+ Add Certification</button>
                    </div>
                    <div className={styles.formGrid} style={{ marginTop: '1rem' }}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>License Number</label>
                            <input className={styles.input} value={form.licenseNumber}
                                onChange={e => setForm(p => ({ ...p, licenseNumber: e.target.value }))}
                                placeholder="LIC-12345" />
                        </div>
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Insurance</div>
                    <div className={styles.cardDesc}>Insurance coverage details</div>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroupFull}>
                            <label className={styles.label}>Insurance Details</label>
                            <textarea className={styles.textarea} value={form.insuranceDetails}
                                onChange={e => setForm(p => ({ ...p, insuranceDetails: e.target.value }))}
                                placeholder="General Liability, Workers Comp, $1M coverage..." />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Insurance Expiry Date</label>
                            <input className={styles.input} type="date" value={form.insuranceExpiry}
                                onChange={e => setForm(p => ({ ...p, insuranceExpiry: e.target.value }))} />
                        </div>
                    </div>
                </div>

                <div className={styles.saveBar}>
                    {saved && <span className={styles.savedMsg}>Profile saved</span>}
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.companyName.trim()}>
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
}
