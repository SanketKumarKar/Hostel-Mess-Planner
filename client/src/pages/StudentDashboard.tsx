import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Check, Calendar, Clock, Utensils, Megaphone } from 'lucide-react';

interface Session {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
    week_label?: string;
}

interface MenuItem {
    id: string;
    name: string;
    description: string;
    date_served: string;
    meal_type: string;
    mess_type: string;
    session_id: string;
}

interface Announcement {
    id: string;
    title: string;
    body: string;
    mess_type: string;
    caterer_id: string;
    created_at: string;
}

const StudentDashboard = () => {
    const { profile } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [assignedCaterer, setAssignedCaterer] = useState<any>(null);

    useEffect(() => {
        const fetchCaterer = async () => {
            if (profile?.assigned_caterer_id) {
                const { data } = await supabase.from('profiles').select('*').eq('id', profile.assigned_caterer_id).single();
                setAssignedCaterer(data);
            }
        };
        fetchCaterer();
    }, [profile]);

    useEffect(() => {
        fetchAllSessions();
    }, []);

    const fetchAllSessions = async () => {
        try {
            const { data, error } = await supabase
                .from('voting_sessions')
                .select('*')
                .in('status', ['draft', 'open_for_voting', 'finalized'])
                .order('start_date', { ascending: false });

            if (error) throw error;
            const allSessions = data || [];
            setSessions(allSessions);

            if (allSessions.length > 0) {
                const openSession = allSessions.find(s => s.status === 'open_for_voting');
                const draftSession = allSessions.find(s => s.status === 'draft');
                if (openSession) setSelectedSession(openSession);
                else if (draftSession) setSelectedSession(draftSession);
                else setSelectedSession(allSessions[0]);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (!selectedSession) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">No Active Voting Sessions</h2>
                <p className="text-gray-500">There are currently no menus open for voting. Check back later!</p>
                {profile?.role === 'student' && (
                    <button onClick={() => setShowProfileEdit(true)} className="mt-4 text-primary hover:underline">
                        Wrong Mess Type? Change it here.
                    </button>
                )}
                {showProfileEdit && <ProfileEditor onClose={() => setShowProfileEdit(false)} />}
            </div>
        );
    }

    const SessionSwitcher = () => (
        sessions.length > 1 ? (
            <div className="mb-6 flex justify-end">
                <select
                    value={selectedSession.id}
                    onChange={(e) => {
                        const s = sessions.find(s => s.id === e.target.value);
                        if (s) setSelectedSession(s);
                    }}
                    className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md shadow-sm bg-white"
                >
                    {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.title} {s.week_label ? `[${s.week_label === 'week1' ? 'Week 1' : 'Week 2'}]` : ''} ({s.status.replace('_', ' ')})
                        </option>
                    ))}
                </select>
            </div>
        ) : null
    );

    // Draft mode view
    if (selectedSession.status === 'draft') {
        return (
            <div className="space-y-6">
                <SessionSwitcher />
                
                {/* Announcements Panel - scoped to assigned caterer */}
                {profile?.assigned_caterer_id && profile?.mess_type && (
                    <AnnouncementsPanel catererId={profile.assigned_caterer_id} messType={profile.mess_type} />
                )}

                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden text-center">
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-white/20 p-3 rounded-full mb-3 animate-pulse"><Utensils size={32} /></div>
                        <h2 className="text-2xl font-bold mb-2">Menu Planning in Progress</h2>
                        <p className="text-lg opacity-90 mb-4 max-w-lg">
                            Menu items are being planned for <strong>{selectedSession.title}</strong>.
                        </p>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 w-full max-w-sm border border-white/20">
                            <h3 className="font-semibold mb-3 flex items-center justify-center gap-2 text-sm"><Calendar size={16} />Upcoming Dates</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <span className="opacity-75">Start</span>
                                    <span className="font-bold">{new Date(selectedSession.start_date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="opacity-75">End</span>
                                    <span className="font-bold">{new Date(selectedSession.end_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs bg-black/20 px-3 py-1.5 rounded-full">
                            <Clock size={14} /><span>Voting will open soon. Please check back later.</span>
                        </div>
                    </div>
                </div>
                {profile?.role === 'student' && (
                    <div className="text-center mt-4">
                        <p className="text-gray-600 mb-2">Current Mess: <span className="font-bold capitalize">{profile.mess_type?.replace('_', ' ') || 'Not Set'}</span></p>
                        <button onClick={() => setShowProfileEdit(true)} className="text-primary hover:text-indigo-700 text-sm font-medium hover:underline">Update Mess Type Preference</button>
                    </div>
                )}
                {showProfileEdit && <ProfileEditor onClose={() => setShowProfileEdit(false)} />}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <SessionSwitcher />

            {/* Header Banner */}
            <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold">{selectedSession.title}</h2>
                        {selectedSession.week_label && (
                            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${selectedSession.week_label === 'week1' ? 'bg-blue-400/30' : 'bg-violet-400/30'}`}>
                                {selectedSession.week_label === 'week1' ? 'Week 1' : 'Week 2'}
                            </span>
                        )}
                    </div>
                    <p className="opacity-90 flex items-center gap-2">
                        <Calendar size={18} />
                        {selectedSession.status === 'finalized'
                            ? <span className="font-bold bg-white/20 px-2 py-0.5 rounded">Final Menu Confirmed</span>
                            : <span>Voting Open: {new Date(selectedSession.start_date).toLocaleDateString()} - {new Date(selectedSession.end_date).toLocaleDateString()}</span>
                        }
                    </p>
                    {profile?.mess_type && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                                Your Mess: <span className="capitalize">{profile.mess_type.replace('_', ' ')}</span>
                            </div>
                            {assignedCaterer && (
                                <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                                    Caterer: {assignedCaterer.full_name}
                                </div>
                            )}
                            <button onClick={() => setShowProfileEdit(true)} className="text-xs bg-white text-primary px-3 py-1.5 rounded-full font-bold hover:bg-gray-100 transition-colors">
                                Change
                            </button>
                            {selectedSession.status === 'open_for_voting' && (
                                <button onClick={() => window.location.reload()} className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-full font-bold hover:bg-white/30 transition-colors flex items-center gap-1">
                                    ↻ Refresh Menu
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Announcements Panel - scoped to assigned caterer */}
            {profile?.assigned_caterer_id && profile?.mess_type && (
                <AnnouncementsPanel catererId={profile.assigned_caterer_id} messType={profile.mess_type} />
            )}

            {selectedSession.status === 'finalized' ? (
                <FinalMenuDisplay session={selectedSession} />
            ) : (
                <VotingInterface session={selectedSession} onEditProfile={() => setShowProfileEdit(true)} />
            )}

            {showProfileEdit && <ProfileEditor onClose={() => setShowProfileEdit(false)} />}
        </div>
    );
};

// ─────────────────────────────────────────────
// Announcements Panel (scoped by caterer + mess_type)
// ─────────────────────────────────────────────
const AnnouncementsPanel = ({ catererId, messType }: { catererId: string, messType: string }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        supabase
            .from('announcements')
            .select('*')
            .eq('caterer_id', catererId)
            .in('mess_type', [messType, 'all'])
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                setAnnouncements(data || []);
                setLoading(false);
            });
    }, [catererId, messType]);

    if (loading || announcements.length === 0) return null;

    return (
        <div className="rounded-xl border border-amber-200 overflow-hidden shadow-sm">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 font-semibold hover:from-amber-100 hover:to-orange-100 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <Megaphone size={18} className="text-amber-500" />
                    📢 Announcements from your Caterer
                    <span className="bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">{announcements.length}</span>
                </span>
                <span className="text-amber-400">{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
                <div className="divide-y divide-amber-100 bg-white">
                    {announcements.map(ann => (
                        <div key={ann.id} className="p-5">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-gray-900">{ann.title}</h4>
                                <span className="text-xs text-gray-400">{new Date(ann.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-600 text-sm">{ann.body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Profile Editor (unchanged)
// ─────────────────────────────────────────────
const ProfileEditor = ({ onClose }: { onClose: () => void }) => {
    const { profile } = useAuth();
    const [messType, setMessType] = useState(profile?.mess_type || 'veg');
    const [catererId, setCatererId] = useState(profile?.assigned_caterer_id || '');
    const [caterers, setCaterers] = useState<any[]>([]);
    const [updating, setUpdating] = useState(false);

    useEffect(() => { 
        if (profile?.mess_type) setMessType(profile.mess_type); 
        if (profile?.assigned_caterer_id) setCatererId(profile.assigned_caterer_id);
    }, [profile]);

    useEffect(() => {
        supabase.from('profiles').select('*').eq('role', 'caterer').then(({ data }) => setCaterers(data || []));
    }, []);

    const handleUpdate = async () => {
        if (!catererId) {
            alert("Please select a caterer.");
            return;
        }
        setUpdating(true);
        try {
            const preferencesChanged = profile?.mess_type !== messType || profile?.assigned_caterer_id !== catererId;
            if (preferencesChanged) {
                await supabase.from('votes').delete().eq('user_id', profile?.id);
            }
            const { error } = await supabase.from('profiles').update({ 
                mess_type: messType,
                assigned_caterer_id: catererId
            }).eq('id', profile?.id);
            if (error) throw error;
            alert(preferencesChanged ? 'Preferences updated! Previous votes cleared.' : 'Profile updated!');
            window.location.reload();
        } catch (error) {
            alert('Error updating profile');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-fade-in">
                <h3 className="text-lg font-bold mb-4">Update Profile Preferences</h3>
                
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Your Caterer</label>
                    <select 
                        value={catererId} 
                        onChange={e => setCatererId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                    >
                        <option value="" disabled>Choose a Caterer...</option>
                        {caterers.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.full_name}</option>
                        ))}
                    </select>
                </div>

                <label className="block text-sm font-bold text-gray-700 mb-2">Select Mess Type</label>
                <div className="space-y-3 mb-6">
                    {['veg', 'non_veg', 'special', 'food_park'].map((t) => (
                        <label key={t} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="messType" value={t} checked={messType === t} onChange={e => setMessType(e.target.value)} className="text-primary focus:ring-primary h-5 w-5" />
                            <span className="capitalize font-medium text-gray-700">{t.replace('_', ' ')}</span>
                        </label>
                    ))}
                </div>
                
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button onClick={handleUpdate} disabled={updating} className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700">
                        {updating ? 'Saving...' : 'Save Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Voting Interface — only shows approved items
// ─────────────────────────────────────────────
const VotingInterface = ({ session, onEditProfile }: { session: Session, onEditProfile: () => void }) => {
    const { profile } = useAuth();
    const [items, setItems] = useState<MenuItem[]>([]);
    const [votes, setVotes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.mess_type) fetchItemsAndVotes();
    }, [session.id, profile?.mess_type]);

    const fetchItemsAndVotes = async () => {
        setLoading(true);
        try {
            // Only fetch APPROVED items for student voting
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', session.id)
                .eq('mess_type', profile.mess_type)
                .eq('approval_status', 'approved')
                .order('date_served', { ascending: true })
                .order('meal_type', { ascending: true });

            const { data: userVotes } = await supabase.from('votes').select('menu_item_id').eq('user_id', profile.id);

            setItems(menuItems || []);
            setVotes(new Set(userVotes?.map(v => v.menu_item_id) || []));
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (targetItem: MenuItem) => {
        const previousVotes = new Set(votes);
        const newVotes = new Set(votes);
        const isVoted = votes.has(targetItem.id);

        if (isVoted) {
            newVotes.delete(targetItem.id);
            setVotes(newVotes);
            const { error } = await supabase.from('votes').delete().match({ user_id: profile?.id, menu_item_id: targetItem.id });
            if (error) { setVotes(previousVotes); }
        } else {
            const conflictingItem = items.find(i => i.date_served === targetItem.date_served && i.meal_type === targetItem.meal_type && votes.has(i.id));
            if (conflictingItem) {
                newVotes.delete(conflictingItem.id);
                await supabase.from('votes').delete().match({ user_id: profile?.id, menu_item_id: conflictingItem.id });
            }
            newVotes.add(targetItem.id);
            setVotes(newVotes);
            const { error } = await supabase.from('votes').insert({ user_id: profile?.id, menu_item_id: targetItem.id });
            if (error) { setVotes(previousVotes); }
        }
    };

    const groupedItems = items.reduce((acc, item) => {
        const date = item.date_served;
        if (!acc[date]) acc[date] = {};
        if (!acc[date][item.meal_type]) acc[date][item.meal_type] = [];
        acc[date][item.meal_type].push(item);
        return acc;
    }, {} as Record<string, Record<string, MenuItem[]>>);

    if (!profile?.mess_type) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-500 mb-4">Please update your profile with a mess type to vote.</p>
                <button onClick={onEditProfile} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">Set Mess Preference</button>
            </div>
        );
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading menu items...</div>;

    if (items.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                <Calendar className="text-gray-400 mx-auto mb-4" size={32} />
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Menu Items Available Yet</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                    Menu items for <span className="font-semibold text-primary capitalize">{profile.mess_type.replace('_', ' ')}</span> mess are being reviewed by the admin. Check back soon!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {Object.entries(groupedItems).map(([date, meals]) => (
                <div key={date} className="animate-fade-in">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 sticky top-20 bg-background/95 backdrop-blur py-2 z-10 border-b">
                        {(() => {
                            const current = new Date(date);
                            const start = new Date(session.start_date);
                            current.setHours(0,0,0,0);
                            start.setHours(0,0,0,0);
                            const diffDays = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            const weekNum = Math.floor(diffDays / 7) + 1;
                            return `${current.toLocaleDateString('en-US', { weekday: 'long' })}, Week ${weekNum}`;
                        })()}
                    </h3>
                    <div className="grid gap-6">
                        {['breakfast', 'lunch', 'snacks', 'dinner'].map((mealType) => {
                            const options: MenuItem[] | undefined = meals[mealType];
                            if (!options?.length) return null;
                            return (
                                <div key={mealType} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{mealType}</h4>
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {options.map((item: MenuItem) => {
                                            const isVoted = votes.has(item.id);
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleVote(item)}
                                                    className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all group ${isVoted ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-100 hover:border-gray-300 hover:shadow-md'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h5 className="font-semibold text-gray-900">{item.name}</h5>
                                                        {isVoted ? (
                                                            <div className="bg-primary text-white p-1 rounded-full shadow-sm"><Check size={14} /></div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-primary transition-colors" />
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                                                    <button className={`w-full py-1.5 rounded text-sm font-medium transition-colors ${isVoted ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                                                        {isVoted ? 'Voted' : 'Vote'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────
// Final Menu Display (unchanged logic)
// ─────────────────────────────────────────────
const FinalMenuDisplay = ({ session }: { session: Session }) => {
    const { profile } = useAuth();
    const [items, setItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile?.mess_type) return;
        supabase.from('menu_items').select('*')
            .eq('session_id', session.id)
            .is('is_selected', true)
            .eq('mess_type', profile.mess_type)
            .order('date_served', { ascending: true })
            .order('meal_type', { ascending: true })
            .then(({ data }) => { setItems(data || []); setLoading(false); });
    }, [session.id, profile?.mess_type]);

    if (loading) return <div className="text-center py-10">Loading final menu...</div>;
    if (items.length === 0) return <div className="text-center py-10 text-gray-500">No items finalized for {profile?.mess_type?.replace('_', ' ')} mess yet.</div>;

    const grouped = items.reduce((acc, item) => {
        const date = item.date_served;
        if (!acc[date]) acc[date] = {};
        if (!acc[date][item.meal_type]) acc[date][item.meal_type] = [];
        acc[date][item.meal_type].push(item);
        return acc;
    }, {} as Record<string, Record<string, MenuItem[]>>);

    return (
        <div className="space-y-8 animate-fade-in">
            {Object.entries(grouped).map(([date, meals]) => (
                <div key={date}>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 sticky top-20 bg-background/95 backdrop-blur py-2 z-10 border-b flex items-center gap-2">
                        {(() => {
                            const current = new Date(date);
                            const start = new Date(session.start_date);
                            current.setHours(0,0,0,0);
                            start.setHours(0,0,0,0);
                            const diffDays = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            const weekNum = Math.floor(diffDays / 7) + 1;
                            return `${current.toLocaleDateString('en-US', { weekday: 'long' })}, Week ${weekNum}`;
                        })()}
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full uppercase">Final</span>
                    </h3>
                    <div className="grid gap-6">
                        {['breakfast', 'lunch', 'snacks', 'dinner'].map((mealType) => {
                            const options = meals[mealType];
                            if (!options?.length) return null;
                            return (
                                <div key={mealType} className="bg-white rounded-xl shadow-sm border border-green-100 p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Check size={100} /></div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 relative z-10">{mealType}</h4>
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                                        {options.map((item) => (
                                            <div key={item.id} className="p-4 rounded-lg bg-green-50/50 border border-green-100">
                                                <h5 className="font-bold text-gray-900 mb-1">{item.name}</h5>
                                                <p className="text-sm text-gray-600">{item.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StudentDashboard;
