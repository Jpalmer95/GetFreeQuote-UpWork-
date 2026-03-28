'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: any | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchOrCreateProfile(session.user);
            else setIsLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchOrCreateProfile(session.user);
            } else {
                setProfile(null);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchOrCreateProfile = async (authUser: User) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (!error && data) {
                setProfile(data);
                return;
            }

            if (error && error.code === 'PGRST116') {
                const meta = authUser.user_metadata || {};
                const fullName = meta.full_name || meta.name || '';
                const role = meta.role || 'USER';

                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: authUser.id,
                        full_name: fullName,
                        role: role,
                        email: authUser.email,
                    }, { onConflict: 'id' })
                    .select('*')
                    .single();

                if (!insertError && newProfile) {
                    setProfile(newProfile);
                } else {
                    console.error('Error creating profile:', insertError);
                    const { data: refetchData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authUser.id)
                        .single();
                    if (refetchData) setProfile(refetchData);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
