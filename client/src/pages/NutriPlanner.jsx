import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Flame, Dumbbell, Leaf, Zap, Plus, Minus, Trash2, Utensils, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const NutriPlanner = () => {
    const { profile } = useAuth();
    const [menuItems, setMenuItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeGoal, setActiveGoal] = useState('all');

    useEffect(() => {
        if (profile) fetchTodayMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.mess_type]);

    const fetchTodayMenu = async () => {
        if (!profile?.mess_type) return;
        setLoading(true);

        try {
            // Get current active session
            const { data: sessions } = await supabase
                .from('voting_sessions')
                .select('*')
                .eq('status', 'finalized')
                .order('start_date', { ascending: false })
                .limit(1);

            if (!sessions || sessions.length === 0) {
                setLoading(false);
                return;
            }

            const currentSession = sessions[0];

            // Get today's day name
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = dayNames[new Date().getDay()];

            // Build date slots for the session
            const startDate = new Date(currentSession.start_date);
            const slots = [];
            for (let i = 0; i < (currentSession.session_weeks === 2 ? 14 : 7); i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                if (date.toLocaleDateString('en-US', { weekday: 'long' }) === todayName) {
                    slots.push(date.toISOString().split('T')[0]);
                }
            }

            if (slots.length === 0) {
                setLoading(false);
                return;
            }

            // Fetch selected menu items for today
            const { data: items, error } = await supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', currentSession.id)
                .eq('mess_type', profile.mess_type)
                .is('is_selected', true)
                .in('date_served', slots)
                .order('meal_type', { ascending: true });

            if (error) throw error;
            setMenuItems(items || []);
        } catch (err) {
            console.error('Error fetching menu:', err);
            toast.error('Failed to load today&apos;s menu');
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (item) => {
        const exists = selectedItems.find(i => i.id === item.id);
        if (exists) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const clearPlate = () => {
        setSelectedItems([]);
        toast.success('Plate cleared');
    };

    // Calculate totals
    const totalCalories = selectedItems.reduce((sum, item) => sum + (item.kcal || 0), 0);
    const totalProtein = selectedItems.reduce((sum, item) => sum + (parseFloat(item.protein_grams) || 0), 0);
    const totalItems = selectedItems.length;

    // Filter items by nutritional goal
    const filterByGoal = (items) => {
        if (activeGoal === 'all') return items;

        return items.filter(item => {
            const name = item.name.toLowerCase();
            const kcal = item.kcal || 0;

            if (activeGoal === 'gym') {
                // High protein items - prefer explicit protein_grams, fallback to keywords
                const proteinGrams = parseFloat(item.protein_grams || 0);
                if (proteinGrams >= 10) return true; // Consider items with >=10g protein as gym-friendly
                const proteinKeywords = ['paneer', 'egg', 'chicken', 'fish', 'dal', 'sprouts', 'rajma', 'chole', 'soy', 'tofu'];
                return proteinKeywords.some(kw => name.includes(kw));
            }

            if (activeGoal === 'clean') {
                // Low calorie, light items
                const cleanKeywords = ['salad', 'soup', 'idli', 'phulka', 'boiled', 'steamed', 'curd', 'buttermilk', 'vegetable'];
                const isLowCalorie = kcal > 0 && kcal < 300;
                return cleanKeywords.some(kw => name.includes(kw)) || isLowCalorie;
            }

            if (activeGoal === 'energy') {
                // High carb items
                const energyKeywords = ['rice', 'paratha', 'naan', 'puri', 'roti', 'bread', 'pasta', 'noodles', 'oats', 'upma'];
                return energyKeywords.some(kw => name.includes(kw)) || kcal > 400;
            }

            return true;
        });
    };

    const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    const goals = [
        { id: 'all', label: 'All Items', icon: Utensils, color: 'text-gray-600' },
        { id: 'gym', label: 'Gym / High Protein', icon: Dumbbell, color: 'text-red-500' },
        { id: 'clean', label: 'Clean / Low Calorie', icon: Leaf, color: 'text-green-500' },
        { id: 'energy', label: 'Energy & Carbs', icon: Zap, color: 'text-amber-500' }
    ];

    const getMealItems = (mealType) => {
        return filterByGoal(menuItems.filter(item => item.meal_type === mealType));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-xl">
                        <Flame size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">NutriPlanner</h2>
                        <p className="text-sm text-white/80">Plan your daily nutrition from today&apos;s menu</p>
                    </div>
                </div>
            </div>

            {/* Daily Plate Summary */}
            {selectedItems.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Utensils size={18} className="text-amber-500" />
                            Your Daily Plate
                        </h3>
                        <button onClick={clearPlate} className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                            <Trash2 size={12} /> Clear
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
                            <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
                            <p className="text-xs text-gray-500">Items</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
                            <p className="text-2xl font-bold text-orange-500">{totalCalories}</p>
                            <p className="text-xs text-gray-500">Total kcal</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
                            <p className="text-2xl font-bold text-green-500">{totalProtein.toFixed(1)}g</p>
                            <p className="text-xs text-gray-500">Protein</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center border border-amber-100 col-span-3 sm:col-span-1">
                            <p className="text-xs text-gray-500 mb-1">Items Selected</p>
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar">
                                {selectedItems.slice(0, 10).map((item, idx) => (
                                    <span key={idx} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                                        {item.name}
                                    </span>
                                ))}
                                {selectedItems.length > 10 && (
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                        +{selectedItems.length - 10} more
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Goal Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {goals.map(goal => (
                    <button
                        key={goal.id}
                        onClick={() => setActiveGoal(goal.id)}
                        className={`rounded-xl p-3 border-2 transition-all text-center ${
                            activeGoal === goal.id
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                    >
                        <goal.icon size={20} className={`mx-auto mb-1 ${goal.color}`} />
                        <p className={`text-xs font-bold ${activeGoal === goal.id ? 'text-primary' : 'text-gray-600'}`}>
                            {goal.label}
                        </p>
                    </button>
                ))}
            </div>

            {/* Info Banner */}
            {activeGoal !== 'all' && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                    <Info size={18} className="shrink-0 mt-0.5 text-blue-500" />
                    <div>
                        <p className="font-medium mb-1">Filtering for: {goals.find(g => g.id === activeGoal)?.label}</p>
                        <p className="text-xs text-blue-600">
                            {activeGoal === 'gym' && 'Highlighting protein-rich items like paneer, eggs, chicken, dal, and sprouts.'}
                            {activeGoal === 'clean' && 'Showing low-calorie, light options like salads, soups, and steamed items.'}
                            {activeGoal === 'energy' && 'Featuring high-carb items like rice varieties, parathas, and whole grains.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Menu Items by Meal */}
            {menuItems.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <Utensils size={48} className="mx-auto text-gray-200 mb-4" />
                    <h3 className="font-bold text-gray-600 mb-2">No Menu Available</h3>
                    <p className="text-gray-400 text-sm">Today&apos;s menu hasn&apos;t been finalized yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {mealTypes.map(mealType => {
                        const items = getMealItems(mealType);
                        if (items.length === 0) return null;

                        return (
                            <div key={mealType} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">{mealType}</span>
                                    <span className="text-xs text-gray-400">({items.length} items)</span>
                                </h4>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {items.map(item => {
                                        const isSelected = selectedItems.find(i => i.id === item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleItem(item)}
                                                className={`rounded-xl p-3 border-2 text-left transition-all ${
                                                    isSelected
                                                        ? 'border-primary bg-primary/5 shadow-sm'
                                                        : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <h5 className="font-semibold text-gray-900 text-sm">{item.name}</h5>
                                                    {isSelected ? (
                                                        <Minus size={16} className="text-primary shrink-0" />
                                                    ) : (
                                                        <Plus size={16} className="text-gray-300 shrink-0" />
                                                    )}
                                                </div>
                                                {item.description && (
                                                    <p className="text-xs text-gray-500 mb-2 line-clamp-1">{item.description}</p>
                                                )}
                                                {(item.kcal || item.protein_grams) && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.kcal && (
                                                            <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                                                                <Flame size={12} /> {item.kcal} kcal
                                                            </span>
                                                        )}
                                                        {item.protein_grams && (
                                                            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                                                                <Dumbbell size={12} /> {item.protein_grams}g protein
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default NutriPlanner;
