import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Moon, IndianRupee, RefreshCw, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const NightMessPage = () => {
    const { profile } = useAuth();
    const [block, setBlock] = useState(profile?.hostel_block || 'A');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // For students, block is fixed to their assigned block; admin/caterer can switch
    const canSwitchBlock = profile?.role === 'admin' || profile?.role === 'caterer';

    useEffect(() => {
        if (profile?.hostel_block) setBlock(profile.hostel_block);
    }, [profile]);

    useEffect(() => {
        if (profile) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block, profile?.role]);

    const getAuthHeaders = async () => {
        const { supabase } = await import('../supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
        return {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        };
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API}/api/night-mess${profile?.role === 'student' ? '' : `?block=${block}`}`, {
                headers
            });
            if (!res.ok) throw new Error(`Request failed: ${res.status}`);
            const data = await res.json();
            setItems(data || []);
        } catch (e) {
            toast.error('Failed to load night mess menu');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="bg-amber-400/20 p-3 rounded-xl">
                        <Moon size={28} className="text-amber-300" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Night Mess</h2>
                        <p className="text-sm text-white/70">Late-night snack & meal options</p>
                    </div>
                </div>
                {canSwitchBlock ? (
                    <div className="relative z-10 mt-4 flex items-center gap-2 bg-white/10 rounded-xl p-1 w-fit">
                        {['A', 'B', 'C', 'D', 'E'].map(b => (
                            <button
                                key={b}
                                onClick={() => setBlock(b)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                                    block === b
                                        ? 'bg-amber-400 text-indigo-900'
                                        : 'text-white/70 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                Block {b}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="relative z-10 mt-4 flex items-center gap-2 bg-white/10 rounded-xl p-1 w-fit">
                        <span className="px-4 py-1.5 text-sm font-bold text-white/70">Your Block: {block}</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                <Info size={18} className="shrink-0 mt-0.5 text-amber-500" />
                <p>Night mess items are available typically after 10 PM. Prices are per serving. Contact your hostel night mess counter to place an order.</p>
            </div>

            {/* Menu Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <Moon size={48} className="mx-auto text-gray-200 mb-4" />
                    <h3 className="font-bold text-gray-600 mb-2">No Night Mess Menu Available</h3>
                    <p className="text-gray-400 text-sm">Block {block} night mess menu hasn&apos;t been uploaded yet. Check back later.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex justify-between items-start hover:shadow-md transition-shadow group">
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{item.name}</h4>
                                {item.category && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        {item.category}
                                    </p>
                                )}
                                <span className="mt-2 inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                    Block {item.hostel_block}
                                </span>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <div className="flex items-center gap-1 text-lg font-bold text-emerald-600">
                                    <IndianRupee size={16} />
                                    {Number(item.price).toFixed(2)}
                                </div>
                                <span className="text-xs text-gray-400">per serving</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Refresh */}
            {!loading && (
                <div className="flex justify-center">
                    <button onClick={fetchItems}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors px-4 py-2 hover:bg-indigo-50 rounded-lg">
                        <RefreshCw size={14} /> Refresh Menu
                    </button>
                </div>
            )}
        </div>
    );
};

export default NightMessPage;
