import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash, PlayCircle, StopCircle, Check, Settings, MessageSquare, Users, UserCog, UserX, Sparkles, Loader2, X, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { buildSlotOptions, formatSlotLabel, getTotalSlots } from '../utils/menuSlots';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatCompactVotes = (value) => {
    const count = Number(value) || 0;
    if (count < 1000) return String(count);
    const compact = (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1);
    return `${compact}k`;
};

const AdminDashboard = () => {
    const [sessions, setSessions] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [finalizingSession, setFinalizingSession] = useState(null);
    const [editingSession, setEditingSession] = useState(null);
    const [stats, setStats] = useState({ pendingFeedbacks: 0, totalVotes: 0, activeSessions: 0, pendingApprovals: 0 });
    const [activeTab, setActiveTab] = useState('sessions');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showPendingFeedbackModal, setShowPendingFeedbackModal] = useState(false);
    const [pendingByCatererLoading, setPendingByCatererLoading] = useState(false);
    const [pendingByCaterer, setPendingByCaterer] = useState([]);
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sessionWeeks, setSessionWeeks] = useState(2);

    useEffect(() => { fetchSessions(); fetchStats(); }, []);

    const fetchSessions = async () => {
        try {
            const { data, error } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setSessions(data || []);
        } catch (error) { console.error('Error:', error); }
    };

    const fetchStats = async () => {
        try {
            const { count: feedbackCount } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true }).is('response', null);
            const { count: voteCount } = await supabase.from('votes').select('*', { count: 'exact', head: true });
            const { count: sessionCount } = await supabase.from('voting_sessions').select('*', { count: 'exact', head: true }).eq('status', 'open_for_voting');
            const { count: pendingCount } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending');
            setStats({ pendingFeedbacks: feedbackCount || 0, totalVotes: voteCount || 0, activeSessions: sessionCount || 0, pendingApprovals: pendingCount || 0 });
        } catch (error) { console.error('Error fetching stats:', error); }
    };

    const createSession = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('voting_sessions').insert({ title, start_date: startDate, end_date: endDate, session_weeks: Number(sessionWeeks) === 1 ? 1 : 2, status: 'draft' });
            if (error) throw error;
            setShowCreate(false); setTitle(''); setStartDate(''); setEndDate(''); setSessionWeeks(2);
            fetchSessions();
        } catch (error) { toast.error('Error creating session'); }
    };

    const updateStatus = async (id, status) => { await supabase.from('voting_sessions').update({ status }).eq('id', id); fetchSessions(); fetchStats(); };
    const deleteSession = async (id) => { if (!confirm('Are you sure? This will delete all votes and items.')) return; await supabase.from('voting_sessions').delete().eq('id', id); fetchSessions(); };
    const generatePDF = async (sessionId, messType) => { window.open(`${API_URL}/api/generate-pdf/${sessionId}/${messType}`, '_blank'); };

    const handleAISummarize = async () => {
        setSummaryLoading(true); setShowSummaryModal(true); setSummaryText('');
        try {
            const { data: feedbacks, error } = await supabase.from('feedbacks').select('*, student:profiles!student_id(full_name), caterer:profiles!caterer_id(full_name)').order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            const res = await axios.post(`${API_URL}/api/ai/summarize-feedback`, { feedbacks });
            setSummaryText(res.data.summary);
        } catch (err) {
            setSummaryText('Failed to generate summary: ' + (err.response?.data?.error || err.message));
        } finally { setSummaryLoading(false); }
    };

    const handleOpenPendingFeedbackModal = async () => {
        setShowPendingFeedbackModal(true);
        setPendingByCatererLoading(true);
        try {
            const { data, error } = await supabase
                .from('feedbacks')
                .select('caterer_id, caterer:profiles!caterer_id(full_name)')
                .is('response', null);

            if (error) throw error;

            const grouped = (data || []).reduce((acc, row) => {
                const key = row.caterer_id || 'unknown';
                const name = row.caterer?.full_name || 'Unknown Caterer';
                if (!acc[key]) {
                    acc[key] = { id: key, name, count: 0 };
                }
                acc[key].count += 1;
                return acc;
            }, {});

            const sorted = Object.values(grouped).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
            setPendingByCaterer(sorted);
        } catch {
            toast.error('Failed to load pending feedback details');
            setPendingByCaterer([]);
        } finally {
            setPendingByCatererLoading(false);
        }
    };

    const weekBadge = (label) => {
        if (!label) return null;
        return (<span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${label === 'week1' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{label === 'week1' ? 'W1' : 'W2'}</span>);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
                <div className="flex gap-2">
                    <button onClick={handleAISummarize} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-indigo-200"><Sparkles size={16} />AI Feedback Summary</button>
                    <button onClick={() => setShowSettings(true)} className="bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors flex items-center gap-2 font-medium"><Settings size={18} />Settings</button>
                    {activeTab === 'sessions' && (<button onClick={() => setShowCreate(true)} className="bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"><Plus size={18} />New Session</button>)}
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-200">
                <button onClick={() => setActiveTab('sessions')} className={`pb-3 font-medium px-2 transition-all ${activeTab === 'sessions' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>Voting Sessions</button>
                <button onClick={() => setActiveTab('approvals')} className={`pb-3 font-medium px-2 transition-all flex items-center gap-2 ${activeTab === 'approvals' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>Pending Approvals{stats.pendingApprovals > 0 && (<span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{stats.pendingApprovals}</span>)}</button>
                <button onClick={() => setActiveTab('caterers')} className={`pb-3 font-medium px-2 transition-all ${activeTab === 'caterers' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>Manage Caterers</button>
            </div>

            {activeTab === 'sessions' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-full"><PlayCircle size={20} /></div><div><p className="text-xs text-gray-500 font-medium">Active Sessions</p><h3 className="text-xl font-bold text-gray-800">{stats.activeSessions}</h3></div></div>
                    <button onClick={handleOpenPendingFeedbackModal} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 text-left hover:shadow-md hover:border-orange-200 transition-all">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><MessageSquare size={20} /></div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Pending Feedbacks</p>
                            <h3 className="text-xl font-bold text-gray-800">{stats.pendingFeedbacks}</h3>
                        </div>
                    </button>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3"><div className="p-2 bg-green-50 text-green-600 rounded-full"><Users size={20} /></div><div><p className="text-xs text-gray-500 font-medium">Total Votes</p><h3 className="text-xl font-bold text-gray-800">{formatCompactVotes(stats.totalVotes)}</h3></div></div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 border flex items-center gap-3"><div className="p-2 bg-red-50 text-red-600 rounded-full"><Check size={20} /></div><div><p className="text-xs text-gray-500 font-medium">Pending Approvals</p><h3 className="text-xl font-bold text-gray-800">{stats.pendingApprovals}</h3></div></div>
                </div>
            )}

            {activeTab === 'sessions' ? (
                <>
                    {showCreate && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 animate-fade-in">
                            <h3 className="font-semibold text-gray-800">Create New Voting Session</h3>
                            <p className="text-sm text-gray-500 mb-4">Sessions start in <strong>Draft</strong> mode so caterers can plan the menu before admin approves items.</p>
                            <form onSubmit={createSession} className="flex flex-col md:flex-row gap-4 items-end flex-wrap">
                                <div className="flex-1 min-w-[180px]"><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input type="text" required placeholder="e.g. March Week 1" className="w-full px-3 py-2 border rounded-lg" value={title} onChange={e => setTitle(e.target.value)} /></div>
                                <div className="w-full md:w-48"><label className="block text-sm font-medium text-gray-700 mb-1">Menu Cycle</label><select className="w-full px-3 py-2 border rounded-lg" value={sessionWeeks} onChange={e => setSessionWeeks(Number(e.target.value))}><option value={1}>1 Week (Mon-Sun)</option><option value={2}>2 Weeks (Mon Wk1 - Sun Wk2)</option></select></div>
                                <div className="w-full md:w-44"><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" required className="w-full px-3 py-2 border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                                <div className="w-full md:w-44"><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" required className="w-full px-3 py-2 border rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                                <div className="flex gap-2"><button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700">Create</button></div>
                            </form>
                        </div>
                    )}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 animate-slide-up">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-sm"><tr><th className="px-6 py-4 font-medium">Title</th><th className="px-6 py-4 font-medium">Dates</th><th className="px-6 py-4 font-medium">Votes</th><th className="px-6 py-4 font-medium">Status</th><th className="px-6 py-4 font-medium text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sessions.map((session) => (
                                        <tr key={session.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900"><div className="flex items-center gap-2">{session.title}{weekBadge(session.week_label)}</div></td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">{new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4"><VoteCount sessionId={session.id} /></td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full font-medium capitalize ${session.status === 'open_for_voting' ? 'bg-green-100 text-green-800' : session.status === 'finalized' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{session.status.replace('_', ' ')}</span></td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                {(session.status === 'draft' || session.status === 'open_for_voting') && (<button onClick={() => setEditingSession(session)} className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded text-xs font-bold hover:bg-green-200 transition-colors">Add Items</button>)}
                                                {session.status === 'draft' && (<button onClick={() => updateStatus(session.id, 'open_for_voting')} title="Open Voting" className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><PlayCircle size={20} /></button>)}
                                                {session.status === 'open_for_voting' && (<button onClick={() => updateStatus(session.id, 'closed')} title="Close Voting" className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"><StopCircle size={20} /></button>)}
                                                {session.status === 'closed' && (<button onClick={() => setFinalizingSession(session)} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 flex items-center gap-1">Review & Finalize</button>)}
                                                {session.status === 'finalized' && (<button onClick={() => setFinalizingSession(session)} className="px-3 py-1 bg-gray-100 text-indigo-600 border border-indigo-200 rounded text-xs font-bold hover:bg-indigo-50">Edit Menu</button>)}
                                                {session.status === 'finalized' && (<div className="flex gap-1 bg-gray-50 p-1 rounded-lg"><button onClick={() => generatePDF(session.id, 'veg')} className="px-2 py-1 text-blue-600 hover:bg-blue-100 rounded text-xs font-bold">Veg</button><button onClick={() => generatePDF(session.id, 'non_veg')} className="px-2 py-1 text-red-600 hover:bg-red-100 rounded text-xs font-bold">NV</button><button onClick={() => generatePDF(session.id, 'special')} className="px-2 py-1 text-purple-600 hover:bg-purple-100 rounded text-xs font-bold">Spl</button><button onClick={() => generatePDF(session.id, 'food_park')} className="px-2 py-1 text-teal-600 hover:bg-teal-100 rounded text-xs font-bold">FP</button></div>)}
                                                <button onClick={() => deleteSession(session.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : activeTab === 'approvals' ? (
                <PendingApprovals onApproved={fetchStats} />
            ) : (
                <CatererManager />
            )}

            {finalizingSession && (<FinalizeMenuModal session={finalizingSession} onClose={() => { setFinalizingSession(null); fetchSessions(); }} />)}
            {editingSession && (<AdminMenuEditor session={editingSession} onClose={() => { setEditingSession(null); fetchSessions(); }} />)}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

            {showSummaryModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-scale-in">
                        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Sparkles size={20} className="text-indigo-500" />AI Feedback Summary</h3>
                            <button onClick={() => setShowSummaryModal(false)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            {summaryLoading ? (<div className="flex flex-col items-center py-8 text-gray-400"><Loader2 size={36} className="animate-spin text-indigo-400 mb-3" /><p className="text-sm">Gemini is analyzing student feedback...</p></div>) : (<p className="text-gray-700 leading-relaxed">{summaryText}</p>)}
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end"><button onClick={() => setShowSummaryModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Close</button></div>
                    </div>
                </div>
            )}

            {showPendingFeedbackModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-scale-in">
                        <div className="p-6 border-b bg-orange-50 rounded-t-xl flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><MessageSquare size={20} className="text-orange-500" />Pending Feedback To Address</h3>
                            <button onClick={() => setShowPendingFeedbackModal(false)} className="p-1 hover:bg-orange-100 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            {pendingByCatererLoading ? (
                                <div className="flex flex-col items-center py-8 text-gray-400">
                                    <Loader2 size={36} className="animate-spin text-orange-400 mb-3" />
                                    <p className="text-sm">Loading caterer-wise pending feedback...</p>
                                </div>
                            ) : pendingByCaterer.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-6">No pending feedback found. All caterers are up to date.</p>
                            ) : (
                                <div className="space-y-2">
                                    {pendingByCaterer.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                                            <p className="font-medium text-gray-700">{entry.name}</p>
                                            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-bold">{entry.count} pending</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={() => setShowPendingFeedbackModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PendingApprovals = ({ onApproved }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(null);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('menu_items').select('*, session:voting_sessions!session_id(title, status)').eq('approval_status', 'pending').order('created_at', { ascending: false });
            if (error) throw error;
            setItems(data || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchPending(); }, []);

    const handleApprove = async (id) => { setActing(id + '-approve'); try { const { error } = await supabase.from('menu_items').update({ approval_status: 'approved' }).eq('id', id); if (error) throw error; fetchPending(); onApproved(); } catch (err) { toast.error('Failed to approve item'); } finally { setActing(null); } };
    const handleReject = async (id) => { setActing(id + '-reject'); try { const { error } = await supabase.from('menu_items').update({ approval_status: 'rejected' }).eq('id', id); if (error) throw error; fetchPending(); onApproved(); } catch (err) { toast.error('Failed to reject item'); } finally { setActing(null); } };

    const messColors = { veg: 'bg-green-100 text-green-700', non_veg: 'bg-orange-100 text-orange-700', special: 'bg-purple-100 text-purple-700', food_park: 'bg-teal-100 text-teal-700' };

    if (loading) return <div className="text-center py-10 text-gray-500">Loading pending items...</div>;
    if (items.length === 0) return (<div className="text-center py-16 bg-white rounded-xl border border-gray-100"><CheckCircle size={48} className="mx-auto text-green-400 mb-3" /><p className="text-gray-500 font-medium">All caught up! No items awaiting approval.</p></div>);

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''} awaiting your review before they appear in student voting.</p>
            <div className="grid gap-4">
                {items.map(item => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-amber-100 p-5 flex items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${messColors[item.mess_type] || 'bg-gray-100 text-gray-600'}`}>{item.mess_type.replace('_', ' ')}</span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{item.meal_type}</span>
                                <span className="text-xs text-gray-400">• {item.session?.title || 'Unknown Session'}</span>
                            </div>
                            <h4 className="font-bold text-gray-900">{item.name}</h4>
                            {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                            <p className="text-xs text-gray-400 mt-2">For: {new Date(item.date_served).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleApprove(item.id)} disabled={!!acting} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">{acting === item.id + '-approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}Approve</button>
                            <button onClick={() => handleReject(item.id)} disabled={!!acting} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors">{acting === item.id + '-reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}Reject</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const VoteCount = ({ sessionId }) => {
    const [count, setCount] = useState(null);
    useEffect(() => { supabase.from('votes').select('*, menu_items!inner(session_id)', { count: 'exact', head: true }).eq('menu_items.session_id', sessionId).then(({ count }) => setCount(count || 0)); }, [sessionId]);
    if (count === null) return <span className="text-gray-300 text-sm">...</span>;
    return <div className="flex items-center gap-1 font-semibold text-gray-700"><span>{formatCompactVotes(count)}</span><span className="text-xs font-normal text-gray-500">votes</span></div>;
};

const FinalizeMenuModal = ({ session, onClose }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const allSelected = items.length > 0 && items.every((item) => item.is_selected);

    useEffect(() => {
        const fetchItems = async () => {
            const { data } = await supabase.from('menu_items').select('*, votes(count)').eq('session_id', session.id).eq('approval_status', 'approved');
            const formatted = (data || []).map((i) => ({ ...i, vote_count: i.votes?.[0]?.count || 0, is_selected: i.is_selected === true }));
            const groups = {};
            formatted.forEach((i) => { const key = `${i.date_served}-${i.meal_type}-${i.mess_type}`; if (!groups[key]) groups[key] = []; groups[key].push(i); });
            Object.values(groups).forEach((slotItems) => { const hasSelectionInSlot = slotItems.some(i => i.is_selected); if (!hasSelectionInSlot) { const max = Math.max(...slotItems.map((i) => i.vote_count)); slotItems.forEach((i) => { if (i.vote_count === max && max > 0) i.is_selected = true; }); } });
            setItems(formatted); setLoading(false);
        };
        fetchItems();
    }, [session.id]);

    const toggleSelection = (itemId) => setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_selected: !i.is_selected } : i));
    const setAllSelections = (selected) => setItems(prev => prev.map(i => ({ ...i, is_selected: selected })));

    const handleSave = async () => {
        setSaving(true);
        try { 
            // Save all items
            const promises = items.map(async (item) => {
                const { error } = await supabase.from('menu_items').update({ is_selected: item.is_selected }).eq('id', item.id);
                if (error) throw new Error(error.message);
            });
            await Promise.all(promises);

            // Update session status
            const { error: sessionError } = await supabase.from('voting_sessions').update({ status: 'finalized' }).eq('id', session.id);
            if (sessionError) throw new Error(sessionError.message);

            toast.success('Menu Finalized Successfully!'); 
            onClose(); 
        } catch (error) { 
            console.error("Save error:", error);
            toast.error('Error saving menu: ' + error.message); 
        } finally { 
            setSaving(false); 
        }
    };

    const grouped = items.reduce((acc, item) => { const key = `${item.date_served} | ${item.mess_type}`; if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; }, {});

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
                <div className="p-6 border-b flex justify-between items-start bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Finalize Menu</h3>
                        <p className="text-sm text-gray-500">{session.title} • Only approved items shown</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAllSelections(!allSelected)}
                        disabled={loading || items.length === 0}
                        className="px-4 py-2 text-xs font-bold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {allSelected ? 'Unselect All' : 'Select All'}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? <div>Loading...</div> : Object.entries(grouped).sort().map(([key, groupItems]) => {
                        const [date, messType] = key.split(' | ');
                        return (
                            <div key={key}>
                                <h4 className="font-bold text-gray-700 mb-3 py-2 border-b">{new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<span className="ml-2 px-2 py-0.5 rounded text-xs bg-gray-100 uppercase">{messType}</span></h4>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupItems.map((item) => (
                                        <div key={item.id} onClick={() => toggleSelection(item.id)} className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-start gap-3 ${item.is_selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}`}>
                                            <div className="flex-1"><div className="text-xs font-bold text-gray-400 uppercase mb-1">{item.meal_type}</div><div className="font-semibold text-gray-900 leading-tight mb-1">{item.name}</div><div className="text-xs text-gray-500">{item.description}</div></div>
                                            <div className="text-center min-w-[3rem]"><div className="text-lg font-bold text-indigo-600">{item.vote_count}</div><div className="text-[10px] text-gray-400 uppercase font-bold">Votes</div></div>
                                            {item.is_selected && (<div className="absolute top-2 right-2 text-indigo-600 bg-white rounded-full p-0.5 shadow-sm"><Check size={14} strokeWidth={3} /></div>)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">{saving ? 'Saving...' : 'Confirm & Finalize Menu'}</button>
                </div>
            </div>
        </div>
    );
};

const CatererManager = () => {
    const [caterers, setCaterers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { supabase.from('profiles').select('*').eq('role', 'caterer').then(({ data }) => { setCaterers(data || []); setLoading(false); }); }, []);

    const deleteCaterer = async (id, name) => {
        if (!confirm(`Remove caterer "${name}"? This will permanently delete their announcements and feedback data, and unassign their students.`)) return;
        try {
            await supabase.from('announcements').delete().eq('caterer_id', id);
            await supabase.from('feedbacks').delete().eq('caterer_id', id);
            await supabase.from('profiles').update({ assigned_caterer_id: null }).eq('assigned_caterer_id', id);
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;
            setCaterers(prev => prev.filter(c => c.id !== id));
            toast.success('Caterer and all associated data have been permanently removed.');
        } catch (err) { toast.error('Failed to remove caterer: ' + err.message); }
    };

    if (loading) return <div>Loading caterers...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-sm"><tr><th className="px-6 py-4 font-medium">Name</th><th className="px-6 py-4 font-medium">Served Mess Types</th><th className="px-6 py-4 font-medium">Registered At</th><th className="px-6 py-4 font-medium text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {caterers.length === 0 ? (<tr><td colSpan={4} className="p-8 text-center text-gray-500">No caterers found.</td></tr>) : caterers.map((cat) => (
                            <tr key={cat.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-gray-900 font-medium"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><UserCog size={16} /></div>{cat.full_name}</div></td>
                                <td className="px-6 py-4"><div className="flex gap-2 flex-wrap">{cat.served_mess_types?.map(type => (<span key={type} className="px-2 py-0.5 bg-gray-100 rounded text-xs capitalize text-gray-600 border border-gray-200">{type.replace('_', ' ')}</span>)) || <span className="text-gray-400 text-sm">None set</span>}</div></td>
                                <td className="px-6 py-4 text-gray-500 text-sm">{new Date(cat.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right"><button onClick={() => deleteCaterer(cat.id, cat.full_name)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2 ml-auto text-sm"><UserX size={16} />Remove</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SettingsModal = ({ onClose }) => {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { supabase.from('system_settings').select('*').then(({ data }) => { setSettings(data || []); setLoading(false); }); }, []);

    const toggleSetting = async (key, currentValue) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';
        setSettings(prev => prev.map(s => s.setting_key === key ? { ...s, setting_value: newValue } : s));
        await supabase.from('system_settings').update({ setting_value: newValue }).eq('setting_key', key);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-scale-in">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings size={20} />System Settings</h3></div>
                <div className="p-6 space-y-6">
                    {loading ? <div>Loading...</div> : (
                        <>
                            {[{ key: 'caterer_registration', label: 'Caterer Registration', desc: 'Allow new caterers to sign up' }, { key: 'admin_registration', label: 'Admin Registration', desc: 'Allow new admins to sign up' }].map(({ key, label, desc }) => (
                                <div key={key} className="flex items-center justify-between">
                                    <div><h4 className="font-bold text-gray-800">{label}</h4><p className="text-sm text-gray-500">{desc}</p></div>
                                    <Toggle enabled={settings.find(s => s.setting_key === key)?.setting_value === 'true'} onToggle={() => toggleSetting(key, settings.find(s => s.setting_key === key)?.setting_value || 'false')} />
                                </div>
                            ))}
                        </>
                    )}
                </div>
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end"><button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Close</button></div>
            </div>
        </div>
    );
};

const Toggle = ({ enabled, onToggle }) => (
    <div onClick={onToggle} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : ''}`} />
    </div>
);

const AdminMenuEditor = ({ session, onClose }) => {
    const slotOptions = buildSlotOptions(session.session_weeks);
    const totalSlots = getTotalSlots(session.session_weeks);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(slotOptions[0]?.value || session.start_date);
    const [mealType, setMealType] = useState('breakfast');
    const [messType, setMessType] = useState('veg');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    // CSV state
    const [csvFile, setCsvFile] = useState(null);
    const [csvParsing, setCsvParsing] = useState(false);
    const [csvUploadedIds, setCsvUploadedIds] = useState([]);
    const [deletedCsvItems, setDeletedCsvItems] = useState([]);
    const [pendingRecoveryId, setPendingRecoveryId] = useState(null);
    const [deletingAll, setDeletingAll] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ open: false, type: null, payload: null });
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [distributionMode, setDistributionMode] = useState('min-config');
    const [minMealCounts, setMinMealCounts] = useState({ breakfast: 3, lunch: 6, snacks: 2, dinner: 6 });

    const fetchItems = async () => {
        const { data } = await supabase.from('menu_items')
            .select('*')
            .eq('session_id', session.id)
            .order('date_served', { ascending: true })
            .order('meal_type', { ascending: true });
        setItems(data || []);
    };

    useEffect(() => { fetchItems(); }, [session.id]);
    useEffect(() => { if (slotOptions.length > 0) setDate(slotOptions[0].value); }, [session.id]);

    const handleSubmit = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            const { error } = await supabase.from('menu_items').insert({ 
                session_id: session.id, date_served: date, meal_type: mealType, mess_type: messType, 
                name, description, approval_status: 'approved'
            });
            if (error) throw error;
            
            // If using a recovered item, permanently remove it from the unallocated pool
            if (pendingRecoveryId) {
                setDeletedCsvItems(prev => prev.filter(i => i.id !== pendingRecoveryId));
                setPendingRecoveryId(null);
            }

            setName(''); setDescription(''); fetchItems();
            toast.success('Item added successfully');
        } catch (error) { toast.error('Failed to add item'); } finally { setLoading(false); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) setCsvFile(file);
    };

    const distributeLocally = (items, days, mode, mealCounts) => {
        const totalDays = Number(days) > 0 ? Number(days) : 14;
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const perDayCounts = {
            breakfast: Number(mealCounts?.breakfast) > 0 ? Number(mealCounts.breakfast) : 3,
            lunch: Number(mealCounts?.lunch) > 0 ? Number(mealCounts.lunch) : 6,
            snacks: Number(mealCounts?.snacks) > 0 ? Number(mealCounts.snacks) : 2,
            dinner: Number(mealCounts?.dinner) > 0 ? Number(mealCounts.dinner) : 6,
        };

        const buckets = {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: [],
            other: [],
        };

        items.forEach((item, idx) => {
            const normalizedMeal = String(item.meal_type || '').toLowerCase().trim();
            const entry = { ...item, __idx: idx };
            if (buckets[normalizedMeal]) buckets[normalizedMeal].push(entry);
            else buckets.other.push(entry);
        });

        const assignments = new Array(items.length);

        if (mode === 'equal') {
            mealOrder.forEach(meal => {
                let dayPointer = 0;
                while (buckets[meal].length > 0) {
                    const nextItem = buckets[meal].shift();
                    assignments[nextItem.__idx] = dayPointer % totalDays;
                    dayPointer += 1;
                }
            });
        } else {
            const hasPendingMealItems = () => (
                buckets.breakfast.length > 0 ||
                buckets.lunch.length > 0 ||
                buckets.snacks.length > 0 ||
                buckets.dinner.length > 0
            );

            while (hasPendingMealItems()) {
                for (let day = 0; day < totalDays; day += 1) {
                    for (const meal of mealOrder) {
                        const take = perDayCounts[meal] || 0;
                        for (let i = 0; i < take && buckets[meal].length > 0; i += 1) {
                            const nextItem = buckets[meal].shift();
                            assignments[nextItem.__idx] = day;
                        }
                    }
                    if (!hasPendingMealItems()) break;
                }
            }
        }

        buckets.other.forEach((item, idx) => {
            assignments[item.__idx] = idx % totalDays;
        });

        return items.map((item, idx) => ({
            ...item,
            day_index: Number.isInteger(assignments[idx]) ? assignments[idx] : (idx % totalDays),
        }));
    };

    const formatDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleCsvSubmit = async () => {
        if (!csvFile) return toast.error('Please select a CSV file');
        setCsvParsing(true);

        const mealCounts = {
            breakfast: Number(minMealCounts.breakfast) > 0 ? Number(minMealCounts.breakfast) : 3,
            lunch: Number(minMealCounts.lunch) > 0 ? Number(minMealCounts.lunch) : 6,
            snacks: Number(minMealCounts.snacks) > 0 ? Number(minMealCounts.snacks) : 2,
            dinner: Number(minMealCounts.dinner) > 0 ? Number(minMealCounts.dinner) : 6,
        };

        const splitCellItems = (value) => String(value || '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
        
        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                const rawItems = [];
                
                data.forEach(row => {
                    ['Breakfast', 'Lunch', 'Snacks', 'Dinner'].forEach(mt => {
                        const cellVal = row[mt] || row[mt.toLowerCase()];
                        const parsedItems = splitCellItems(cellVal);
                        parsedItems.forEach(itemName => {
                            rawItems.push({
                                meal_type: mt.toLowerCase(),
                                name: itemName,
                                description: 'Bulk Upload'
                            });
                        });
                    });
                });
                
                if (rawItems.length === 0) {
                    toast.error('No items found in CSV. Check headers.');
                    setCsvParsing(false);
                    return;
                }
                
                try {
                    toast.loading(distributionMode === 'equal' ? 'Distributing items equally...' : 'Scheduling by minimum meal counts...', { id: 'aiToast' });
                    let distributed = [];

                    try {
                        const res = await axios.post(`${API_URL}/api/ai/distribute-csv`, {
                            items: rawItems,
                            days: totalSlots,
                            distributionMode,
                            mealCounts,
                        });
                        distributed = res.data.distributed || [];
                    } catch (apiError) {
                        console.error('distribute-csv API unavailable, falling back to local scheduling:', apiError);
                        distributed = distributeLocally(rawItems, totalSlots, distributionMode, mealCounts);
                        toast('API unavailable. Scheduled locally instead.', { id: 'aiToast', icon: '⚠️' });
                    }
                    
                    // Map day_index back into proper dates
                    const dbItems = distributed.map(it => {
                        const d = new Date(slotOptions[0]?.value || '2000-01-03');
                        d.setDate(d.getDate() + (it.day_index || 0));
                        return {
                            session_id: session.id,
                            date_served: formatDateKey(d),
                            meal_type: it.meal_type,
                            mess_type: messType,
                            name: it.name,
                            description: it.description,
                            approval_status: 'approved'
                        };
                    });

                    // Insert and retrieve mapping IDs
                    const { data: insertedData, error } = await supabase.from('menu_items').insert(dbItems).select('id');
                    if (error) throw error;
                    
                    if (insertedData) {
                        setCsvUploadedIds(insertedData.map(d => d.id));
                    }

                    fetchItems();
                    toast.success(`Successfully uploaded and scheduled ${dbItems.length} items`, { id: 'aiToast' });
                } catch (err) {
                    console.error(err);
                    toast.error('Failed to distribute items via AI', { id: 'aiToast' });
                } finally {
                    setCsvParsing(false);
                }
            },
            error: (err) => {
                toast.error('Error parsing CSV');
                setCsvParsing(false);
            }
        });
    };

    const resetCsvState = () => {
        setCsvUploadedIds([]);
        setDeletedCsvItems([]);
        setPendingRecoveryId(null);
        setCsvFile(null);
        const fileInput = document.getElementById('csv-upload');
        if (fileInput) fileInput.value = '';
    };

    const handleDeleteItem = async (item) => {
        setConfirmModal({ open: true, type: 'delete-item', payload: item });
    };

    const deleteSingleItem = async (item) => {
        await supabase.from('menu_items').delete().eq('id', item.id);
        
        // Push deleted bulk item into the "Unallocated Pool"
        if (csvUploadedIds.includes(item.id)) {
            setDeletedCsvItems(prev => [...prev, item]);
        }
        await fetchItems();
    };

    const handleSelectRecoveredItem = (e) => {
        const itemId = e.target.value;
        if(!itemId) {
            setPendingRecoveryId(null);
            setName('');
            setDescription('');
            return;
        }
        const found = deletedCsvItems.find(i => i.id === itemId);
        if (found) {
            setPendingRecoveryId(found.id);
            setName(found.name);
            setMealType(found.meal_type);
            setDescription(found.description);
        }
    };

    const handleRemoveCsv = async () => {
        if (csvUploadedIds.length === 0) return;
        setConfirmModal({ open: true, type: 'remove-csv', payload: null });
    };

    const handleDeleteAllItems = async () => {
        if (items.length === 0) return;
        setConfirmModal({ open: true, type: 'delete-all', payload: null });
    };

    const handleConfirmAction = async () => {
        if (!confirmModal.type) return;
        setConfirmLoading(true);

        try {
            if (confirmModal.type === 'delete-item' && confirmModal.payload) {
                await deleteSingleItem(confirmModal.payload);
                toast.success('Item deleted successfully.');
            }

            if (confirmModal.type === 'remove-csv') {
                toast.loading('Deleting scheduled items...', { id: 'del-csv' });
                await supabase.from('menu_items').delete().in('id', csvUploadedIds);
                resetCsvState();
                await fetchItems();
                toast.success('Scheduled items removed', { id: 'del-csv' });
            }

            if (confirmModal.type === 'delete-all') {
                setDeletingAll(true);
                toast.loading('Deleting all scheduled items...', { id: 'del-all' });

                const { error } = await supabase
                    .from('menu_items')
                    .delete()
                    .eq('session_id', session.id);

                if (error) throw error;

                resetCsvState();
                await fetchItems();
                toast.success('All items deleted successfully.', { id: 'del-all' });
            }
        } catch (error) {
            if (confirmModal.type === 'delete-all') {
                toast.error('Failed to delete all items.', { id: 'del-all' });
            } else if (confirmModal.type === 'remove-csv') {
                toast.error('Failed to remove uploaded items.', { id: 'del-csv' });
            } else {
                toast.error('Failed to delete item.');
            }
        } finally {
            setDeletingAll(false);
            setConfirmLoading(false);
            setConfirmModal({ open: false, type: null, payload: null });
        }
    };

    const groupedItems = items.reduce((acc, item) => { const d = item.date_served; if (!acc[d]) acc[d] = {}; if (!acc[d][item.meal_type]) acc[d][item.meal_type] = []; acc[d][item.meal_type].push(item); return acc; }, {});

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="bg-white w-full max-w-4xl h-full shadow-xl flex flex-col animate-slide-in-right overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Admin Menu Editor</h3>
                        <p className="text-sm text-gray-500">{session.title} • Items added here are auto-approved</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    <div className="w-full md:w-2/5 p-6 border-r overflow-y-auto bg-gray-50/50 space-y-6">
                        
                        {/* CSV Upload */}
                        <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 rounded-2xl border border-indigo-100 shadow-sm relative">
                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h4 className="font-bold text-indigo-950 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" />AI Bulk Allocation</h4>
                                {csvUploadedIds.length > 0 && (
                                    <button onClick={handleRemoveCsv} className="w-full sm:w-auto justify-center text-red-600 bg-white px-3 py-2 rounded-xl hover:bg-red-50 border border-red-200 text-sm sm:text-xs font-bold transition-all shadow-sm flex gap-1.5 items-center" title="Remove CSV & Reset">
                                        <Trash size={14} /> Remove Upload
                                    </button>
                                )}
                            </div>
                            <p className="text-xs leading-5 text-indigo-700/90 block mb-4">Upload a CSV (Breakfast, Lunch, Snacks, Dinner headers). Choose equal distribution or minimum-per-day configuration.</p>
                            
                            <div className="space-y-3.5">
                                <div>
                                    <label className="block text-xs font-bold tracking-wide text-indigo-900 uppercase mb-1.5">Target Mess Type</label>
                                    <select className="w-full bg-white px-3 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm" value={messType} onChange={(e) => setMessType(e.target.value)}>
                                        <option value="veg">Veg</option><option value="non_veg">Non-Veg</option><option value="special">Special</option><option value="food_park">Food Park</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold tracking-wide text-indigo-900 uppercase mb-1.5">Distribution Mode</label>
                                    <select
                                        className="w-full bg-white px-3 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none text-sm"
                                        value={distributionMode}
                                        onChange={(e) => setDistributionMode(e.target.value)}
                                    >
                                        <option value="equal">Distribute Equally (round-robin by day)</option>
                                        <option value="min-config">Minimum Per Day Configuration</option>
                                    </select>
                                </div>
                                {distributionMode === 'min-config' && (
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Breakfast (min)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.breakfast}
                                                onChange={(e) => setMinMealCounts(prev => ({ ...prev, breakfast: e.target.value }))}
                                                className="w-full bg-white px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Lunch (min)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.lunch}
                                                onChange={(e) => setMinMealCounts(prev => ({ ...prev, lunch: e.target.value }))}
                                                className="w-full bg-white px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Snacks (min)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.snacks}
                                                onChange={(e) => setMinMealCounts(prev => ({ ...prev, snacks: e.target.value }))}
                                                className="w-full bg-white px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Dinner (min)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.dinner}
                                                onChange={(e) => setMinMealCounts(prev => ({ ...prev, dinner: e.target.value }))}
                                                className="w-full bg-white px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-200"
                                            />
                                        </div>
                                    </div>
                                )}
                                {distributionMode === 'min-config' && (
                                    <p className="text-[11px] text-indigo-800 bg-indigo-100/70 border border-indigo-200 rounded-lg px-2.5 py-2">
                                        Current minimum configuration: Lunch {minMealCounts.lunch || 6}, Breakfast {minMealCounts.breakfast || 3}, Snacks {minMealCounts.snacks || 2}, Dinner {minMealCounts.dinner || 6}.
                                    </p>
                                )}
                                <input type="file" id="csv-upload" accept=".csv" onChange={handleFileUpload} className="block w-full text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700" />
                                <button type="button" onClick={handleCsvSubmit} disabled={csvParsing || !csvFile || csvUploadedIds.length > 0} className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-xl hover:bg-indigo-700 transition-colors font-semibold disabled:bg-indigo-300 disabled:text-indigo-100 flex justify-center items-center gap-2 shadow-md">
                                    {csvParsing ? <><Loader2 size={16} className="animate-spin" /> Scheduling...</> : 'Upload & Schedule'}
                                </button>
                            </div>
                        </div>

                        {/* Manual Form */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-primary" />Manual Addition</h4>
                            
                            {deletedCsvItems.length > 0 && (
                                <div className="mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Recover Unallocated Item</label>
                                    <select onChange={handleSelectRecoveredItem} value={pendingRecoveryId || ''} className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm outline-none bg-white font-medium text-gray-800">
                                        <option value="">-- Select an item to schedule --</option>
                                        {deletedCsvItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.meal_type})</option>)}
                                    </select>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Date</label>
                                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={date} onChange={(e) => setDate(e.target.value)}>
                                        {slotOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meal</label><select className="w-full px-3 py-2 border rounded-lg outline-none text-sm" value={mealType} onChange={(e) => setMealType(e.target.value)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="snacks">Snacks</option><option value="dinner">Dinner</option></select></div>
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mess Form</label><select className="w-full px-3 py-2 border rounded-lg outline-none text-sm" value={messType} onChange={(e) => setMessType(e.target.value)}><option value="veg">Veg</option><option value="non_veg">NVeg</option><option value="special">Spl</option><option value="food_park">Park</option></select></div>
                                </div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label><input type="text" required placeholder="e.g. Masala Dosa" className="w-full px-3 py-2 border rounded-lg outline-none text-sm" value={name} onChange={(e) => setName(e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label><textarea placeholder="Ingredients, sides..." className="w-full px-3 py-2 border rounded-lg outline-none text-sm" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold flex justify-center items-center gap-2 mt-2">
                                    {loading ? <><Loader2 size={16} className="animate-spin" /> Adding...</> : 'Schedule Item'}
                                </button>
                            </form>
                        </div>
                        
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto bg-white min-h-0">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-bold text-gray-800">Scheduled Items</h4>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{items.length} items</span>
                                <button
                                    type="button"
                                    onClick={handleDeleteAllItems}
                                    disabled={deletingAll || items.length === 0}
                                    className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {deletingAll ? 'Deleting...' : 'Delete All Items'}
                                </button>
                            </div>
                        </div>
                        {items.length === 0 ? (<div className="text-center py-20 text-gray-400"><Plus size={48} className="mx-auto mb-4 opacity-20" /><p>No items added. Use manual or bulk allocator.</p></div>) : (
                            <div className="space-y-6">
                                {Object.entries(groupedItems).sort().map(([dateStr, meals]) => (
                                    <div key={dateStr} className="border rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 px-4 py-3 border-b font-bold text-gray-700">{formatSlotLabel(dateStr, session.session_weeks, 'long')}</div>
                                        <div className="divide-y">
                                            {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => { const mealItems = meals[meal] || []; if (mealItems.length === 0) return null; return (
                                                <div key={meal} className="p-4 flex gap-4 hover:bg-gray-50/50">
                                                    <div className="w-24 flex-shrink-0"><span className="text-xs font-bold uppercase text-gray-400 tracking-wider block pt-1">{meal}</span></div>
                                                    <div className="flex-1 space-y-3">
                                                        {mealItems.map((item) => (
                                                            <div key={item.id} className="flex justify-between items-start group">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.mess_type === 'veg' ? 'bg-green-500' : item.mess_type === 'non_veg' ? 'bg-orange-500' : item.mess_type === 'food_park' ? 'bg-teal-500' : 'bg-purple-500'}`}></span>
                                                                        <h5 className="font-medium text-gray-900">{item.name}</h5>
                                                                        {item.approval_status === 'approved' ? (<span className="text-[10px] px-1.5 bg-green-100 text-green-700 rounded uppercase font-bold">Approved</span>) : (<span className="text-[10px] px-1.5 bg-yellow-100 text-yellow-700 rounded uppercase font-bold">Pending</span>)}
                                                                        {csvUploadedIds.includes(item.id) && <span className="text-[10px] px-1.5 bg-indigo-50 text-indigo-500 border border-indigo-100 rounded uppercase font-bold">AI SCHEDULED</span>}
                                                                    </div>
                                                                    <p className="text-xs text-gray-500 pl-4">{item.description}</p>
                                                                </div>
                                                                <button onClick={() => handleDeleteItem(item)} className="text-gray-300 hover:text-red-500 transition-colors p-1 bg-white rounded-lg hover:shadow-sm"><Trash size={16} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ); })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {confirmModal.open && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-scale-in">
                                    <div className="p-5 border-b bg-gradient-to-r from-red-50 to-rose-50">
                                        <h4 className="text-lg font-bold text-gray-900">
                                            {confirmModal.type === 'delete-all' ? 'Delete All Scheduled Items?' : confirmModal.type === 'remove-csv' ? 'Remove Uploaded CSV Items?' : 'Delete This Item?'}
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {confirmModal.type === 'delete-all'
                                                ? 'This will remove every menu item in this session. This action cannot be undone.'
                                                : confirmModal.type === 'remove-csv'
                                                    ? 'This will delete all items created by the current bulk upload and clear the unallocated memory pool.'
                                                    : 'This will permanently remove the selected menu item.'}
                                        </p>
                                    </div>
                                    <div className="p-5 flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmModal({ open: false, type: null, payload: null })}
                                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmAction}
                                            disabled={confirmLoading || deletingAll}
                                            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
                                        >
                                            {confirmLoading || deletingAll
                                                ? 'Processing...'
                                                : confirmModal.type === 'delete-all'
                                                    ? 'Yes, Delete All'
                                                    : confirmModal.type === 'remove-csv'
                                                        ? 'Yes, Remove Upload'
                                                        : 'Yes, Delete Item'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
