import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (userId, authUser = null) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // No profile found — create one without making a nested auth call.
                const fullName = authUser?.user_metadata?.full_name
                    || authUser?.user_metadata?.name
                    || authUser?.email?.split('@')[0]
                    || 'User';

                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        full_name: fullName,
                        role: 'student',
                        mess_type: 'veg',
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error creating profile:', insertError);
                    setProfileError(insertError.message);
                } else {
                    setProfile(newProfile);
                    setProfileError(null);
                }
            } else if (error) {
                throw error;
            } else {
                setProfile(data);
                setProfileError(null);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setProfile(null);
            setProfileError(error.message);
        } finally {
            // Do not leave the whole app blocked when Supabase/RLS rejects a profile request.
            setLoading(false);
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        if (!user) return;
        await fetchProfile(user.id);
    }, [user, fetchProfile]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) throw error;
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id, session.user);
            else setLoading(false);
        }).catch((error) => {
            console.error('Error restoring auth session:', error);
            setSession(null);
            setUser(null);
            setProfile(null);
            setProfileError(null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id, session.user);
            else {
                setProfile(null);
                setProfileError(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchProfile]);

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
    };

    const profileUnavailable = !loading && user && !profile;

    return (
        <AuthContext.Provider value={{ session, user, profile, profileError, loading, signOut, refreshProfile }}>
            {loading ? (
                <div className="flex items-center justify-center h-screen">Initializing App...</div>
            ) : profileUnavailable ? (
                <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                    <div className="max-w-lg rounded-xl bg-white p-8 text-center shadow-sm">
                        <h1 className="mb-3 text-xl font-bold text-slate-900">Your profile is not available</h1>
                        <p className="mb-6 text-sm text-slate-600">
                            The account is signed in, but its FeastFull profile could not be loaded. Run the latest database repair SQL, then sign in again.
                        </p>
                        {profileError && (
                            <p className="mb-6 break-words rounded-lg bg-red-50 p-3 text-left text-xs text-red-700">
                                Database error: {profileError}
                            </p>
                        )}
                        <button onClick={signOut} className="rounded-lg bg-primary px-4 py-2 font-medium text-white">
                            Sign out
                        </button>
                    </div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};