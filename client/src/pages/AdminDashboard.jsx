import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Check, X, Clock, PlayCircle, StopCircle, TrendingUp, Trash, Trash2, Settings, MessageSquare, Users, UserCog, UserX, Sparkles, Loader2, XCircle, CheckCircle, Download, FileSpreadsheet, Eye, Filter, Search, MessageCircle, Send, Truck, Package, MapPin, FileText, CheckCheck, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import CustomSelect from '../components/CustomSelect';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { buildSlotOptions, formatSlotLabel, getTotalSlots } from '../utils/menuSlots';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DEFAULT_MEAL_LIMITS = { breakfast: 4, lunch: 8, snacks: 2, dinner: 8 };
const BULK_ALLOCATION_BUFFER = { breakfast: 2, lunch: 3, snacks: 1, dinner: 3 };
const MAX_BULK_ITEM_REPEATS = 3;

const getSessionMealLimit = (session, mealType) => {
    const key = `${mealType}_limit`;
    return Number(session?.[key]) > 0 ? Number(session[key]) : DEFAULT_MEAL_LIMITS[mealType];
};

const getBulkMealCounts = (session) => ({
    breakfast: getSessionMealLimit(session, 'breakfast') + BULK_ALLOCATION_BUFFER.breakfast,
    lunch: getSessionMealLimit(session, 'lunch') + BULK_ALLOCATION_BUFFER.lunch,
    snacks: getSessionMealLimit(session, 'snacks') + BULK_ALLOCATION_BUFFER.snacks,
    dinner: getSessionMealLimit(session, 'dinner') + BULK_ALLOCATION_BUFFER.dinner,
});

const formatCompactVotes = (value) => {
    const count = Number(value) || 0;
    if (count < 1000) return String(count);
    const compact = (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1);
    return `${compact}k`;
}; //format votes value from 1320 to 1.32k etc

