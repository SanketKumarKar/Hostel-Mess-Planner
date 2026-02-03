import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Trash2, MessageSquare, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Feedback } from '../types';

interface Session {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
}

const CatererDashboard = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [activeTab, setActiveTab] = useState<'menus' | 'feedback'>('menus');

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const { data, error } = await supabase
                .from('voting_sessions')
                .select('*')
                .eq('status', 'draft') // Only show draft sessions where caterers can add items
                .order('start_date', { ascending: true });

            if (error) throw error;
            setSessions(data || []);
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Caterer Dashboard</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('menus')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'menus' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Menu Planning
                    </button>
                    <button
                        onClick={() => setActiveTab('feedback')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'feedback' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Feedbacks
                    </button>
                </div>
            </div>

            {activeTab === 'menus' ? (
                loading ? (
                    <div className="text-center py-10">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                        <p className="text-gray-500 text-lg">No active menu planning sessions found.</p>
                        <p className="text-sm text-gray-400 mt-2">Wait for an admin to create a new session.</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sessions.map((session) => (
                            <div key={session.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium capitalize">
                                            {session.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 mb-6">
                                        <p>From: {new Date(session.start_date).toLocaleDateString()}</p>
                                        <p>To: {new Date(session.end_date).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSession(session)}
                                        className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} />
                                        Add Menu Items
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <FeedbackManager />
            )}

            {selectedSession && (
                <MenuEditor session={selectedSession} onClose={() => setSelectedSession(null)} />
            )}
        </div>
    );
};

const MenuEditor = ({ session, onClose }: { session: Session, onClose: () => void }) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [date, setDate] = useState(session.start_date);
    const [mealType, setMealType] = useState('breakfast');
    const [messType, setMessType] = useState('veg');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const fetchItems = async () => {
        const { data } = await supabase
            .from('menu_items')
            .select('*')
            .eq('session_id', session.id)
            .order('date_served', { ascending: true })
            .order('meal_type', { ascending: true });
        setItems(data || []);
    };

    useEffect(() => { fetchItems(); }, [session.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('menu_items').insert({
                session_id: session.id,
                date_served: date,
                meal_type: mealType,
                mess_type: messType,
                name,
                description,
            });

            if (error) throw error;

            // Reset form (keep date/meal/mess for faster entry)
            setName('');
            setDescription('');
            fetchItems();
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Failed to add item');
        } finally {
            setLoading(false);
        }
    };

    // Group items logic
    const groupedItems = items.reduce((acc, item) => {
        const d = item.date_served;
        if (!acc[d]) acc[d] = {};
        if (!acc[d][item.meal_type]) acc[d][item.meal_type] = [];
        acc[d][item.meal_type].push(item);
        return acc;
    }, {} as Record<string, Record<string, any[]>>);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="bg-white w-full max-w-4xl h-full shadow-xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Manage Menu Items</h3>
                        <p className="text-sm text-gray-500">{session.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Add Item Form - Left Side */}
                    <div className="w-full md:w-1/3 p-6 border-r overflow-y-auto bg-gray-50/50">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Plus size={18} className="text-primary" />
                            Add New Item
                        </h4>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                >
                                    {(() => {
                                        // Generate 7 days starting from start_date
                                        const dates = Array.from({ length: 7 }, (_, i) => {
                                            const d = new Date(session.start_date);
                                            d.setDate(d.getDate() + i);
                                            return d;
                                        });

                                        return dates.map(d => {
                                            const val = d.toISOString().split('T')[0];
                                            return (
                                                <option key={val} value={val}>
                                                    {d.toLocaleDateString('en-US', { weekday: 'long' })}
                                                </option>
                                            )
                                        });
                                    })()}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meal</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={mealType}
                                        onChange={(e) => setMealType(e.target.value)}
                                    >
                                        <option value="breakfast">Breakfast</option>
                                        <option value="lunch">Lunch</option>
                                        <option value="snacks">Snacks</option>
                                        <option value="dinner">Dinner</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mess Type</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={messType}
                                        onChange={(e) => setMessType(e.target.value)}
                                    >
                                        <option value="veg">Veg</option>
                                        <option value="non_veg">Non-Veg</option>
                                        <option value="special">Special</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Masala Dosa"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                <textarea
                                    placeholder="Ingredients, sides..."
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary text-white py-2.5 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-lg shadow-indigo-100"
                            >
                                {loading ? 'Adding...' : 'Add Item'}
                            </button>
                        </form>
                    </div>

                    {/* Items List - Right Side */}
                    <div className="flex-1 p-6 overflow-y-auto bg-white">
                        <div className="flex flex-col gap-2 mb-6">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-gray-800">Current Menu Items</h4>
                                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{items.length} items total</span>
                            </div>
                            <div className="flex gap-4 text-xs font-medium">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> Veg</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Non-Veg</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Special</span>
                            </div>
                        </div>

                        {items.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <Plus size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No items added yet. Start adding from the left panel.</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(groupedItems).sort().map(([dateStr, meals]: [string, any]) => (
                                    <div key={dateStr} className="border rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-3 border-b font-bold text-gray-700 flex justify-between">
                                            {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </div>
                                        <div className="divide-y">
                                            {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => {
                                                const mealItems = meals[meal] || [];
                                                if (mealItems.length === 0) return null;

                                                return (
                                                    <div key={meal} className="p-4 flex gap-4">
                                                        <div className="w-24 flex-shrink-0">
                                                            <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block pt-1">{meal}</span>
                                                        </div>
                                                        <div className="flex-1 space-y-3">
                                                            {mealItems.map((item: any) => (
                                                                <div key={item.id} className="flex justify-between items-start group">
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`w-2 h-2 rounded-full ${item.mess_type === 'veg' ? 'bg-green-500' :
                                                                                item.mess_type === 'non_veg' ? 'bg-red-500' : 'bg-purple-500'
                                                                                }`} title={item.mess_type}></span>
                                                                            <h5 className="font-medium text-gray-900">{item.name}</h5>
                                                                        </div>
                                                                        <p className="text-sm text-gray-500 pl-4">{item.description}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!confirm('Delete this item?')) return;
                                                                            await supabase.from('menu_items').delete().eq('id', item.id);
                                                                            fetchItems();
                                                                        }}
                                                                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                                        title="Delete Item"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FeedbackManager = () => {
    const { profile } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [responseInput, setResponseInput] = useState<{ [key: string]: string }>({});
    const [submitting, setSubmitting] = useState<string | null>(null);

    useEffect(() => {
        if (profile) fetchFeedbacks();
    }, [profile]);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('feedbacks')
                .select('*, student:profiles!student_id(full_name, reg_number)')
                .eq('caterer_id', profile.id)
                .order('created_at', { ascending: false });

            setFeedbacks(data as Feedback[] || []);
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResponse = async (feedbackId: string) => {
        const responseText = responseInput[feedbackId];
        if (!responseText?.trim()) return;

        setSubmitting(feedbackId);
        try {
            const { error } = await supabase
                .from('feedbacks')
                .update({ response: responseText })
                .eq('id', feedbackId);

            if (error) throw error;

            alert('Response sent!');
            setResponseInput(prev => ({ ...prev, [feedbackId]: '' }));
            fetchFeedbacks();
        } catch (error) {
            console.error('Error responding:', error);
            alert('Failed to send response');
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) return <div>Loading feedbacks...</div>;

    if (feedbacks.length === 0) return (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No feedbacks received yet.</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {feedbacks.map(fb => (
                <div key={fb.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold">
                                {fb.student?.full_name?.[0] || 'S'}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">{fb.student?.full_name || 'Anonymous Student'}</h4>
                                <p className="text-xs text-gray-500">{fb.student?.reg_number || 'No Reg Num'}</p>
                            </div>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(fb.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="ml-13 pl-13 mb-4">
                        <p className="text-gray-700 bg-gray-50 p-4 rounded-lg rounded-tl-none border border-gray-100">
                            {fb.message}
                        </p>
                    </div>

                    {fb.response ? (
                        <div className="ml-10 bg-green-50 p-4 rounded-lg border border-green-100 flex gap-3">
                            <Check className="text-green-600 mt-0.5" size={18} />
                            <div>
                                <p className="text-xs font-bold text-green-700 uppercase mb-1">Your Response</p>
                                <p className="text-sm text-gray-800">{fb.response}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="ml-10">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Type your response..."
                                    className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={responseInput[fb.id] || ''}
                                    onChange={e => setResponseInput({ ...responseInput, [fb.id]: e.target.value })}
                                />
                                <button
                                    onClick={() => handleResponse(fb.id)}
                                    disabled={submitting === fb.id || !responseInput[fb.id]}
                                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                                >
                                    {submitting === fb.id ? 'Sending...' : 'Reply'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CatererDashboard;
