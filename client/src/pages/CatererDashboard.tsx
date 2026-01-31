import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X } from 'lucide-react';

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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Caterer Dashboard</h2>
            </div>

            {loading ? (
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
            .eq('session_id', session.id);
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

            // Reset form and refresh list
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

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="bg-white w-full max-w-2xl h-full p-6 shadow-xl overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Manage Menu: {session.title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-4">Add New Item</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    required
                                    min={session.start_date}
                                    max={session.end_date}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={mealType}
                                    onChange={(e) => setMealType(e.target.value)}
                                >
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="snacks">Snacks</option>
                                    <option value="dinner">Dinner</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mess Type</label>
                            <div className="flex gap-4">
                                {['veg', 'non_veg', 'special'].map((t) => (
                                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="messType"
                                            value={t}
                                            checked={messType === t}
                                            onChange={(e) => setMessType(e.target.value)}
                                            className="text-primary focus:ring-primary"
                                        />
                                        <span className="capitalize">{t.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Masala Dosa"
                                className="w-full px-3 py-2 border rounded-lg"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                placeholder="Ingredients, details..."
                                className="w-full px-3 py-2 border rounded-lg"
                                rows={2}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            {loading ? 'Adding...' : 'Add Item'}
                        </button>
                    </form>
                </div>

                <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Proposed Items ({items.length})</h4>
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center p-4 bg-white border rounded-lg hover:shadow-sm">
                                <div>
                                    <h5 className="font-medium text-gray-900">{item.name}</h5>
                                    <p className="text-sm text-gray-500">
                                        {new Date(item.date_served).toLocaleDateString()} • <span className="capitalize">{item.meal_type}</span> • <span className="capitalize">{item.mess_type.replace('_', ' ')}</span>
                                    </p>
                                </div>
                                <button
                                    className="text-red-500 hover:text-red-700 text-sm"
                                    onClick={async () => {
                                        if (!confirm('Delete this item?')) return;
                                        await supabase.from('menu_items').delete().eq('id', item.id);
                                        fetchItems();
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatererDashboard;