const AdminDashboard = () => {
    const [sessions, setSessions] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [finalizingSession, setFinalizingSession] = useState(null);
    const [editingSession, setEditingSession] = useState(null);
    const [stats, setStats] = useState({ pendingFeedbacks: 0, totalVotes: 0, activeSessions: 0, pendingApprovals: 0, pendingSpecialRequests: 0 });
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
    const [breakfastLimit, setBreakfastLimit] = useState(4);
    const [lunchLimit, setLunchLimit] = useState(8);
    const [snacksLimit, setSnacksLimit] = useState(2);
    const [dinnerLimit, setDinnerLimit] = useState(8);

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
            const { count: feedbackCount } = await supabase
                .from('feedbacks')
                .select('*', { count: 'exact', head: true })
                .is('response', null)
                .or('reviewed_by_ai.is.null,reviewed_by_ai.eq.false');
            const { count: voteCount } = await supabase.from('votes').select('*', { count: 'exact', head: true });
            const { count: sessionCount } = await supabase.from('voting_sessions').select('*', { count: 'exact', head: true }).eq('status', 'open_for_voting');
            const { count: pendingCount } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending');
            const { count: specialReqCount } = await supabase.from('room_delivery_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            setStats({ 
                pendingFeedbacks: feedbackCount || 0, 
                totalVotes: voteCount || 0, 
                activeSessions: sessionCount || 0, 
                pendingApprovals: pendingCount || 0,
                pendingSpecialRequests: specialReqCount || 0
            });
        } catch (error) { console.error('Error fetching stats:', error); }
    };

    const createSession = async (e) => {
        e.preventDefault();
        if (!title.trim()) { toast.error('Please enter a session title'); return; }
        if (title.trim().length < 3) { toast.error('Session title must be at least 3 characters'); return; }
        if (!startDate || !endDate) { toast.error('Please select both start and end dates'); return; }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            toast.error('End date must be strictly after the start date.');
            return;
        }

        // Warning for date range
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        const expectedDays = Number(sessionWeeks) === 1 ? 7 : 14;
        if (Math.abs(diffDays - expectedDays) > 1) {
            if (!confirm(`Warning: The date range you selected is ${diffDays} days, but your menu cycle is set to ${sessionWeeks} week(s) (expected around ${expectedDays} days). Do you still wish to proceed?`)) {
                return;
            }
        }

        try {
            const bLim = Number(breakfastLimit) > 0 ? Number(breakfastLimit) : 4;
            const lLim = Number(lunchLimit) > 0 ? Number(lunchLimit) : 8;
            const sLim = Number(snacksLimit) > 0 ? Number(snacksLimit) : 2;
            const dLim = Number(dinnerLimit) > 0 ? Number(dinnerLimit) : 8;

            const { error } = await supabase.from('voting_sessions').insert({
                title: title.trim(),
                start_date: startDate,
                end_date: endDate,
                session_weeks: Number(sessionWeeks) === 1 ? 1 : 2,
                breakfast_limit: bLim,
                lunch_limit: lLim,
                snacks_limit: sLim,
                dinner_limit: dLim,
                status: 'draft'
            });
            if (error) throw error;
            setShowCreate(false); setTitle(''); setStartDate(''); setEndDate(''); setSessionWeeks(2);
            setBreakfastLimit(4); setLunchLimit(8); setSnacksLimit(2); setDinnerLimit(8);
            fetchSessions();
            toast.success('Voting session created successfully in Draft mode!');
        } catch { toast.error('Error creating session'); }
    };

    const updateStatus = async (id, status) => { await supabase.from('voting_sessions').update({ status }).eq('id', id); fetchSessions(); fetchStats(); };
    const deleteSession = async (id) => { if (!confirm('Are you sure? This will delete all votes and items.')) return; await supabase.from('voting_sessions').delete().eq('id', id); fetchSessions(); };
    const generatePDF = async (sessionId, messType) => { window.open(`${API_URL}/api/generate-pdf/${sessionId}/${messType}`, '_blank'); };

    const handleAISummarize = async () => {
        setSummaryLoading(true); setShowSummaryModal(true); setSummaryText('');
        try {
            const { data: feedbacks, error } = await supabase.from('feedbacks').select('*, student:profiles!student_id(full_name), caterer:profiles!caterer_id(full_name)').order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            const res = await axios.post(`${API_URL}/api/ai/summarize-feedback`, { feedbacks });//post and get summary
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
                .is('response', null)
                .or('reviewed_by_ai.is.null,reviewed_by_ai.eq.false');

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
        <>
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
                <div className="flex gap-2">
                    <button onClick={handleAISummarize} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-indigo-200"><Sparkles size={16} />AI Feedback Summary</button>
                    <button onClick={() => setShowSettings(true)} className="bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors flex items-center gap-2 font-medium"><Settings size={18} />Settings</button>
                    {activeTab === 'sessions' && (<button onClick={() => setShowCreate(true)} className="bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"><Plus size={18} />New Session</button>)}
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
                <button onClick={() => setActiveTab('sessions')} className={`pb-3 font-medium px-2 whitespace-nowrap transition-all ${activeTab === 'sessions' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>Voting Sessions</button>
                <button onClick={() => setActiveTab('approvals')} className={`pb-3 font-medium px-2 whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'approvals' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>Pending Approvals{stats.pendingApprovals > 0 && (<span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{stats.pendingApprovals}</span>)}</button>
                <button onClick={() => setActiveTab('special_requests')} className={`pb-3 font-medium px-2 whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'special_requests' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Truck size={16} /> Special Requests
                    {stats.pendingSpecialRequests > 0 && (<span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{stats.pendingSpecialRequests}</span>)}
                </button>
                <button onClick={() => setActiveTab('feedback')} className={`pb-3 font-medium px-2 whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'feedback' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>
                    <MessageSquare size={16} /> Live Feedback
                    {stats.pendingFeedbacks > 0 && (<span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{stats.pendingFeedbacks}</span>)}
                </button>
                <button onClick={() => setActiveTab('caterers')} className={`pb-3 font-medium px-2 whitespace-nowrap transition-all ${activeTab === 'caterers' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>Manage Caterers</button>
            </div>

            {activeTab === 'sessions' && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-fade-in">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-full"><PlayCircle size={20} /></div><div><p className="text-xs text-gray-500 font-medium">Active Sessions</p><h3 className="text-xl font-bold text-gray-800">{stats.activeSessions}</h3></div></div>
                    <button onClick={handleOpenPendingFeedbackModal} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 text-left hover:shadow-md hover:border-orange-200 transition-all">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><MessageSquare size={20} /></div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Pending Feedbacks</p>
                            <h3 className="text-xl font-bold text-gray-800">{stats.pendingFeedbacks}</h3>
                        </div>
                    </button>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3"><div className="p-2 bg-green-50 text-green-600 rounded-full"><Users size={20} /></div><div><p className="text-xs text-gray-500 font-medium">Total Votes</p><h3 className="text-xl font-bold text-gray-800">{formatCompactVotes(stats.totalVotes)}</h3></div></div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 flex items-center gap-3"><div className="p-2 bg-red-50 text-red-600 rounded-full"><Check size={20} /></div><div><p className="text-xs text-gray-500 font-medium">Pending Approvals</p><h3 className="text-xl font-bold text-gray-800">{stats.pendingApprovals}</h3></div></div>
                    <button onClick={() => setActiveTab('special_requests')} className="bg-white p-5 rounded-xl shadow-sm border border-amber-100 flex items-center gap-3 text-left hover:shadow-md hover:border-amber-200 transition-all">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-full"><Truck size={20} /></div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Special Requests</p>
                            <h3 className="text-xl font-bold text-gray-800">{stats.pendingSpecialRequests}</h3>
                        </div>
                    </button>
                </div>
            )}

            {activeTab === 'sessions' ? (
                <>
                    {showCreate && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 animate-fade-in relative z-20">
                            <h3 className="font-semibold text-gray-800 text-lg mb-1">Create New Voting Session</h3>
                            <p className="text-sm text-gray-500 mb-5">Set dates and configure required items per meal. Top-voted items matching these amounts will be preselected, and student voting will be limited accordingly.</p>
                            <form onSubmit={createSession} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Title *</label>
                                        <input type="text" required placeholder="e.g. August 2026 Cycle 1" className="w-full px-3 py-2 border rounded-lg" value={title} onChange={e => setTitle(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Menu Cycle *</label>
                                        <CustomSelect value={sessionWeeks} onChange={val => setSessionWeeks(Number(val))} options={[{value: 1, label: '1 Week (Mon-Sun)'}, {value: 2, label: '2 Weeks (14 Days)'}]} />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Start Date *</label>
                                            <input type="date" required className="w-full px-3 py-2 border rounded-lg text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">End Date *</label>
                                            <input type="date" required className="w-full px-3 py-2 border rounded-lg text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Meal Target Limits */}
                                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <TrendingUp size={14} /> Required Items Per Meal (Daily Targets & Voting Limits)
                                    </h4>
                                    <p className="text-xs text-indigo-700/80 mb-3">
                                        Specify how many items are needed for each meal per day. These top-voted dishes will be preselected during finalization, and students will be restricted to vote only for these amounts per day.
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">🌅 Breakfast</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="15"
                                                required
                                                className="w-full px-2.5 py-1.5 border rounded-md text-sm font-semibold text-gray-800"
                                                value={breakfastLimit}
                                                onChange={e => setBreakfastLimit(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">☀️ Lunch</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="15"
                                                required
                                                className="w-full px-2.5 py-1.5 border rounded-md text-sm font-semibold text-gray-800"
                                                value={lunchLimit}
                                                onChange={e => setLunchLimit(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">🍪 Snacks</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="15"
                                                required
                                                className="w-full px-2.5 py-1.5 border rounded-md text-sm font-semibold text-gray-800"
                                                value={snacksLimit}
                                                onChange={e => setSnacksLimit(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">🌙 Dinner</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="15"
                                                required
                                                className="w-full px-2.5 py-1.5 border rounded-md text-sm font-semibold text-gray-800"
                                                value={dinnerLimit}
                                                onChange={e => setDinnerLimit(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md">Create Session</button>
                                </div>
                            </form>
                        </div>
                    )}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 animate-slide-up">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-sm"><tr><th className="px-6 py-4 font-medium">Title</th><th className="px-6 py-4 font-medium">Dates</th><th className="px-6 py-4 font-medium">Meal Limits</th><th className="px-6 py-4 font-medium">Votes</th><th className="px-6 py-4 font-medium">Status</th><th className="px-6 py-4 font-medium text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sessions.map((session) => (
                                        <tr key={session.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900"><div className="flex items-center gap-2">{session.title}{weekBadge(session.week_label)}</div></td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">{new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-600 flex gap-1.5 flex-wrap">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono" title="Breakfast Limit">B: {session.breakfast_limit || 4}</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono" title="Lunch Limit">L: {session.lunch_limit || 8}</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono" title="Snacks Limit">S: {session.snacks_limit || 2}</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono" title="Dinner Limit">D: {session.dinner_limit || 8}</span>
                                                </div>
                                            </td>
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
            ) : activeTab === 'special_requests' ? (
                <SpecialRequestsManager onUpdated={fetchStats} />
            ) : activeTab === 'feedback' ? (
                <AdminLiveFeedbackPanel />
            ) : (
                <CatererManager />
            )}
        </div>

            {finalizingSession && (<FinalizeMenuModal session={finalizingSession} onClose={() => { setFinalizingSession(null); fetchSessions(); }} />)}
            {editingSession && (<AdminMenuEditor session={editingSession} onClose={() => { setEditingSession(null); fetchSessions(); }} />)}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

            {showSummaryModal && (
                <div className="fixed inset-0 bg-transparent backdrop-blur-md z-40 flex items-center justify-center p-4">
                    <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-xl w-full max-w-lg animate-scale-in border border-white/50">
                        <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-xl flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Sparkles size={20} className="text-indigo-500" />AI Feedback Summary</h3>
                            <button onClick={() => setShowSummaryModal(false)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            {summaryLoading ? (<div className="flex flex-col items-center py-8 text-gray-400"><Loader2 size={36} className="animate-spin text-indigo-400 mb-3" /><p className="text-sm">Gemini is analyzing student feedback...</p></div>) : (<p className="text-gray-700 leading-relaxed">{summaryText}</p>)}
                        </div>
                        <div className="p-4 border-t bg-gray-100 rounded-b-xl flex justify-end"><button onClick={() => setShowSummaryModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Close</button></div>
                    </div>
                </div>
            )}

            {showPendingFeedbackModal && (
                <div className="fixed inset-0 bg-transparent backdrop-blur-md z-40 flex items-center justify-center p-4">
                    <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-xl w-full max-w-lg animate-scale-in border border-white/50">
                        <div className="p-6 border-b bg-orange-500 rounded-t-xl flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><MessageSquare size={20} className="text-orange-500" />Pending Feedback To Address</h3>
                            <button onClick={() => setShowPendingFeedbackModal(false)} className="p-1 hover:bg-orange-200 rounded-full"><X size={20} /></button>
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
                        <div className="p-4 border-t bg-gray-100 rounded-b-xl flex justify-end">
                            <button onClick={() => setShowPendingFeedbackModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </>
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

    const handleApprove = async (id) => { setActing(id + '-approve'); try { const { error } = await supabase.from('menu_items').update({ approval_status: 'approved' }).eq('id', id); if (error) throw error; fetchPending(); onApproved(); } catch { toast.error('Failed to approve item'); } finally { setActing(null); } };
    const handleReject = async (id) => { setActing(id + '-reject'); try { const { error } = await supabase.from('menu_items').update({ approval_status: 'rejected' }).eq('id', id); if (error) throw error; fetchPending(); onApproved(); } catch { toast.error('Failed to reject item'); } finally { setActing(null); } };

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

const SpecialRequestsManager = ({ onUpdated }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [blockFilter, setBlockFilter] = useState('all');
    const [mealFilter, setMealFilter] = useState('all');
    const [acting, setActing] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [noteModal, setNoteModal] = useState(null);
    const [noteInput, setNoteInput] = useState('');

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('room_delivery_requests')
                .select(`
                    *,
                    student:profiles!student_id(full_name, reg_number, mess_type, assigned_caterer_id, hostel_block, room_number)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (err) {
            console.error('Error fetching special requests:', err);
            toast.error('Failed to load special requests');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleUpdateStatus = async (id, status, notes) => {
        setActing(id + '-' + status);
        try {
            const updates = {
                status,
                updated_at: new Date().toISOString()
            };
            if (notes !== undefined) {
                updates.admin_notes = notes;
            }

            const { error } = await supabase
                .from('room_delivery_requests')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            toast.success(`Request marked as ${status.replace(/_/g, ' ')}`);
            await fetchRequests();
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error('Error updating status:', err);
            toast.error(err.message || 'Failed to update request');
        } finally {
            setActing(null);
            setNoteModal(null);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this request permanently?')) return;
        setActing(id + '-delete');
        try {
            const { error } = await supabase
                .from('room_delivery_requests')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Request deleted');
            await fetchRequests();
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error('Error deleting request:', err);
            toast.error(err.message || 'Failed to delete');
        } finally {
            setActing(null);
        }
    };

    const statusBadge = {
        pending: { label: 'Pending Review', color: 'text-amber-800 bg-amber-50 border-amber-200', icon: Clock },
        approved: { label: 'Approved', color: 'text-blue-800 bg-blue-50 border-blue-200', icon: CheckCircle },
        rejected: { label: 'Rejected', color: 'text-red-800 bg-red-50 border-red-200', icon: XCircle },
        packed: { label: 'Packed', color: 'text-purple-800 bg-purple-50 border-purple-200', icon: Package },
        out_for_delivery: { label: 'Out for Delivery', color: 'text-orange-800 bg-orange-50 border-orange-200', icon: Truck },
        delivered: { label: 'Delivered', color: 'text-emerald-800 bg-emerald-50 border-emerald-200', icon: CheckCheck }
    };

    const filtered = requests.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (blockFilter !== 'all' && r.hostel_block !== blockFilter) return false;
        if (mealFilter !== 'all' && r.meal_type !== mealFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            const studentName = (r.student?.full_name || '').toLowerCase();
            const regNumber = (r.student?.reg_number || '').toLowerCase();
            const roomNumber = (r.room_number || '').toLowerCase();
            const reason = (r.reason || '').toLowerCase();
            const notes = (r.admin_notes || '').toLowerCase();
            return studentName.includes(q) || regNumber.includes(q) || roomNumber.includes(q) || reason.includes(q) || notes.includes(q);
        }
        return true;
    });

    const counts = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        inTransit: requests.filter(r => r.status === 'packed' || r.status === 'out_for_delivery').length,
        delivered: requests.filter(r => r.status === 'delivered').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header / Summary row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Truck className="text-primary" size={22} /> Special Room Delivery Requests
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        Review, approve, or reject medical & illness meal delivery requests from students.
                    </p>
                </div>
                <button
                    onClick={fetchRequests}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Quick Status Stats Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { key: 'all', label: 'All Requests', count: counts.total, color: 'border-gray-200 bg-white text-gray-700' },
                    { key: 'pending', label: 'Pending Review', count: counts.pending, color: 'border-amber-200 bg-amber-50/70 text-amber-800' },
                    { key: 'approved', label: 'Approved', count: counts.approved, color: 'border-blue-200 bg-blue-50/70 text-blue-800' },
                    { key: 'inTransit', label: 'In Delivery', count: counts.inTransit, color: 'border-purple-200 bg-purple-50/70 text-purple-800' },
                    { key: 'delivered', label: 'Delivered', count: counts.delivered, color: 'border-emerald-200 bg-emerald-50/70 text-emerald-800' },
                    { key: 'rejected', label: 'Rejected', count: counts.rejected, color: 'border-red-200 bg-red-50/70 text-red-800' }
                ].map((stat) => (
                    <button
                        key={stat.key}
                        onClick={() => setStatusFilter(stat.key === 'inTransit' ? 'packed' : stat.key)}
                        className={`p-3 rounded-xl border text-left transition-all ${stat.color} ${
                            (statusFilter === stat.key || (stat.key === 'inTransit' && (statusFilter === 'packed' || statusFilter === 'out_for_delivery')))
                                ? 'ring-2 ring-primary shadow-sm font-bold'
                                : 'hover:shadow-xs'
                        }`}
                    >
                        <p className="text-[11px] font-medium opacity-80">{stat.label}</p>
                        <p className="text-xl font-extrabold mt-0.5">{stat.count}</p>
                    </button>
                ))}
            </div>

            {/* Filters & Search Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search student, reg #, room, reason..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                </div>

                <div className="flex flex-wrap gap-2 items-center text-xs">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:outline-none focus:border-primary"
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="packed">Packed</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    <select
                        value={blockFilter}
                        onChange={(e) => setBlockFilter(e.target.value)}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:outline-none focus:border-primary"
                    >
                        <option value="all">All Blocks</option>
                        {['A', 'B', 'C', 'D', 'E'].map(b => (
                            <option key={b} value={b}>Block {b}</option>
                        ))}
                    </select>

                    <select
                        value={mealFilter}
                        onChange={(e) => setMealFilter(e.target.value)}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:outline-none focus:border-primary"
                    >
                        <option value="all">All Meals</option>
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="snacks">Snacks</option>
                        <option value="dinner">Dinner</option>
                    </select>

                    {(search || statusFilter !== 'all' || blockFilter !== 'all' || mealFilter !== 'all') && (
                        <button
                            onClick={() => { setSearch(''); setStatusFilter('all'); setBlockFilter('all'); setMealFilter('all'); }}
                            className="px-2.5 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">
                    <Loader2 size={32} className="animate-spin mx-auto text-primary mb-2" />
                    <p className="text-sm">Loading special requests...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                    <Truck size={40} className="mx-auto text-gray-300 mb-2" />
                    <h4 className="text-base font-bold text-gray-800">No Special Requests Found</h4>
                    <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mt-1">
                        {requests.length === 0 
                            ? 'No students have submitted meal delivery requests yet.'
                            : 'No requests match your current filters.'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filtered.map((req) => {
                        const badge = statusBadge[req.status] || statusBadge.pending;
                        const StatusIcon = badge.icon;
                        const studentName = req.student?.full_name || 'Student';
                        const regNo = req.student?.reg_number || 'N/A';

                        return (
                            <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-4 sm:p-5 transition-shadow hover:shadow-md">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-100 shrink-0">
                                            {studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-gray-900 text-sm sm:text-base">{studentName}</h4>
                                                <span className="text-xs text-gray-400">({regNo})</span>
                                                {req.student?.mess_type && (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 capitalize font-medium">
                                                        {req.student.mess_type.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                <MapPin size={12} className="text-gray-400" />
                                                Hostel Block <strong>{req.hostel_block}</strong> • Room <strong>{req.room_number}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                                            <StatusIcon size={13} /> {badge.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Body details */}
                                <div className="grid sm:grid-cols-3 gap-4 py-3.5 text-xs">
                                    <div>
                                        <p className="text-gray-400 uppercase font-semibold text-[10px]">Meal & Delivery Date</p>
                                        <p className="font-bold text-gray-800 text-sm mt-0.5 capitalize">
                                            {req.meal_type}
                                        </p>
                                        <p className="text-gray-500 mt-0.5">
                                            {new Date(`${req.date}T00:00:00`).toLocaleDateString('en-US', {
                                                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                            })}
                                        </p>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <p className="text-gray-400 uppercase font-semibold text-[10px]">Reason for Request</p>
                                        <p className="text-gray-700 mt-0.5 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
                                            {req.reason}
                                        </p>
                                    </div>
                                </div>

                                {/* Proof attachment & admin notes */}
                                {(req.proof_image_url || req.admin_notes) && (
                                    <div className="flex flex-col sm:flex-row gap-3 pt-1 pb-3 text-xs">
                                        {req.proof_image_url && (
                                            <button
                                                onClick={() => setPreviewImage(req.proof_image_url)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold border border-blue-200/70 transition-colors w-fit"
                                            >
                                                <Eye size={13} /> View Attached Medical Proof
                                            </button>
                                        )}

                                        {req.admin_notes && (
                                            <div className="flex-1 bg-amber-50/70 border border-amber-200/70 rounded-lg p-2.5 text-amber-900">
                                                <span className="font-bold">Admin Note: </span>{req.admin_notes}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-1">
                                    <span className="text-[11px] text-gray-400">
                                        Submitted {new Date(req.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {req.status === 'pending' ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setNoteModal({ id: req.id, targetStatus: 'approved', studentName });
                                                        setNoteInput(req.admin_notes || 'Approved for room delivery');
                                                    }}
                                                    disabled={acting === req.id + '-approved'}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                                >
                                                    {acting === req.id + '-approved' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                                    Approve Request
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setNoteModal({ id: req.id, targetStatus: 'rejected', studentName });
                                                        setNoteInput(req.admin_notes || '');
                                                    }}
                                                    disabled={acting === req.id + '-rejected'}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    {acting === req.id + '-rejected' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                                                    Reject
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setNoteModal({ id: req.id, targetStatus: req.status, studentName, isEditingNoteOnly: true });
                                                        setNoteInput(req.admin_notes || '');
                                                    }}
                                                    className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-medium border border-gray-200"
                                                >
                                                    Edit Note
                                                </button>

                                                <select
                                                    value={req.status}
                                                    onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                                                    className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 font-medium text-gray-700 focus:outline-none"
                                                >
                                                    <option value="pending">Set Pending</option>
                                                    <option value="approved">Set Approved</option>
                                                    <option value="packed">Set Packed</option>
                                                    <option value="out_for_delivery">Set In Delivery</option>
                                                    <option value="delivered">Set Delivered</option>
                                                    <option value="rejected">Set Rejected</option>
                                                </select>
                                            </>
                                        )}

                                        <button
                                            onClick={() => handleDelete(req.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Request"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Note & Confirmation Modal */}
            {noteModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100">
                        <h4 className="text-lg font-bold text-gray-900 mb-1">
                            {noteModal.isEditingNoteOnly
                                ? 'Update Admin Note'
                                : noteModal.targetStatus === 'approved'
                                ? `Approve Request for ${noteModal.studentName}`
                                : `Reject Request for ${noteModal.studentName}`}
                        </h4>
                        <p className="text-xs text-gray-500 mb-4">
                            {noteModal.isEditingNoteOnly
                                ? 'This note will be visible to the student and delivery staff.'
                                : `Add an optional note explaining the ${noteModal.targetStatus} decision.`}
                        </p>

                        <textarea
                            rows={3}
                            placeholder={noteModal.targetStatus === 'rejected' ? 'Enter reason for rejection (e.g. proof invalid)...' : 'Add admin note...'}
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
                        />

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setNoteModal(null)}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleUpdateStatus(noteModal.id, noteModal.targetStatus, noteInput.trim())}
                                disabled={!!acting}
                                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors ${
                                    noteModal.targetStatus === 'rejected'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                {noteModal.isEditingNoteOnly ? 'Save Note' : `Confirm ${noteModal.targetStatus}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                                <FileText size={16} /> Attached Proof Document / Prescription
                            </h4>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewImage}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary font-semibold hover:underline"
                                >
                                    Open original
                                </a>
                                <button onClick={() => setPreviewImage(null)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-gray-50 rounded-xl p-2 border border-gray-100">
                            <img src={previewImage} alt="Medical Proof" className="max-w-full h-auto object-contain rounded-lg" />
                        </div>
                    </div>
                </div>
            )}
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

    const getMealLimit = useCallback((mealType) => {
        const key = `${mealType}_limit`;
        return Number(session?.[key]) > 0 ? Number(session[key]) : (DEFAULT_MEAL_LIMITS[mealType] || 4);
    }, [session]);

    const applyTopVotedSelections = useCallback((itemsList) => {
        const groups = {};
        itemsList.forEach((i) => {
            const key = `${i.date_served}-${i.meal_type}-${i.mess_type}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        const selectedIds = new Set();
        Object.values(groups).forEach((slotItems) => {
            const mealType = slotItems[0]?.meal_type || 'breakfast';
            const limit = getMealLimit(mealType);
            const sorted = [...slotItems].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0) || a.name.localeCompare(b.name));
            sorted.slice(0, limit).forEach(i => selectedIds.add(i.id));
        });

        return itemsList.map(i => ({ ...i, is_selected: selectedIds.has(i.id) }));
    }, [getMealLimit]);

    useEffect(() => {
        const fetchItems = async () => {
            const { data } = await supabase.from('menu_items').select('*, votes(count)').eq('session_id', session.id).eq('approval_status', 'approved');
            const formatted = (data || []).map((i) => ({ ...i, vote_count: i.votes?.[0]?.count || 0, is_selected: i.is_selected === true }));
            
            const hasExistingSelection = formatted.some(i => i.is_selected);
            if (!hasExistingSelection) {
                setItems(applyTopVotedSelections(formatted));
            } else {
                setItems(formatted);
            }
            setLoading(false);
        };
        fetchItems();
    }, [session.id, applyTopVotedSelections]);

    const toggleSelection = (itemId) => setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_selected: !i.is_selected } : i));
    const setAllSelections = (selected) => setItems(prev => prev.map(i => ({ ...i, is_selected: selected })));
    const resetToTopVoted = () => {
        setItems(prev => applyTopVotedSelections(prev));
        toast.success('Preselected top-voted items according to session meal limits!');
    };

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
        <div className="fixed inset-0 bg-transparent backdrop-blur-md z-40 flex items-center justify-center p-4">
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in border border-white/50">
                <div className="p-6 border-b flex justify-between items-start bg-gray-50 rounded-t-xl flex-wrap gap-3">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Finalize Menu</h3>
                        <p className="text-sm text-gray-500">{session.title} • Top-voted items preselected (Limits: B:{session.breakfast_limit || 4}, L:{session.lunch_limit || 8}, S:{session.snacks_limit || 2}, D:{session.dinner_limit || 8})</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetToTopVoted}
                            disabled={loading || items.length === 0}
                            className="px-3 py-2 text-xs font-bold rounded-lg border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                            <TrendingUp size={14} /> Auto-Pick Top Voted
                        </button>
                        <button
                            type="button"
                            onClick={() => setAllSelections(!allSelected)}
                            disabled={loading || items.length === 0}
                            className="px-3 py-2 text-xs font-bold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                        >
                            {allSelected ? 'Unselect All' : 'Select All'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? <div>Loading...</div> : Object.entries(grouped).sort().map(([key, groupItems]) => {
                        const [date, messType] = key.split(' | ');
                        return (
                            <div key={key}>
                                <h4 className="font-bold text-gray-700 mb-3 py-2 border-b flex items-center justify-between">
                                    <span>
                                        {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-gray-100 uppercase">{messType}</span>
                                    </span>
                                </h4>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupItems.map((item) => (
                                        <div key={item.id} onClick={() => toggleSelection(item.id)} className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-start gap-3 ${item.is_selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-100 hover:border-gray-300'}`}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">{item.meal_type}</span>
                                                    <span className="text-[10px] text-gray-400">Target: {getMealLimit(item.meal_type)}</span>
                                                </div>
                                                <div className="font-semibold text-gray-900 leading-tight mb-1">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.description}</div>
                                            </div>
                                            <div className="text-center min-w-[3rem]">
                                                <div className="text-lg font-bold text-indigo-600">{item.vote_count}</div>
                                                <div className="text-[10px] text-gray-400 uppercase font-bold">Votes</div>
                                            </div>
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

const ExportFeedbackModal = ({ caterers, onClose }) => {
    const [exportRange, setExportRange] = useState('all'); // 'all', 'current_month', 'custom_month'
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [selectedCaterer, setSelectedCaterer] = useState('all');
    const [feedbackType, setFeedbackType] = useState('all');
    const [exporting, setExporting] = useState(false);
    const [previewCount, setPreviewCount] = useState(null);
    const [loadingCount, setLoadingCount] = useState(false);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const fetchMatchingCount = useCallback(async () => {
        setLoadingCount(true);
        try {
            let query = supabase.from('feedbacks').select('*', { count: 'exact', head: true });
            
            if (selectedCaterer !== 'all') {
                query = query.eq('caterer_id', selectedCaterer);
            }
            if (feedbackType !== 'all') {
                query = query.eq('feedback_type', feedbackType);
            }
            if (exportRange === 'current_month') {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                query = query.gte('created_at', start + 'T00:00:00.000Z').lte('created_at', end + 'T23:59:59.999Z');
            } else if (exportRange === 'custom_month') {
                const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
                const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
                query = query.gte('created_at', start + 'T00:00:00.000Z').lte('created_at', end + 'T23:59:59.999Z');
            }

            const { count, error } = await query;
            if (error) throw error;
            setPreviewCount(count || 0);
        } catch (err) {
            console.error('Count error:', err);
            setPreviewCount(0);
        } finally {
            setLoadingCount(false);
        }
    }, [exportRange, selectedMonth, selectedYear, selectedCaterer, feedbackType]);

    useEffect(() => {
        fetchMatchingCount();
    }, [fetchMatchingCount]);

    const handleExport = async () => {
        setExporting(true);
        try {
            let query = supabase
                .from('feedbacks')
                .select('*, student:profiles!student_id(full_name, reg_number, mess_type), caterer:profiles!caterer_id(full_name)')
                .order('created_at', { ascending: false });

            if (selectedCaterer !== 'all') {
                query = query.eq('caterer_id', selectedCaterer);
            }
            if (feedbackType !== 'all') {
                query = query.eq('feedback_type', feedbackType);
            }
            if (exportRange === 'current_month') {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                query = query.gte('created_at', start + 'T00:00:00.000Z').lte('created_at', end + 'T23:59:59.999Z');
            } else if (exportRange === 'custom_month') {
                const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
                const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
                query = query.gte('created_at', start + 'T00:00:00.000Z').lte('created_at', end + 'T23:59:59.999Z');
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.error('No feedback records found for the selected criteria');
                setExporting(false);
                return;
            }

            const excelRows = data.map((fb, idx) => ({
                'S.No': idx + 1,
                'Feedback Date': fb.feedback_date || (fb.created_at ? new Date(fb.created_at).toLocaleDateString('en-IN') : 'N/A'),
                'Day': fb.day_label || (fb.created_at ? new Date(fb.created_at).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A'),
                'Meal Type': fb.meal_type ? fb.meal_type.toUpperCase() : 'GENERAL',
                'Feedback Type': fb.feedback_type === 'daily_food' ? 'Daily Food Feedback' : 'General Feedback',
                'Caterer Name': fb.caterer?.full_name || 'N/A',
                'Student Name': fb.student?.full_name || 'Anonymous Student',
                'Student Reg Number': fb.student?.reg_number || 'N/A',
                'Student Mess Type': fb.student?.mess_type ? fb.student.mess_type.replace('_', ' ').toUpperCase() : 'N/A',
                'Feedback Message': fb.message || '',
                'Photo Attached': fb.image_url ? 'YES' : 'NO',
                'Photo URL': fb.image_url || '',
                'Caterer Response': fb.response || 'Pending Response',
                'Response Status': fb.response ? 'Responded' : 'Pending',
                'Submitted At': fb.created_at ? new Date(fb.created_at).toLocaleString('en-IN') : 'N/A',
            }));

            const ws = XLSX.utils.json_to_sheet(excelRows);
            ws['!cols'] = [
                { wch: 6 },  // S.No
                { wch: 14 }, // Feedback Date
                { wch: 12 }, // Day
                { wch: 12 }, // Meal Type
                { wch: 22 }, // Feedback Type
                { wch: 22 }, // Caterer Name
                { wch: 24 }, // Student Name
                { wch: 18 }, // Student Reg Number
                { wch: 18 }, // Student Mess Type
                { wch: 50 }, // Feedback Message
                { wch: 14 }, // Photo Attached
                { wch: 35 }, // Photo URL
                { wch: 35 }, // Caterer Response
                { wch: 16 }, // Response Status
                { wch: 22 }, // Submitted At
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Feedbacks');

            let rangeLabel = 'All_Time';
            if (exportRange === 'current_month') {
                rangeLabel = `${months[new Date().getMonth()]}_${new Date().getFullYear()}`;
            } else if (exportRange === 'custom_month') {
                rangeLabel = `${months[selectedMonth]}_${selectedYear}`;
            }
            const fileName = `FeastFull_Feedbacks_${rangeLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

            XLSX.writeFile(wb, fileName);
            toast.success(`Exported ${excelRows.length} feedbacks to ${fileName}!`);
            onClose();
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Failed to export feedback: ' + (err.message || 'Unknown error'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-transparent backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in border border-white/60 overflow-hidden">
                <div className="p-6 border-b bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-6 h-6" />
                        <div>
                            <h3 className="text-lg font-bold">Export Feedbacks to Excel</h3>
                            <p className="text-xs text-emerald-100">Download formatted .xlsx report</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Time Scope</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'all', label: 'Whole History' },
                                { id: 'current_month', label: 'Current Month' },
                                { id: 'custom_month', label: 'Select Month' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setExportRange(opt.id)}
                                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                                        exportRange === opt.id
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {exportRange === 'custom_month' && (
                        <div className="flex gap-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 animate-slide-down">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-emerald-800 mb-1">Month</label>
                                <CustomSelect
                                    value={selectedMonth}
                                    onChange={val => setSelectedMonth(Number(val))}
                                    options={months.map((m, idx) => ({ value: idx, label: m }))}
                                />
                            </div>
                            <div className="w-28">
                                <label className="block text-xs font-bold text-emerald-800 mb-1">Year</label>
                                <CustomSelect
                                    value={selectedYear}
                                    onChange={val => setSelectedYear(Number(val))}
                                    options={years.map(y => ({ value: y, label: String(y) }))}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Caterer</label>
                        <CustomSelect
                            value={selectedCaterer}
                            onChange={val => setSelectedCaterer(val)}
                            options={[
                                { value: 'all', label: '🏢 All Caterers' },
                                ...caterers.map(c => ({ value: c.id, label: c.full_name }))
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Feedback Type</label>
                        <CustomSelect
                            value={feedbackType}
                            onChange={val => setFeedbackType(val)}
                            options={[
                                { value: 'all', label: '📋 All Feedback Types' },
                                { value: 'daily_food', label: "🍽️ Today's Daily Food Feedback" },
                                { value: 'general', label: '💬 General Feedback' }
                            ]}
                        />
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-600">
                        <span>Records to export:</span>
                        <span className="font-bold text-sm text-gray-900">
                            {loadingCount ? 'Counting...' : `${previewCount ?? 0} record${previewCount !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50/80 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting || loadingCount || previewCount === 0}
                        className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all"
                    >
                        {exporting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Generating...
                            </>
                        ) : (
                            <>
                                <Download size={16} /> Download Excel (.xlsx)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminLiveFeedbackPanel = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [caterers, setCaterers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCaterer, setSelectedCaterer] = useState('all');
    const [feedbackType, setFeedbackType] = useState('all');
    const [selectedMeal, setSelectedMeal] = useState('all');
    const [selectedDate, setSelectedDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [replyInputs, setReplyInputs] = useState({});
    const [submittingReply, setSubmittingReply] = useState(null);

    useEffect(() => {
        supabase.from('profiles').select('id, full_name').eq('role', 'caterer')
            .then(({ data }) => setCaterers(data || []));
    }, []);

    const fetchFeedbacks = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('feedbacks')
                .select('*, student:profiles!student_id(full_name, reg_number, mess_type), caterer:profiles!caterer_id(full_name)')
                .order('created_at', { ascending: false });

            if (selectedCaterer !== 'all') query = query.eq('caterer_id', selectedCaterer);
            if (feedbackType !== 'all') query = query.eq('feedback_type', feedbackType);
            if (selectedMeal !== 'all') query = query.eq('meal_type', selectedMeal);
            if (selectedDate) query = query.eq('feedback_date', selectedDate);
            if (statusFilter === 'pending') query = query.is('response', null).or('reviewed_by_ai.is.null,reviewed_by_ai.eq.false');
            if (statusFilter === 'ai_reviewed') query = query.is('response', null).eq('reviewed_by_ai', true);
            if (statusFilter === 'responded') query = query.not('response', 'is', null);

            const { data, error } = await query;
            if (error) throw error;
            setFeedbacks(data || []);
        } catch (err) {
            console.error('Error fetching feedbacks:', err);
            toast.error('Failed to load feedbacks');
        } finally {
            setLoading(false);
        }
    }, [selectedCaterer, feedbackType, selectedMeal, selectedDate, statusFilter]);

    useEffect(() => {
        fetchFeedbacks();
    }, [fetchFeedbacks]);

    const handleAISummarize = async () => {
        if (feedbacks.length === 0) {
            toast.error('No feedbacks available in current filter to summarize');
            return;
        }
        setSummaryLoading(true);
        setShowSummaryModal(true);
        setSummaryText('');
        try {
            const res = await axios.post(`${API_URL}/api/ai/summarize-daily-feedback`, {
                feedbacks: feedbacks.slice(0, 50),
                date: selectedDate || 'Selected Period',
                mealType: selectedMeal !== 'all' ? selectedMeal : 'all',
            });
            setSummaryText(res.data.summary);
        } catch (err) {
            setSummaryText('Failed to generate summary: ' + (err.response?.data?.error || err.message));
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleAdminReply = async (feedbackId) => {
        const reply = replyInputs[feedbackId]?.trim();
        if (!reply) return;
        setSubmittingReply(feedbackId);
        try {
            const { error } = await supabase.from('feedbacks').update({ response: reply }).eq('id', feedbackId);
            if (error) throw error;
            toast.success('Response saved!');
            setReplyInputs(prev => ({ ...prev, [feedbackId]: '' }));
            fetchFeedbacks();
        } catch (err) {
            toast.error('Failed to save response: ' + err.message);
        } finally {
            setSubmittingReply(null);
        }
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!confirm('Are you sure you want to delete this feedback?')) return;
        try {
            const { error } = await supabase.from('feedbacks').delete().eq('id', feedbackId);
            if (error) throw error;
            toast.success('Feedback deleted');
            setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
        } catch {
            toast.error('Failed to delete feedback');
        }
    };

    const filteredFeedbacks = feedbacks.filter(fb => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            fb.message?.toLowerCase().includes(q) ||
            fb.student?.full_name?.toLowerCase().includes(q) ||
            fb.student?.reg_number?.toLowerCase().includes(q) ||
            fb.caterer?.full_name?.toLowerCase().includes(q) ||
            fb.meal_type?.toLowerCase().includes(q) ||
            fb.day_label?.toLowerCase().includes(q)
        );
    });

    const pendingCount = feedbacks.filter(f => !f.response && !f.reviewed_by_ai).length;
    const aiReviewedCount = feedbacks.filter(f => !f.response && f.reviewed_by_ai).length;
    const respondedCount = feedbacks.filter(f => f.response).length;
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Action Controls */}
            <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2.5">
                        <MessageSquare className="w-7 h-7" /> Live Feedback Feed
                    </h3>
                    <p className="text-sm opacity-90 mt-1">
                        Monitor real-time student food ratings, photos, caterer responses, and export Excel reports.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={handleAISummarize}
                        disabled={feedbacks.length === 0}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white py-2 px-4 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-white/20 shadow-sm disabled:opacity-50"
                    >
                        <Sparkles size={16} /> AI Summary
                    </button>
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                    >
                        <FileSpreadsheet size={16} /> Export to Excel
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><MessageCircle size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Total Feedback</p>
                        <h4 className="text-lg font-bold text-gray-900">{feedbacks.length}</h4>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl"><Clock size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Pending Action</p>
                        <h4 className="text-lg font-bold text-orange-600">{pendingCount}</h4>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl"><Sparkles size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">AI Reviewed</p>
                        <h4 className="text-lg font-bold text-purple-600">{aiReviewedCount}</h4>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Responded</p>
                        <h4 className="text-lg font-bold text-emerald-600">{respondedCount}</h4>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <Filter size={16} className="text-primary" /> Filter Options
                    </div>
                    {(selectedCaterer !== 'all' || feedbackType !== 'all' || selectedMeal !== 'all' || selectedDate || statusFilter !== 'all' || searchQuery) && (
                        <button
                            onClick={() => {
                                setSelectedCaterer('all');
                                setFeedbackType('all');
                                setSelectedMeal('all');
                                setSelectedDate('');
                                setStatusFilter('all');
                                setSearchQuery('');
                            }}
                            className="text-xs text-primary font-semibold hover:underline"
                        >
                            Reset All Filters
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Caterer</label>
                        <CustomSelect
                            value={selectedCaterer}
                            onChange={val => setSelectedCaterer(val)}
                            options={[
                                { value: 'all', label: 'All Caterers' },
                                ...caterers.map(c => ({ value: c.id, label: c.full_name }))
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Type</label>
                        <CustomSelect
                            value={feedbackType}
                            onChange={val => setFeedbackType(val)}
                            options={[
                                { value: 'all', label: 'All Types' },
                                { value: 'daily_food', label: "Daily Food" },
                                { value: 'general', label: 'General' }
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Meal</label>
                        <CustomSelect
                            value={selectedMeal}
                            onChange={val => setSelectedMeal(val)}
                            options={[
                                { value: 'all', label: 'All Meals' },
                                { value: 'breakfast', label: 'Breakfast' },
                                { value: 'lunch', label: 'Lunch' },
                                { value: 'snacks', label: 'Snacks' },
                                { value: 'dinner', label: 'Dinner' }
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Status</label>
                        <CustomSelect
                            value={statusFilter}
                            onChange={val => setStatusFilter(val)}
                            options={[
                                { value: 'all', label: 'All Status' },
                                { value: 'pending', label: '⏳ Pending Action' },
                                { value: 'ai_reviewed', label: '🤖 AI Reviewed' },
                                { value: 'responded', label: '✓ Responded' }
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Search</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Student, reg #, dish..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Feedbacks List */}
            {loading ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                    <Loader2 size={36} className="animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading student feedbacks...</p>
                </div>
            ) : filteredFeedbacks.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                    <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
                    <h4 className="text-base font-bold text-gray-700">No Feedback Matches Found</h4>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting the filter criteria or check back later.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredFeedbacks.map(fb => (
                        <div key={fb.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                        {fb.student?.full_name?.[0] || 'S'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-gray-900">{fb.student?.full_name || 'Anonymous Student'}</span>
                                            {fb.student?.reg_number && (
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-mono">
                                                    {fb.student.reg_number}
                                                </span>
                                            )}
                                            {fb.student?.mess_type && (
                                                <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full capitalize font-medium">
                                                    {fb.student.mess_type.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Assigned Caterer: <strong className="text-gray-600">{fb.caterer?.full_name || 'N/A'}</strong>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                                        fb.feedback_type === 'daily_food' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        {fb.feedback_type === 'daily_food' ? '🍽️ Daily Food' : '💬 General'}
                                    </span>
                                    {fb.meal_type && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full capitalize font-medium">
                                            {fb.meal_type}
                                        </span>
                                    )}
                                    {fb.response ? (
                                        <span className="px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800">
                                            ✓ Responded
                                        </span>
                                    ) : fb.reviewed_by_ai ? (
                                        <span className="px-2 py-0.5 rounded-full font-bold uppercase bg-purple-100 text-purple-800 flex items-center gap-1">
                                            <Sparkles size={11} /> AI Reviewed
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full font-bold uppercase bg-orange-100 text-orange-800">
                                            ⏳ Pending
                                        </span>
                                    )}
                                    <span className="text-gray-400">
                                        {fb.feedback_date || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '')} {fb.day_label ? `(${fb.day_label})` : ''}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteFeedback(fb.id)}
                                        title="Delete Feedback"
                                        className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <p className="text-gray-700 text-sm bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 leading-relaxed">
                                &ldquo;{fb.message}&rdquo;
                            </p>

                            {fb.image_url && (
                                <div className="mt-3 flex items-center gap-3">
                                    <img
                                        src={fb.image_url}
                                        alt="Food"
                                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => setExpandedImage(fb.image_url)}
                                    />
                                    <button
                                        onClick={() => setExpandedImage(fb.image_url)}
                                        className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                                    >
                                        <Eye size={14} /> View full photo
                                    </button>
                                </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-gray-100">
                                {fb.response ? (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                                        <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-emerald-800 uppercase tracking-wide text-[10px]">Caterer Response</p>
                                            <p className="text-emerald-900 text-sm mt-0.5">{fb.response}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Write admin reply or note on caterer's behalf..."
                                            value={replyInputs[fb.id] || ''}
                                            onChange={e => setReplyInputs({ ...replyInputs, [fb.id]: e.target.value })}
                                            className="flex-1 border rounded-lg px-3 py-1.5 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <button
                                            onClick={() => handleAdminReply(fb.id)}
                                            disabled={submittingReply === fb.id || !replyInputs[fb.id]}
                                            className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                        >
                                            {submittingReply === fb.id ? 'Saving...' : <><Send size={12} /> Reply</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {expandedImage && (
                <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setExpandedImage(null)}>
                    <div className="relative max-w-2xl max-h-[85vh]">
                        <img src={expandedImage} alt="Food photo full" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
                        <button onClick={() => setExpandedImage(null)} className="absolute -top-3 -right-3 bg-white text-gray-800 p-1.5 rounded-full shadow-lg hover:bg-gray-100">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {showSummaryModal && (
                <div className="fixed inset-0 bg-transparent backdrop-blur-md z-40 flex items-center justify-center p-4">
                    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in border border-white/60">
                        <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles size={20} />AI Feedback Analysis</h3>
                            <button onClick={() => setShowSummaryModal(false)} className="p-1 hover:bg-white/20 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            {summaryLoading ? (
                                <div className="flex flex-col items-center py-8 text-gray-400">
                                    <Loader2 size={36} className="animate-spin text-indigo-500 mb-3" />
                                    <p className="text-sm font-medium">Gemini is analyzing student feedbacks...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {summaryText}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end">
                            <button onClick={() => setShowSummaryModal(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-xl font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <ExportFeedbackModal caterers={caterers} onClose={() => setShowExportModal(false)} />
            )}
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
        <div className="fixed inset-0 bg-transparent backdrop-blur-md z-40 flex items-center justify-center p-4">
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-xl w-full max-w-md animate-scale-in border border-white/50">
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
    const firstSlotValue = slotOptions[0]?.value;
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
    const [minMealCounts, setMinMealCounts] = useState(() => getBulkMealCounts(session));

    const fetchItems = useCallback(async () => {
        const { data } = await supabase.from('menu_items')
            .select('*')
            .eq('session_id', session.id)
            .order('date_served', { ascending: true })
            .order('meal_type', { ascending: true });
        setItems(data || []);
    }, [session.id]);

    useEffect(() => { fetchItems(); }, [fetchItems]);
    useEffect(() => { if (firstSlotValue) setDate(firstSlotValue); }, [session.id, firstSlotValue]);
    useEffect(() => { setMinMealCounts(getBulkMealCounts(session)); }, [session]);

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        if (!name.trim()) { toast.error('Please enter the dish name'); return; }
        if (name.trim().length < 3) { toast.error('Dish name must be at least 3 characters'); return; }
        if (name.trim().length > 100) { toast.error('Dish name must be under 100 characters'); return; }
        if (description.trim().length > 200) { toast.error('Description must be under 200 characters'); return; }

        setLoading(true);
        try {
            const { error } = await supabase.from('menu_items').insert({ 
                session_id: session.id, date_served: date, meal_type: mealType, mess_type: messType, 
                name: name.trim(), description: description.trim(), approval_status: 'approved'
            });
            if (error) throw error;
            
            // If using a recovered item, permanently remove it from the unallocated pool
            if (pendingRecoveryId) {
                setDeletedCsvItems(prev => prev.filter(i => i.id !== pendingRecoveryId));
                setPendingRecoveryId(null);
            }

            setName(''); setDescription(''); fetchItems();
            toast.success('Item added successfully');
        } catch { toast.error('Failed to add item'); } finally { setLoading(false); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) setCsvFile(file);
    };

    const getRepeatingValue = (row, mealType) => {
        const keys = Object.keys(row || {});
        const m = mealType.toLowerCase();
        const match = keys.find(k => {
            const cleaned = k.toLowerCase().replace(/[^a-z]/g, '');
            return cleaned.includes('repeat') && cleaned.includes(m);
        });
        return match ? row[match] : null;
    };

    const getRegularValue = (row, mealType) => {
        const keys = Object.keys(row || {});
        const m = mealType.toLowerCase();
        const match = keys.find(k => {
            const cleaned = k.toLowerCase().replace(/[^a-z]/g, '');
            return cleaned === m || (cleaned.includes(m) && !cleaned.includes('repeat') && !cleaned.includes('daily'));
        });
        return match ? row[match] : null;
    };

    const distributeLocally = (items, days, mode, mealCounts, repeatingItems, startDate) => {
        const totalDays = Number(days) > 0 ? Number(days) : 14;
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const perDayCounts = {
            breakfast: Number(mealCounts?.breakfast) > 0 ? Number(mealCounts.breakfast) : 6,
            lunch: Number(mealCounts?.lunch) > 0 ? Number(mealCounts.lunch) : 11,
            snacks: Number(mealCounts?.snacks) > 0 ? Number(mealCounts.snacks) : 3,
            dinner: Number(mealCounts?.dinner) > 0 ? Number(mealCounts.dinner) : 11,
        };

        const scheduledItems = [];
        const repeatingBuckets = {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: [],
        };

        if (repeatingItems && typeof repeatingItems === 'object') {
            mealOrder.forEach(m => {
                const list = repeatingItems[m] || repeatingItems[m.toUpperCase()] || [];
                if (Array.isArray(list)) {
                    list.forEach(name => {
                        const nameStr = typeof name === 'string' ? name : name?.name;
                        if (nameStr && !repeatingBuckets[m].includes(nameStr.trim())) {
                            repeatingBuckets[m].push(nameStr.trim());
                        }
                    });
                }
            });
        }

        // Add repeating items to EVERY day
        for (let day = 0; day < totalDays; day += 1) {
            mealOrder.forEach(meal => {
                repeatingBuckets[meal].forEach(repName => {
                    scheduledItems.push({
                        name: repName,
                        meal_type: meal,
                        description: 'Daily Repeating Item',
                        day_index: day,
                        is_repeating: true,
                    });
                });
            });
        }

        const parsedStartDate = startDate ? new Date(startDate) : new Date();
        const startDayOfWeek = isNaN(parsedStartDate.getTime()) ? 1 : parsedStartDate.getDay();
        const isWeekendDay = (day) => {
            const dow = (startDayOfWeek + day) % 7;
            return dow === 0 || dow === 6; // Sunday or Saturday
        };

        const northKeywords = [
            'roti', 'chapati', 'paratha', 'naan', 'rajma', 'chole', 'dal makhani', 'paneer',
            'kadhi', 'aloo', 'jeera rice', 'pulao', 'palak', 'mutter', 'kulcha', 'amritsari',
            'dal tadka', 'kofta', 'bhindi masala', 'baingan', 'kashmiri', 'methi', 'malai'
        ];
        const southKeywords = [
            'idli', 'dosa', 'uttapam', 'upma', 'sambar', 'rasam', 'curd rice', 'lemon rice',
            'tamarind rice', 'pongal', 'avial', 'poriyal', 'kootu', 'appam', 'puttu', 'bisi bele',
            'chettinad', 'kara kuzhambu', 'more kuzhambu', 'vatha kuzhambu', 'thorvaiyal',
            'thovaiyal', 'parupu podi', 'arachivitta', 'uduppi', 'udupi', 'seva', 'masiyal',
            'varuval', 'bonda'
        ];
        const eastKeywords = [
            'luchi', 'cholar dal', 'aloo posto', 'ghugni', 'dalma', 'mustard', 'rosogolla',
            'rasgulla', 'sandesh', 'payesh', 'kosha', 'kolkata', 'macher', 'fish curry',
            'dim kosha', 'chhena', 'posto'
        ];
        const westKeywords = [
            'pav bhaji', 'poha', 'misal', 'thepla', 'dhokla', 'sev tameta', 'gujarati',
            'usal', 'batata', 'vada pav', 'kolhapuri', 'dabeli', 'shrikhand', 'dal baati'
        ];
        const weekendKeywords = [
            'biryani', 'briyani', 'fried rice', 'manchurian', 'pav bhaji', 'samosa', 'chaat',
            'chat', 'pani puri', 'poori', 'puri', 'burger', 'pasta', 'pizza', 'french fries',
            'chips', 'schezwan', 'ice cream', 'jalebi', 'jelabi', 'gulab jamun', 'halwa',
            'ladoo', 'laddu', 'pakoda', 'bajji', 'pastry', 'cake', 'kheer', 'payasam',
            'custard', 'milkshake', 'noodles', 'maggi', 'puff', 'chilly', 'chilli', 'crispy'
        ];

        const detectCuisine = (item) => {
            const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
            const isNorth = northKeywords.some((k) => text.includes(k));
            const isSouth = southKeywords.some((k) => text.includes(k));
            const isEast = eastKeywords.some((k) => text.includes(k));
            const isWest = westKeywords.some((k) => text.includes(k));

            const matches = [];
            if (isNorth) matches.push('north');
            if (isSouth) matches.push('south');
            if (isEast) matches.push('east');
            if (isWest) matches.push('west');

            if (matches.length > 1) return 'pan_indian';
            if (matches.length === 1) return matches[0];
            return 'neutral';
        };

        const isWeekendSpecial = (item) => {
            const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
            return weekendKeywords.some((k) => text.includes(k));
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

        const cloneForSchedule = (item, day) => {
            const publicItem = { ...item };
            delete publicItem.__idx;
            delete publicItem.__repeat;
            return {
                ...publicItem,
                day_index: day,
                is_repeating: false,
            };
        };

        const buildRepeatedQueue = (mealItems, totalNeeded) => {
            if (!mealItems || mealItems.length === 0 || totalNeeded <= 0) return [];
            const queue = [];
            for (let repeat = 1; repeat <= MAX_BULK_ITEM_REPEATS && queue.length < totalNeeded; repeat += 1) {
                for (const item of mealItems) {
                    if (queue.length >= totalNeeded) break;
                    queue.push({ ...item, __repeat: repeat });
                }
            }
            return queue;
        };

        mealOrder.forEach((meal) => {
            const mealItems = buckets[meal];
            if (!mealItems || mealItems.length === 0) return;

            const targetPerDay = perDayCounts[meal] || 0;
            const totalMealItems = mode === 'min-config'
                ? targetPerDay * totalDays
                : mealItems.length;

            const sourceItems = mode === 'min-config'
                ? buildRepeatedQueue(mealItems, totalMealItems)
                : [...mealItems];

            const weekendPool = [];
            const weekdayPool = [];
            sourceItems.forEach((it) => {
                if (isWeekendSpecial(it)) weekendPool.push(it);
                else weekdayPool.push(it);
            });

            const regionPool = { north: [], south: [], east: [], west: [], pan_indian: [], neutral: [] };
            sourceItems.forEach((it) => {
                const c = detectCuisine(it);
                regionPool[c].push(it);
            });

            const dayCaps = Array.from({ length: totalDays }, (_, day) => {
                if (mode === 'min-config') return targetPerDay;
                const base = Math.floor(totalMealItems / totalDays);
                const remainder = totalMealItems % totalDays;
                return day < remainder ? base + 1 : base;
            });

            const dayAllocations = Array.from({ length: totalDays }, () => []);

            // Saturdays and Sundays: special/junk items first
            for (let day = 0; day < totalDays; day += 1) {
                if (isWeekendDay(day) && weekendPool.length > 0) {
                    while (dayAllocations[day].length < dayCaps[day] && weekendPool.length > 0) {
                        dayAllocations[day].push(cloneForSchedule(weekendPool.shift(), day));
                    }
                }
            }

            // Weekdays: balanced wholesome items first
            for (let day = 0; day < totalDays; day += 1) {
                if (!isWeekendDay(day) && weekdayPool.length > 0) {
                    while (dayAllocations[day].length < Math.min(dayCaps[day], 2) && weekdayPool.length > 0) {
                        dayAllocations[day].push(cloneForSchedule(weekdayPool.shift(), day));
                    }
                }
            }

            // Pan-Indian balance for lunch and dinner
            if (meal === 'lunch' || meal === 'dinner') {
                for (let day = 0; day < totalDays; day += 1) {
                    if (dayAllocations[day].length < dayCaps[day] && regionPool.north.length > 0) {
                        dayAllocations[day].push(cloneForSchedule(regionPool.north.shift(), day));
                    }
                    if (dayAllocations[day].length < dayCaps[day] && regionPool.south.length > 0) {
                        dayAllocations[day].push(cloneForSchedule(regionPool.south.shift(), day));
                    }
                    if (dayAllocations[day].length < dayCaps[day] && regionPool.east.length > 0) {
                        dayAllocations[day].push(cloneForSchedule(regionPool.east.shift(), day));
                    }
                    if (dayAllocations[day].length < dayCaps[day] && regionPool.west.length > 0) {
                        dayAllocations[day].push(cloneForSchedule(regionPool.west.shift(), day));
                    }
                }
            }

            // Fill remaining slots
            const remainingPool = [...weekendPool, ...weekdayPool];
            for (let day = 0; day < totalDays; day += 1) {
                while (dayAllocations[day].length < dayCaps[day] && remainingPool.length > 0) {
                    dayAllocations[day].push(cloneForSchedule(remainingPool.shift(), day));
                }
            }

            if (mode === 'min-config') {
                let fillPointer = 0;
                for (let day = 0; day < totalDays; day += 1) {
                    while (dayAllocations[day].length < dayCaps[day]) {
                        dayAllocations[day].push(cloneForSchedule(mealItems[fillPointer % mealItems.length], day));
                        fillPointer += 1;
                    }
                }
            }

            dayAllocations.forEach((allocs) => {
                allocs.forEach((it) => scheduledItems.push(it));
            });
        });

        buckets.other.forEach((item, idx) => {
            scheduledItems.push(cloneForSchedule(item, idx % totalDays));
        });

        return scheduledItems;
    };

    const formatDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleDownloadTemplate = () => {
        const sampleRows = [
            {
                Breakfast: "Onion Aloo Veg Paratha + Tomato Chutney + Curd, Dosa (Podi Karam) + Sambar + Peanut Chutney, Egg Masala Omelette",
                Lunch: "Phulka, Rajma Curry, Veg Pulao + Boondi Raita, Chettinad Sambar, Carrot and Beans Poriyal, Banana + Butter Milk",
                Snacks: "Veg Samosa + Sweet Chutney",
                Dinner: "Phulka, Seasonal Vegetable Sabji, Jeera Dal, Dry Cabbage Poriyal, Chocolate Ice Cream, Tomato Soup",
                "Repeating Breakfast": "Toasted Bread + Butter + Jam, Tea / Coffee / Milk",
                "Repeating Lunch": "White Rice, Paruppu Rasam, Curd, Parupu Podi + Gingelly Oil + Thovaiyal, Pickle + Papad",
                "Repeating Snacks": "Tea / Coffee / Milk",
                "Repeating Dinner": "White Rice, Milagu Rasam, Curd, Pickle, Fresh Green Salad, Milk",
            },
            {
                Breakfast: "Paneer Paratha + Tomato Gravy + Curd, Rava Idli + Vada + Sambar + Coconut Chutney, Boiled Egg",
                Lunch: "Phulka, Paneer Butter Masala, Kashmiri Pulao, Mochai Kara Kuzhambu, Aloo Poriyal, Papaya + Lemon Mint Juice",
                Snacks: "Sandwich + Sauce",
                Dinner: "Chapathi, Soya Chunk Gravy, Lemon Rice + Harar Dal, Beans Poriyal, Fruit Custard, Sweet Corn Soup",
                "Repeating Breakfast": "",
                "Repeating Lunch": "",
                "Repeating Snacks": "",
                "Repeating Dinner": "",
            },
            {
                Breakfast: "Palak Paratha + Curd, Masala Dosa + Sambar + Groundnut Chutney, Egg Podimas",
                Lunch: "Chapathi, Palak Paneer, Ghee Rice + Panchamel Dal, Arachivitta Sambar, Tendli Poriyal, Watermelon + Mint Buttermilk",
                Snacks: "Mysore Bonda + Coconut Chutney",
                Dinner: "Atta Poori, White Chana Masala, More Kulambu, Mixed Vegetable Poriyal, Strawberry Milkshake",
                "Repeating Breakfast": "",
                "Repeating Lunch": "",
                "Repeating Snacks": "",
                "Repeating Dinner": "",
            },
            {
                Breakfast: "Aloo Stuffed Paratha + Curd, Andhra Bonda + Idli + Chettinad Kaara Chutney, Egg Omelette",
                Lunch: "Phulka, Paneer Tikka Masala, Bisi Bele Bath + Potato Chips, Vatha Kuzhambu, Keerai Poriyal, Sweet Lassi",
                Snacks: "Dahi Vada",
                Dinner: "Chapathi, Veg Kadai Gravy, Lemon Seva + Arhar Dal Tadka, Bhindi Masala Dry, Cold Badam Milk",
                "Repeating Breakfast": "",
                "Repeating Lunch": "",
                "Repeating Snacks": "",
                "Repeating Dinner": "",
            },
            {
                Breakfast: "Poori + White Peas Masala, Millet Mixed Idli + Vada + Sambar + Tomato Pudina Chutney, Masala Fried Egg",
                Lunch: "Phulka, Malai Kofta Gravy, Andhra Pappu, Udupi Sambar, Potato Pattani Masiyal, Fruit Salad",
                Snacks: "Papdi Chaat",
                Dinner: "Masala Aloo Kulcha, White Chana Masala, Idli + Chutney + Sambar, Gobi 65, Jalebi",
                "Repeating Breakfast": "",
                "Repeating Lunch": "",
                "Repeating Snacks": "",
                "Repeating Dinner": "",
            },
            {
                Breakfast: "Onion Dosa + Sambar + Mint Coriander Chutney, Onion Potato Poha, Omelette",
                Lunch: "Phulka, Dal Tadka, Schezwan Fried Rice + Vegetable Manchurian, Kongunadu Sambar, Keerai Kootu, Sweet Lassi",
                Snacks: "Veg Puff + Sauce, Tea Cake",
                Dinner: "Phulka, Chowly Masala, Jeera Rice + Dal Fry, Kadhi Pakoda Curry, Vanilla Ice Cream",
                "Repeating Breakfast": "",
                "Repeating Lunch": "",
                "Repeating Snacks": "",
                "Repeating Dinner": "",
            },
            {
                Breakfast: "Pav Bhaji + Chopped Onion, Millet Pongal + Vada + Sambar + Coconut Chutney, Masala Egg Curry",
                Lunch: "Chapathi, Kadai Paneer, Hyderabadi Dum Biryani + Onion Raita, Brinjal Curry, Semiya Payasam",
                Snacks: "Pani Puri",
                Dinner: "Phulka, Dal Makhani, Masala Dosa + Coconut Chutney + Sambar, Lauki Chana Curry, Gulab Jamun",
                "Repeating Breakfast": "",
                "Repeating Lunch": "",
                "Repeating Snacks": "",
                "Repeating Dinner": "",
            },
        ];

        const csvContent = Papa.unparse(sampleRows);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'feastfull_october_menu_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Downloaded menu template with repeating columns');
    };

    const handleCsvSubmit = async () => {
        if (!csvFile) return toast.error('Please select a CSV file');
        setCsvParsing(true);

        const mealCounts = getBulkMealCounts(session);

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
                const rawRepeatingItems = {
                    breakfast: [],
                    lunch: [],
                    snacks: [],
                    dinner: [],
                };
                
                data.forEach(row => {
                    ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(mt => {
                        // Regular columns
                        const regVal = getRegularValue(row, mt);
                        if (regVal) {
                            const parsedItems = splitCellItems(regVal);
                            parsedItems.forEach(itemName => {
                                rawItems.push({
                                    meal_type: mt,
                                    name: itemName,
                                    description: 'Bulk Upload',
                                    is_repeating: false,
                                });
                            });
                        }

                        // Repeating columns (present in all days)
                        const repVal = getRepeatingValue(row, mt);
                        if (repVal) {
                            const parsedRep = splitCellItems(repVal);
                            parsedRep.forEach(repName => {
                                if (!rawRepeatingItems[mt].includes(repName)) {
                                    rawRepeatingItems[mt].push(repName);
                                }
                            });
                        }
                    });
                });
                
                const totalRepeatingFound = Object.values(rawRepeatingItems).reduce((s, a) => s + a.length, 0);
                if (rawItems.length === 0 && totalRepeatingFound === 0) {
                    toast.error('No items found in CSV. Check headers.');
                    setCsvParsing(false);
                    return;
                }
                
                try {
                    toast.loading(distributionMode === 'equal' ? 'Distributing items equally across days...' : 'Scheduling by meal counts with Pan-Indian balance...', { id: 'aiToast' });
                    let distributed = [];

                    try {
                        const res = await axios.post(`${API_URL}/api/ai/distribute-csv`, {
                            items: rawItems,
                            repeatingItems: rawRepeatingItems,
                            days: totalSlots,
                            distributionMode,
                            mealCounts,
                            messType,
                            startDate: session.start_date,
                        });
                        distributed = res.data.distributed || [];
                    } catch (apiError) {
                        console.error('distribute-csv API unavailable, falling back to local scheduling:', apiError);
                        distributed = distributeLocally(rawItems, totalSlots, distributionMode, mealCounts, rawRepeatingItems, session.start_date);
                        toast('API unavailable. Scheduled locally with regional & balance rules.', { id: 'aiToast', icon: '⚠️' });
                    }
                    
                    // Map day_index back into proper dates
                    const dbItems = distributed.map(it => {
                        const d = new Date(slotOptions[0]?.value || session.start_date || '2000-01-03');
                        d.setDate(d.getDate() + (it.day_index || 0));
                        return {
                            session_id: session.id,
                            date_served: formatDateKey(d),
                            meal_type: it.meal_type,
                            mess_type: messType,
                            name: it.name,
                            description: it.description || (it.is_repeating ? 'Daily Repeating Item' : 'Bulk Upload'),
                            approval_status: 'approved',
                        };
                    });

                    // Insert and retrieve mapping IDs
                    const { data: insertedData, error } = await supabase.from('menu_items').insert(dbItems).select('id');
                    if (error) throw error;
                    
                    if (insertedData) {
                        setCsvUploadedIds(insertedData.map(d => d.id));
                    }

                    fetchItems();
                    toast.success(`Successfully uploaded and scheduled ${dbItems.length} items (${totalRepeatingFound} daily repeating types included)`, { id: 'aiToast' });
                } catch (err) {
                    console.error(err);
                    toast.error('Failed to distribute items: ' + (err.message || 'Server error'), { id: 'aiToast' });
                } finally {
                    setCsvParsing(false);
                }
            },
            error: () => {
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
        } catch {
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
        <div className="fixed inset-0 bg-transparent backdrop-blur-md z-40 flex justify-end" onClick={onClose}>
            <div className="bg-white/80 backdrop-blur-xl w-full max-w-4xl h-full shadow-xl flex flex-col animate-slide-in-right overflow-hidden border-l border-white/50" onClick={(e) => e.stopPropagation()}>
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
                            <p className="text-xs leading-5 text-indigo-700/90 block mb-3">Upload a CSV with 4 meal columns (Breakfast, Lunch, Snacks, Dinner) and 4 repeating columns (Repeating Breakfast, Repeating Lunch, Repeating Snacks, Repeating Dinner). Repeating items appear on every day.</p>
                            <div className="mb-4">
                                <button type="button" onClick={handleDownloadTemplate} className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100/70 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5 shadow-xs">
                                    <Download size={13} /> Download 8-Column CSV Template
                                </button>
                            </div>
                            
                            <div className="space-y-3.5">
                                <div>
                                    <label className="block text-xs font-bold tracking-wide text-indigo-900 uppercase mb-1.5">Target Mess Type</label>
                                    <CustomSelect 
                                        value={messType} 
                                        onChange={(val) => setMessType(val)} 
                                        options={[
                                            { value: 'veg', label: 'Veg' },
                                            { value: 'non_veg', label: 'Non-Veg' },
                                            { value: 'special', label: 'Special' },
                                            { value: 'food_park', label: 'Food Park' }
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold tracking-wide text-indigo-900 uppercase mb-1.5">Distribution Mode</label>
                                    <CustomSelect
                                        value={distributionMode}
                                        onChange={(val) => setDistributionMode(val)}
                                        options={[
                                            { value: 'equal', label: 'Distribute Equally (round-robin by day)' },
                                            { value: 'min-config', label: 'Minimum Per Day Configuration' }
                                        ]}
                                    />
                                </div>
                                {distributionMode === 'min-config' && (
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Breakfast (limit + {BULK_ALLOCATION_BUFFER.breakfast})</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.breakfast}
                                                readOnly
                                                className="w-full bg-indigo-50 px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm font-semibold text-indigo-950"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Lunch (limit + {BULK_ALLOCATION_BUFFER.lunch})</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.lunch}
                                                readOnly
                                                className="w-full bg-indigo-50 px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm font-semibold text-indigo-950"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Snacks (limit + {BULK_ALLOCATION_BUFFER.snacks})</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.snacks}
                                                readOnly
                                                className="w-full bg-indigo-50 px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm font-semibold text-indigo-950"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-wide text-indigo-800 uppercase mb-1">Dinner (limit + {BULK_ALLOCATION_BUFFER.dinner})</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={minMealCounts.dinner}
                                                readOnly
                                                className="w-full bg-indigo-50 px-2.5 py-2 border border-indigo-200 rounded-xl outline-none text-sm font-semibold text-indigo-950"
                                            />
                                        </div>
                                    </div>
                                )}
                                {distributionMode === 'min-config' && (
                                    <p className="text-[11px] text-indigo-800 bg-indigo-100/70 border border-indigo-200 rounded-lg px-2.5 py-2">
                                        Bulk upload targets: Lunch {minMealCounts.lunch}, Breakfast {minMealCounts.breakfast}, Snacks {minMealCounts.snacks}, Dinner {minMealCounts.dinner}. Items may repeat up to {MAX_BULK_ITEM_REPEATS} times to fill daily targets.
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
                                    <CustomSelect 
                                        onChange={(val) => handleSelectRecoveredItem({ target: { value: val } })} 
                                        value={pendingRecoveryId || ''} 
                                        placeholder="-- Select an item to schedule --"
                                        options={[{value: '', label: '-- Select an item to schedule --'}, ...deletedCsvItems.map(i => ({ value: i.id, label: `${i.name} (${i.meal_type})` }))]}
                                    />
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Date</label>
                                    <CustomSelect 
                                        value={date} 
                                        onChange={(val) => setDate(val)}
                                        options={slotOptions.map(({ value, label }) => ({ value, label }))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meal</label><CustomSelect value={mealType} onChange={(val) => setMealType(val)} options={[{value:'breakfast', label:'Breakfast'},{value:'lunch', label:'Lunch'},{value:'snacks', label:'Snacks'},{value:'dinner', label:'Dinner'}]} /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mess Form</label><CustomSelect value={messType} onChange={(val) => setMessType(val)} options={[{value:'veg', label:'Veg'},{value:'non_veg', label:'NVeg'},{value:'special', label:'Spl'},{value:'food_park', label:'Park'}]} /></div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase">Item Name *</label>
                                        {name && name.trim().length < 3 && (
                                            <span className="text-[10px] text-red-500 font-medium">Min 3 chars</span>
                                        )}
                                    </div>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Masala Dosa" 
                                        className={`w-full px-3 py-2 border rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary/20 ${
                                            name && name.trim().length < 3 ? 'border-red-500' : 'border-gray-200'
                                        }`} 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase">Description</label>
                                        <span className={`text-[10px] font-semibold ${description.length > 200 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {description.length}/200
                                        </span>
                                    </div>
                                    <textarea 
                                        placeholder="Ingredients, sides..." 
                                        className={`w-full px-3 py-2 border rounded-lg outline-none text-sm resize-none focus:ring-2 focus:ring-primary/20 ${
                                            description.length > 200 ? 'border-red-500' : 'border-gray-200'
                                        }`} 
                                        rows={2} 
                                        value={description} 
                                        onChange={(e) => {
                                            if (e.target.value.length <= 200) {
                                                setDescription(e.target.value);
                                            }
                                        }} 
                                    />
                                </div>
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
                            <div className="fixed inset-0 z-40 flex items-center justify-center bg-transparent backdrop-blur-md p-4">
                                <div className="w-full max-w-md rounded-2xl border border-white/50 bg-white/80 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in">
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
