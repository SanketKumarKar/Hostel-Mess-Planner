import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash, PlayCircle, StopCircle, Check, Settings, MessageSquare, Users, UserCog, UserX } from 'lucide-react';
import type { SystemSetting, Profile } from '../types';

interface Session {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
}

const AdminDashboard = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [finalizingSession, setFinalizingSession] = useState<Session | null>(null);
    const [stats, setStats] = useState({
        pendingFeedbacks: 0,
        totalVotes: 0,
        activeSessions: 0
    });
    const [activeTab, setActiveTab] = useState<'sessions' | 'caterers'>('sessions');

    // New Session Form
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchSessions();
        fetchStats();
    }, []);

    const fetchSessions = async () => {
        try {
            const { data, error } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setSessions(data || []);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchStats = async () => {
        try {
            // Pending Feedbacks
            const { count: feedbackCount } = await supabase
                .from('feedbacks')
                .select('*', { count: 'exact', head: true })
                .is('response', null);

            // Total Votes
            const { count: voteCount } = await supabase
                .from('votes')
                .select('*', { count: 'exact', head: true });

            // Active Sessions
            const { count: sessionCount } = await supabase
                .from('voting_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'open_for_voting');

            setStats({
                pendingFeedbacks: feedbackCount || 0,
                totalVotes: voteCount || 0,
                activeSessions: sessionCount || 0
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const createSession = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('voting_sessions').insert({
                title,
                start_date: startDate,
                end_date: endDate,
                status: 'draft'
            });
            if (error) throw error;
            setShowCreate(false);
            setTitle('');
            setStartDate('');
            setEndDate('');
            fetchSessions();
        } catch (error) {
            alert('Error creating session');
        }
    };

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('voting_sessions').update({ status }).eq('id', id);
        fetchSessions();
        fetchStats();
    };

    const deleteSession = async (id: string) => {
        if (!confirm('Are you sure? This will delete all votes and items.')) return;
        await supabase.from('voting_sessions').delete().eq('id', id);
        fetchSessions();
    };

    const generatePDF = async (sessionId: string, messType: string) => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        window.open(`${apiUrl}/api/generate-pdf/${sessionId}/${messType}`, '_blank');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors flex items-center gap-2 font-medium"
                    >
                        <Settings size={18} />
                        Settings
                    </button>
                    {activeTab === 'sessions' && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"
                        >
                            <Plus size={18} />
                            New Session
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`pb-3 font-medium px-2 transition-all ${activeTab === 'sessions' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Voting Sessions
                </button>
                <button
                    onClick={() => setActiveTab('caterers')}
                    className={`pb-3 font-medium px-2 transition-all ${activeTab === 'caterers' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Manage Caterers
                </button>
            </div>

            {/* Stats Row */}
            {activeTab === 'sessions' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                            <PlayCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Active Sessions</p>
                            <h3 className="text-2xl font-bold text-gray-800">{stats.activeSessions}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-full">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Pending Feedbacks</p>
                            <h3 className="text-2xl font-bold text-gray-800">{stats.pendingFeedbacks}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-full">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Votes Cast</p>
                            <h3 className="text-2xl font-bold text-gray-800">{stats.totalVotes}</h3>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sessions' ? (
                <>
                    {showCreate && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 animate-fade-in">
                            <h3 className="font-semibold text-gray-800">Create New Voting Session</h3>
                            <p className="text-sm text-gray-500 mb-4">Sessions start in <strong>Draft</strong> mode so caterers can plan the menu before students vote.</p>
                            <form onSubmit={createSession} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input type="text" required placeholder="e.g. October Week 1" className="w-full px-3 py-2 border rounded-lg" value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div className="w-full md:w-48">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input type="date" required className="w-full px-3 py-2 border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="w-full md:w-48">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                    <input type="date" required className="w-full px-3 py-2 border rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700">Create</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 animate-slide-up">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-sm">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Title</th>
                                        <th className="px-6 py-4 font-medium">Dates</th>
                                        <th className="px-6 py-4 font-medium">Votes</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sessions.map((session) => (
                                        <tr key={session.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{session.title}</td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">
                                                {new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <VoteCount sessionId={session.id} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize 
                        ${session.status === 'open_for_voting' ? 'bg-green-100 text-green-800' :
                                                        session.status === 'finalized' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {session.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                {session.status === 'draft' && (
                                                    <button onClick={() => updateStatus(session.id, 'open_for_voting')} title="Open Voting" className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                                                        <PlayCircle size={20} />
                                                    </button>
                                                )}
                                                {session.status === 'open_for_voting' && (
                                                    <button onClick={() => updateStatus(session.id, 'closed')} title="Close Voting" className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg">
                                                        <StopCircle size={20} />
                                                    </button>
                                                )}

                                                {/* Finalize Menu Button (Only for Closed) */}
                                                {session.status === 'closed' && (
                                                    <button
                                                        onClick={() => setFinalizingSession(session)}
                                                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"
                                                    >
                                                        Review & Finalize
                                                    </button>
                                                )}

                                                {/* Edit Final Menu (For Finalized) */}
                                                {session.status === 'finalized' && (
                                                    <button
                                                        onClick={() => setFinalizingSession(session)}
                                                        className="px-3 py-1 bg-gray-100 text-indigo-600 border border-indigo-200 rounded text-xs font-bold hover:bg-indigo-50"
                                                    >
                                                        Edit Menu
                                                    </button>
                                                )}

                                                {/* PDF Only for Finalized */}
                                                {session.status === 'finalized' && (
                                                    <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
                                                        <button onClick={() => generatePDF(session.id, 'veg')} className="px-2 py-1 text-blue-600 hover:bg-blue-100 rounded text-xs font-bold" title="Veg Report">Veg</button>
                                                        <button onClick={() => generatePDF(session.id, 'non_veg')} className="px-2 py-1 text-red-600 hover:bg-red-100 rounded text-xs font-bold" title="Non-Veg Report">NV</button>
                                                        <button onClick={() => generatePDF(session.id, 'special')} className="px-2 py-1 text-purple-600 hover:bg-purple-100 rounded text-xs font-bold" title="Special Report">Spl</button>
                                                        <button onClick={() => generatePDF(session.id, 'food_park')} className="px-2 py-1 text-teal-600 hover:bg-teal-100 rounded text-xs font-bold" title="Food Park Report">FP</button>
                                                    </div>
                                                )}

                                                <button onClick={() => deleteSession(session.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg">
                                                    <Trash size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <CatererManager />
            )}

            {finalizingSession && (
                <FinalizeMenuModal
                    session={finalizingSession}
                    onClose={() => {
                        setFinalizingSession(null);
                        fetchSessions();
                    }}
                />
            )}

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

const CatererManager = () => {
    const [caterers, setCaterers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCaterers = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('role', 'caterer');
            setCaterers(data || []);
            setLoading(false);
        };
        fetchCaterers();
    }, []);

    const deleteCaterer = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove caterer "${name}"? This action cannot be undone.`)) return;

        // In a real app, you'd likely soft delete or clean up related records first.
        // Assuming cascade or simple delete for prototype:
        const { error } = await supabase.from('profiles').delete().eq('id', id);

        if (error) {
            console.error(error);
            alert('Failed to delete caterer: ' + error.message);
        } else {
            setCaterers(prev => prev.filter(c => c.id !== id));
        }
    };

    if (loading) return <div>Loading caterers...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 animate-slide-up">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="px-6 py-4 font-medium">Name</th>
                            <th className="px-6 py-4 font-medium">Served Mess Types</th>
                            <th className="px-6 py-4 font-medium">Registered At</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {caterers.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">No caterers found.</td></tr>
                        ) : caterers.map((cat) => (
                            <tr key={cat.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-gray-900 font-medium">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                            <UserCog size={16} />
                                        </div>
                                        {cat.full_name}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2 flex-wrap">
                                        {cat.served_mess_types?.map(type => (
                                            <span key={type} className="px-2 py-0.5 bg-gray-100 rounded text-xs capitalize text-gray-600 border border-gray-200">
                                                {type.replace('_', ' ')}
                                            </span>
                                        )) || <span className="text-gray-400 text-sm">None set</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-sm">
                                    {new Date(cat.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => deleteCaterer(cat.id, cat.full_name)}
                                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2 ml-auto text-sm"
                                    >
                                        <UserX size={16} />
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const VoteCount = ({ sessionId }: { sessionId: string }) => {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        const fetchCount = async () => {
            // Count votes for all menu items in this session
            const { count } = await supabase
                .from('votes')
                .select('*, menu_items!inner(session_id)', { count: 'exact', head: true })
                .eq('menu_items.session_id', sessionId);

            setCount(count || 0);
        };
        fetchCount();
    }, [sessionId]);

    if (count === null) return <span className="text-gray-300 text-sm">...</span>;

    return (
        <div className="flex items-center gap-1 font-semibold text-gray-700">
            <span>{count}</span>
            <span className="text-xs font-normal text-gray-500">votes</span>
        </div>
    );
};

const FinalizeMenuModal = ({ session, onClose }: { session: Session, onClose: () => void }) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchItems = async () => {
            const { data } = await supabase
                .from('menu_items')
                .select('*, votes(count)')
                .eq('session_id', session.id);

            const formatted = (data || []).map((i: any) => ({
                ...i,
                vote_count: i.votes?.[0]?.count || 0,
                is_selected: i.is_selected === true
            }));

            // Auto-select logic if none are selected yet (first run)
            const hasAnySelection = formatted.some((i: any) => i.is_selected);
            if (!hasAnySelection) {
                // Determine winners per slot
                const groups: Record<string, any[]> = {};
                formatted.forEach((i: any) => {
                    const key = `${i.date_served}-${i.meal_type}-${i.mess_type}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(i);
                });

                Object.values(groups).forEach((slotItems: any[]) => {
                    const max = Math.max(...slotItems.map((i: any) => i.vote_count));
                    slotItems.forEach((i: any) => {
                        if (i.vote_count === max && max > 0) i.is_selected = true;
                    });
                });
            }

            setItems(formatted);
            setLoading(false);
        };
        fetchItems();
    }, [session.id]);

    const toggleSelection = (itemId: string) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_selected: !i.is_selected } : i));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = items.map(i => ({
                id: i.id,
                is_selected: i.is_selected
            }));

            for (const update of updates) {
                await supabase.from('menu_items').update({ is_selected: update.is_selected }).eq('id', update.id);
            }

            await supabase.from('voting_sessions').update({ status: 'finalized' }).eq('id', session.id);

            alert('Menu Finalized Successfully!');
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error saving menu');
        } finally {
            setSaving(false);
        }
    };

    // Group items for display
    const grouped = items.reduce((acc, item: any) => {
        const key = `${item.date_served} | ${JSON.stringify(item.mess_type)}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, any[]>);


    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Finalize Menu</h3>
                        <p className="text-sm text-gray-500">{session.title} • Review votes and select final items</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? <div>Loading...</div> : Object.entries(grouped).sort().map(([key, groupItems]) => {
                        const [date, messType] = key.split(' | ');
                        return (
                            <div key={key}>
                                <h4 className="font-bold text-gray-700 mb-3 sticky top-0 bg-white py-2 border-b">
                                    {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-gray-100 uppercase">{messType.replace(/"/g, '')}</span>
                                </h4>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(groupItems as any[]).map((item: any) => (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleSelection(item.id)}
                                            className={`
                                                relative p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-start gap-3
                                                ${item.is_selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}
                                            `}
                                        >
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-gray-400 uppercase mb-1">{item.meal_type}</div>
                                                <div className="font-semibold text-gray-900 leading-tight mb-1">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.description}</div>
                                            </div>
                                            <div className="text-center min-w-[3rem]">
                                                <div className="text-lg font-bold text-indigo-600">{item.vote_count}</div>
                                                <div className="text-[10px] text-gray-400 uppercase font-bold">Votes</div>
                                            </div>
                                            {item.is_selected && (
                                                <div className="absolute top-2 right-2 text-indigo-600 bg-white rounded-full p-0.5 shadow-sm">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3 transition-all">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                    >
                        {saving ? 'Saving...' : 'Confirm & Finalize Menu'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SettingsModal = ({ onClose }: { onClose: () => void }) => {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        const { data } = await supabase.from('system_settings').select('*');
        setSettings(data as SystemSetting[] || []);
        setLoading(false);
    };

    const toggleSetting = async (key: string, currentValue: string) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';

        // Optimistic update
        setSettings(prev => prev.map(s => s.setting_key === key ? { ...s, setting_value: newValue } : s));

        try {
            const { error } = await supabase
                .from('system_settings')
                .update({ setting_value: newValue })
                .eq('setting_key', key);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating setting:', error);
            alert('Failed to update setting');
            fetchSettings(); // Revert
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-scale-in">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Settings size={20} />
                        System Settings
                    </h3>
                </div>
                <div className="p-6 space-y-6">
                    {loading ? <div>Loading...</div> : (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-gray-800">Caterer Registration</h4>
                                    <p className="text-sm text-gray-500">Allow new caterers to sign up</p>
                                </div>
                                <Toggle
                                    enabled={settings.find(s => s.setting_key === 'caterer_registration')?.setting_value === 'true'}
                                    onToggle={() => toggleSetting('caterer_registration', settings.find(s => s.setting_key === 'caterer_registration')?.setting_value || 'false')}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-gray-800">Admin Registration</h4>
                                    <p className="text-sm text-gray-500">Allow new admins to sign up</p>
                                </div>
                                <Toggle
                                    enabled={settings.find(s => s.setting_key === 'admin_registration')?.setting_value === 'true'}
                                    onToggle={() => toggleSetting('admin_registration', settings.find(s => s.setting_key === 'admin_registration')?.setting_value || 'false')}
                                />
                            </div>
                        </>
                    )}
                </div>
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Close</button>
                </div>
            </div>
        </div>
    );
};

const Toggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => (
    <div
        onClick={onToggle}
        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
    >
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : ''}`} />
    </div>
);

export default AdminDashboard;
