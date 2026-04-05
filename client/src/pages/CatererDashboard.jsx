import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, MessageSquare, Check, Settings, Sparkles, Loader2, Megaphone, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { buildSlotOptions, formatSlotLabel } from '../utils/menuSlots';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CatererDashboard = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [activeTab, setActiveTab] = useState('menus');
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => { fetchSessions(); }, []);

    const fetchSessions = async () => {
        try {
            const { data, error } = await supabase.from('voting_sessions').select('*').eq('status', 'draft').order('start_date', { ascending: true });
            if (error) throw error;
            setSessions(data || []);
        } catch (error) { console.error('Error fetching sessions:', error); } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Caterer Dashboard</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowSettings(true)} className="px-4 py-2 rounded-lg font-medium transition-colors text-gray-600 hover:bg-gray-100 border border-gray-200 flex items-center gap-2"><Settings size={18} />Profile Settings</button>
                    <button onClick={() => setActiveTab('menus')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'menus' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Menu Planning</button>
                    <button onClick={() => setActiveTab('announcements')} className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'announcements' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}><Megaphone size={16} />Announcements</button>
                    <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'feedback' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Feedbacks</button>
                </div>
            </div>

            {activeTab === 'menus' ? (
                loading ? (<div className="text-center py-10">Loading sessions...</div>) : sessions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center"><p className="text-gray-500 text-lg">No active menu planning sessions found.</p><p className="text-sm text-gray-400 mt-2">Wait for an admin to create a new session.</p></div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sessions.map((session) => (
                            <div key={session.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4"><h3 className="text-lg font-semibold text-gray-900">{session.title}</h3><span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium capitalize">{session.status.replace('_', ' ')}</span></div>
                                    <div className="text-sm text-gray-500 mb-6"><p>From: {new Date(session.start_date).toLocaleDateString()}</p><p>To: {new Date(session.end_date).toLocaleDateString()}</p></div>
                                    <button onClick={() => setSelectedSession(session)} className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"><Plus size={18} />Add Menu Items</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'announcements' ? (<AnnouncementManager />) : (<FeedbackManager />)}

            {selectedSession && (<MenuEditor session={selectedSession} onClose={() => setSelectedSession(null)} />)}
            {showSettings && <CatererProfileSettings onClose={() => setShowSettings(false)} />}
        </div>
    );
};

const MenuEditor = ({ session, onClose }) => {
    const slotOptions = buildSlotOptions(session.session_weeks);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(slotOptions[0]?.value || session.start_date);
    const [mealType, setMealType] = useState('breakfast');
    const [messType, setMessType] = useState('veg');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showAI, setShowAI] = useState(false);
    const [ingredients, setIngredients] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [aiError, setAiError] = useState('');
    const [addingAiItem, setAddingAiItem] = useState(null);

    const fetchItems = useCallback(async () => {
        const { data } = await supabase.from('menu_items').select('*').eq('session_id', session.id).order('date_served', { ascending: true }).order('meal_type', { ascending: true });
        setItems(data || []);
    }, [session.id]);

    useEffect(() => { fetchItems(); }, [fetchItems]);
    useEffect(() => { if (slotOptions.length > 0) setDate(slotOptions[0].value); }, [session.id]);

    const handleSubmit = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            const { error } = await supabase.from('menu_items').insert({ session_id: session.id, date_served: date, meal_type: mealType, mess_type: messType, name, description, approval_status: 'pending' });
            if (error) throw error;
            setName(''); setDescription(''); fetchItems();
        } catch (error) { console.error('Error adding item:', error); toast.error('Failed to add item'); } finally { setLoading(false); }
    };

    const handleAISuggest = async () => {
        const ingredientList = ingredients.split(',').map(i => i.trim()).filter(Boolean);
        if (ingredientList.length === 0) { setAiError('Please enter at least one ingredient.'); return; }
        setAiLoading(true); setAiError(''); setAiSuggestions([]);
        try {
            const res = await axios.post(`${API_URL}/api/ai/suggest-dishes`, { ingredients: ingredientList, mealType, messType });
            setAiSuggestions(res.data.dishes || []);
        } catch (err) { setAiError(err.response?.data?.error || 'Failed to get AI suggestions. Please try again.'); } finally { setAiLoading(false); }
    };

    const handleAddAiDish = async (dish) => {
        setAddingAiItem(dish.name);
        try {
            const { error } = await supabase.from('menu_items').insert({ session_id: session.id, date_served: date, meal_type: mealType, mess_type: messType, name: dish.name, description: dish.description, approval_status: 'pending' });
            if (error) throw error;
            fetchItems();
        } catch (err) { console.error('Error adding AI dish:', err); toast.error('Failed to add dish'); } finally { setAddingAiItem(null); }
    };

    const groupedItems = items.reduce((acc, item) => { const d = item.date_served; if (!acc[d]) acc[d] = {}; if (!acc[d][item.meal_type]) acc[d][item.meal_type] = []; acc[d][item.meal_type].push(item); return acc; }, {});

    const getApprovalBadge = (status) => {
        if (status === 'approved') return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">✓ Approved</span>;
        if (status === 'rejected') return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">✗ Rejected</span>;
        return <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">🕐 Pending</span>;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="bg-white w-full max-w-4xl h-full shadow-xl flex flex-col animate-slide-in-right">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50"><div><h3 className="text-xl font-bold text-gray-800">Manage Menu Items</h3><p className="text-sm text-gray-500">{session.title} • Items need Admin approval before students can vote</p></div><button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button></div>
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    <div className="w-full md:w-2/5 p-6 border-r overflow-y-auto bg-gray-50/50 space-y-5">
                        <div className="border-2 border-indigo-200 rounded-xl overflow-hidden">
                            <button onClick={() => setShowAI(!showAI)} className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold hover:from-indigo-100 hover:to-purple-100 transition-colors"><span className="flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" />🤖 AI Dish Suggester</span><span className="text-indigo-400 text-sm">{showAI ? '▲' : '▼'}</span></button>
                            {showAI && (
                                <div className="p-4 space-y-3 bg-white">
                                    <p className="text-xs text-gray-500">Enter your available raw materials (comma-separated) and Gemini AI will suggest bulk dishes.</p>
                                    <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="e.g. potatoes, onions, tomatoes, rice, lentils, paneer..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none" />
                                    <div className="flex gap-2 text-xs text-gray-500"><span>For: <strong className="capitalize">{mealType}</strong></span><span>•</span><span>Mess: <strong className="capitalize">{messType.replace('_', ' ')}</strong></span></div>
                                    <button onClick={handleAISuggest} disabled={aiLoading} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex justify-center items-center gap-2">{aiLoading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Get AI Suggestions</>}</button>
                                    {aiError && <p className="text-xs text-red-500">{aiError}</p>}
                                    {aiSuggestions.length > 0 && (
                                        <div className="space-y-2 mt-1">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">AI Suggestions — click ➕ to add</p>
                                            {aiSuggestions.map((dish, idx) => (
                                                <div key={idx} className="flex items-start justify-between gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                                    <div className="flex-1"><p className="font-semibold text-gray-900 text-sm">{dish.name}</p><p className="text-xs text-gray-500 mt-0.5">{dish.description}</p></div>
                                                    <button onClick={() => handleAddAiDish(dish)} disabled={addingAiItem === dish.name} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0 transition-colors" title="Add this dish">{addingAiItem === dish.name ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-primary" />Add Item Manually</h4>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" value={date} onChange={(e) => setDate(e.target.value)}>
                                        {slotOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meal</label><select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" value={mealType} onChange={(e) => setMealType(e.target.value)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="snacks">Snacks</option><option value="dinner">Dinner</option></select></div>
                                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mess Type</label><select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" value={messType} onChange={(e) => setMessType(e.target.value)}><option value="veg">Veg</option><option value="non_veg">Non-Veg</option><option value="special">Special</option><option value="food_park">Food Park</option></select></div>
                                </div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label><input type="text" required placeholder="e.g. Masala Dosa" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" value={name} onChange={(e) => setName(e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label><textarea placeholder="Ingredients, sides..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-2.5 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-lg shadow-indigo-100">{loading ? 'Adding...' : 'Add Item'}</button>
                            </form>
                        </div>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto bg-white">
                        <div className="flex flex-col gap-2 mb-6">
                            <div className="flex justify-between items-center"><h4 className="font-bold text-gray-800">Current Menu Items</h4><span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{items.length} items</span></div>
                            <div className="flex gap-3 flex-wrap text-xs font-medium">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div>Veg</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"></div>Non-Veg</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div>Special</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-500"></div>Food Park</span>
                                <span className="ml-auto text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Items need Admin approval to appear in voting</span>
                            </div>
                        </div>
                        {items.length === 0 ? (<div className="text-center py-20 text-gray-400"><Plus size={48} className="mx-auto mb-4 opacity-20" /><p>No items added yet. Use the AI Suggester or add manually.</p></div>) : (
                            <div className="space-y-8">
                                {Object.entries(groupedItems).sort().map(([dateStr, meals]) => (
                                    <div key={dateStr} className="border rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-3 border-b font-bold text-gray-700">{formatSlotLabel(dateStr, session.session_weeks, 'long')}</div>
                                        <div className="divide-y">
                                            {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => { const mealItems = meals[meal] || []; if (mealItems.length === 0) return null; return (
                                                <div key={meal} className="p-4 flex gap-4">
                                                    <div className="w-24 flex-shrink-0"><span className="text-xs font-bold uppercase text-gray-400 tracking-wider block pt-1">{meal}</span></div>
                                                    <div className="flex-1 space-y-3">
                                                        {mealItems.map((item) => (
                                                            <div key={item.id} className="flex justify-between items-start group">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.mess_type === 'veg' ? 'bg-green-500' : item.mess_type === 'non_veg' ? 'bg-orange-500' : item.mess_type === 'food_park' ? 'bg-teal-500' : 'bg-purple-500'}`}></span>
                                                                        <h5 className="font-medium text-gray-900">{item.name}</h5>
                                                                        {getApprovalBadge(item.approval_status)}
                                                                    </div>
                                                                    <p className="text-sm text-gray-500 pl-4 mt-0.5">{item.description}</p>
                                                                </div>
                                                                <button onClick={async () => { if (!confirm('Delete this item?')) return; await supabase.from('menu_items').delete().eq('id', item.id); fetchItems(); }} className="text-gray-300 hover:text-red-500 transition-colors p-1 ml-2" title="Delete Item"><Trash2 size={16} /></button>
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
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnnouncementManager = () => {
    const { profile } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [messType, setMessType] = useState('all');
    const [submitting, setSubmitting] = useState(false);

    const fetchAnnouncements = useCallback(async () => { setLoading(true); try { const { data } = await supabase.from('announcements').select('*').eq('caterer_id', profile.id).order('created_at', { ascending: false }); setAnnouncements(data || []); } catch (err) { console.error(err); } finally { setLoading(false); } }, [profile?.id]);

    useEffect(() => { if (profile) fetchAnnouncements(); }, [profile, fetchAnnouncements]);

    const handleCreate = async (e) => { e.preventDefault(); if (!title.trim() || !body.trim()) return; setSubmitting(true); try { const { error } = await supabase.from('announcements').insert({ caterer_id: profile.id, title: title.trim(), body: body.trim(), mess_type: messType }); if (error) throw error; setTitle(''); setBody(''); fetchAnnouncements(); } catch (err) { toast.error('Failed to post announcement: ' + err.message); } finally { setSubmitting(false); } };
    const handleDelete = async (id) => { if (!confirm('Delete this announcement?')) return; await supabase.from('announcements').delete().eq('id', id); fetchAnnouncements(); };

    const messColors = { all: 'bg-blue-100 text-blue-700', veg: 'bg-green-100 text-green-700', non_veg: 'bg-orange-100 text-orange-700', special: 'bg-purple-100 text-purple-700', food_park: 'bg-teal-100 text-teal-700' };

    return (
        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2"><Bell size={20} className="text-primary" />Post New Announcement</h3>
                <p className="text-sm text-gray-500 mb-5">Students assigned to your mess will see this announcement on their dashboard.</p>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mess Type</label><select value={messType} onChange={e => setMessType(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"><option value="all">To All</option><option value="veg">Veg</option><option value="non_veg">Non-Veg</option><option value="special">Special</option><option value="food_park">Food Park</option></select></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label><input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Special menu on Saturday" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label><textarea required value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement here..." rows={4} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none resize-none" /></div>
                    <button type="submit" disabled={submitting} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">{submitting ? 'Posting...' : '📢 Post Announcement'}</button>
                </form>
            </div>
            <div className="space-y-4">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Your Announcements</h3>
                {loading ? (<div className="text-center py-10 text-gray-400">Loading...</div>) : announcements.length === 0 ? (<div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400"><Megaphone size={40} className="mx-auto mb-3 opacity-30" /><p>No announcements yet. Post your first one!</p></div>) : (
                    announcements.map(ann => (
                        <div key={ann.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div><span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize mb-1 inline-block ${messColors[ann.mess_type] || 'bg-gray-100 text-gray-700'}`}>{ann.mess_type.replace('_', ' ')}</span><h4 className="font-bold text-gray-900">{ann.title}</h4></div>
                                <button onClick={() => handleDelete(ann.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                            </div>
                            <p className="text-gray-600 text-sm">{ann.body}</p>
                            <p className="text-xs text-gray-400 mt-3">{new Date(ann.created_at).toLocaleDateString()}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const FeedbackManager = () => {
    const { profile } = useAuth();
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [responseInput, setResponseInput] = useState({});
    const [submitting, setSubmitting] = useState(null);

    const fetchFeedbacks = useCallback(async () => { setLoading(true); try { const { data } = await supabase.from('feedbacks').select('*, student:profiles!student_id(full_name, reg_number)').eq('caterer_id', profile.id).order('created_at', { ascending: false }); setFeedbacks(data || []); } catch (error) { console.error('Error fetching feedbacks:', error); } finally { setLoading(false); } }, [profile?.id]);

    useEffect(() => { if (profile) fetchFeedbacks(); }, [profile, fetchFeedbacks]);

    const handleResponse = async (feedbackId) => { const responseText = responseInput[feedbackId]; if (!responseText?.trim()) return; setSubmitting(feedbackId); try { const { error } = await supabase.from('feedbacks').update({ response: responseText }).eq('id', feedbackId); if (error) throw error; toast.success('Response sent!'); setResponseInput(prev => ({ ...prev, [feedbackId]: '' })); fetchFeedbacks(); } catch (error) { toast.error('Failed to send response'); } finally { setSubmitting(null); } };

    if (loading) return <div>Loading feedbacks...</div>;
    if (feedbacks.length === 0) return (<div className="text-center py-20 bg-white rounded-xl border border-gray-100"><MessageSquare size={48} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No feedbacks received yet.</p></div>);

    return (
        <div className="space-y-4">
            {feedbacks.map(fb => (
                <div key={fb.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold">{fb.student?.full_name?.[0] || 'S'}</div>
                            <div><h4 className="font-bold text-gray-800">{fb.student?.full_name || 'Anonymous Student'}</h4><p className="text-xs text-gray-500">{fb.student?.reg_number || 'No Reg Num'}</p></div>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(fb.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mb-4"><p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">{fb.message}</p></div>
                    {fb.response ? (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex gap-3"><Check className="text-green-600 mt-0.5" size={18} /><div><p className="text-xs font-bold text-green-700 uppercase mb-1">Your Response</p><p className="text-sm text-gray-800">{fb.response}</p></div></div>
                    ) : (
                        <div className="flex gap-2">
                            <input type="text" placeholder="Type your response..." className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none" value={responseInput[fb.id] || ''} onChange={e => setResponseInput({ ...responseInput, [fb.id]: e.target.value })} />
                            <button onClick={() => handleResponse(fb.id)} disabled={submitting === fb.id || !responseInput[fb.id]} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">{submitting === fb.id ? 'Sending...' : 'Reply'}</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const CatererProfileSettings = ({ onClose }) => {
    const { profile } = useAuth();
    const [servedTypes, setServedTypes] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (profile?.served_mess_types) setServedTypes(profile.served_mess_types); }, [profile]);

    const handleToggle = (type) => { setServedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]); };

    const handleSave = async () => {
        setSaving(true);
        try { const { error } = await supabase.from('profiles').update({ served_mess_types: servedTypes }).eq('id', profile?.id); if (error) throw error; toast.success('Profile updated successfully!'); window.location.reload(); } catch (error) { toast.error('Failed to update: ' + error.message); } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-in">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl"><h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings size={20} />Caterer Settings</h3><button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button></div>
                <div className="p-6">
                    <h4 className="font-bold text-gray-700 mb-3">Served Mess Types</h4>
                    <div className="space-y-3">
                        {['veg', 'non_veg', 'special', 'food_park'].map((type) => (
                            <label key={type} className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <input type="checkbox" checked={servedTypes.includes(type)} onChange={() => handleToggle(type)} className="w-5 h-5 text-primary rounded focus:ring-primary" />
                                <span className="capitalize font-medium text-gray-700">{type.replace('_', ' ')}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
    );
};

export default CatererDashboard;
