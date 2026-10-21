import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { MEAL_TYPES } from '../utils/mealTimeUtils';
import { User, Calendar, Utensils, CheckCircle, XCircle, Search, MapPin, Flame, Dumbbell } from 'lucide-react';
import toast from 'react-hot-toast';

const ParentDashboard = () => {
    const { user } = useAuth();
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeDays, setActiveDays] = useState(7);
    const [searchedChildId, setSearchedChildId] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [menuData, setMenuData] = useState({});

    // Load children linked to parent email
    useEffect(() => {
        if (user?.email) loadChildren();
    // loadChildren only changes when the authenticated email changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email]);

    const loadChildren = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, reg_number, hostel_block, room_number, mess_type, assigned_caterer_id')
                .ilike('parent_email', user.email)
                .eq('role', 'student')
                .order('full_name');

            if (error) throw error;
            setChildren(data || []);

            // Auto-select first child if none selected
            if (!selectedChild && data?.length > 0) {
                setSelectedChild(data[0]);
            }
        } catch (e) {
            console.error('Error loading children:', e);
            toast.error('Failed to load children');
        } finally {
            setLoading(false);
        }
    };

    // Load attendance for selected child
    useEffect(() => {
        if (selectedChild) {
            fetchAttendance(selectedChild.id, activeDays);
        }
    }, [selectedChild, activeDays]);

    // Load menu data for selected child
    useEffect(() => {
        if (selectedChild) {
            fetchMenuData(selectedChild.mess_type);
        }
    }, [selectedChild]);

    const fetchAttendance = async (studentId, days) => {
        try {
            setLoading(true);
            const since = new Date();
            since.setDate(since.getDate() - days);

            const { data, error } = await supabase
                .from('meal_attendance')
                .select('*')
                .eq('student_id', studentId)
                .gte('date', since.toISOString().split('T')[0])
                .order('date', { ascending: false });

            if (error) throw error;
            setAttendance(data || []);
        } catch (e) {
            console.error('Error fetching attendance:', e);
            toast.error('Failed to load attendance');
        } finally {
            setLoading(false);
        }
    };

    const fetchMenuData = async (messType) => {
        try {
            // Get current active session
            const { data: sessions } = await supabase
                .from('voting_sessions')
                .select('*')
                .eq('status', 'finalized')
                .order('start_date', { ascending: false })
                .limit(1);

            if (!sessions || sessions.length === 0) {
                setMenuData({});
                return;
            }

            const currentSession = sessions[0];

            // Build date slots for the session (next 7 days)
            const startDate = new Date(currentSession.start_date);
            const slots = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                slots.push(date.toISOString().split('T')[0]);
            }

            // Fetch selected menu items for the week
            const { data: items, error } = await supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', currentSession.id)
                .eq('mess_type', messType)
                .is('is_selected', true)
                .in('date_served', slots)
                .order('date_served', { ascending: true })
                .order('meal_type', { ascending: true });

            if (error) throw error;

            // Group by date and meal type
            const grouped = {};
            (items || []).forEach(item => {
                const dateKey = item.date_served;
                if (!grouped[dateKey]) grouped[dateKey] = {};
                if (!grouped[dateKey][item.meal_type]) grouped[dateKey][item.meal_type] = [];
                grouped[dateKey][item.meal_type].push(item);
            });

            setMenuData(grouped);
        } catch (err) {
            console.error('Error fetching menu:', err);
            toast.error('Failed to load menu');
        }
    };

    // Process attendance data for display
    const byDate = attendance.reduce((acc, row) => {
        if (!acc[row.date]) acc[row.date] = [];
        acc[row.date].push(row);
        return acc;
    }, {});

    // Calculate stats
    const attendanceStats = MEAL_TYPES.map(mealType => {
        const count = attendance.filter(a => a.meal_type === mealType).length;
        const totalDays = Object.keys(byDate).length;
        const pct = totalDays ? Math.round((count / totalDays) * 100) : 0;
        return { meal: mealType, count, pct };
    });

    const searchChild = async () => {
        if (!searchedChildId.trim()) {
            toast.error('Enter student registration number');
            return;
        }

        setSearchLoading(true);
        setSearchResults(null);

        try {
            // Only allow searching children that belong to this parent (security)
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, reg_number, hostel_block, room_number, mess_type, assigned_caterer_id')
                .eq('reg_number', searchedChildId.trim())
                .ilike('parent_email', user.email)
                .eq('role', 'student')
                .single();

            if (error || !data) {
                toast.error('Student not found or not linked to your account');
                setSearchResults(null);
                return;
            }

            setSearchResults(data);
        } catch (e) {
            toast.error(e.message);
            setSearchResults(null);
        } finally {
            setSearchLoading(false);
        }
    };

    const selectChild = (child) => {
        setSelectedChild(child);
        setSearchedChildId('');
        setSearchResults(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // No children found
    if (children.length === 0 && !searchResults) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <User size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Parent Dashboard</h2>
                            <p className="text-sm text-white/80">No children linked to your account</p>
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                    <User size={18} className="shrink-0 mt-0.5 text-blue-500" />
                    <div>
                        <p className="font-medium mb-1">How to link a child</p>
                        <p className="text-xs text-blue-600">
                            Children are automatically linked when they use your email as their parent email during registration.
                            Ask your child to verify their parent email in their profile settings.
                        </p>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        Wait for child to link account
                    </h2>
                    <p className="text-gray-600">
                        Once your child sets your email as their parent email in their profile, you&apos;ll see their information here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-xl">
                        <User size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Parent Dashboard</h2>
                        <p className="text-sm text-white/80">Monitor your children&apos;s mess activities</p>
                    </div>
                </div>
            </div>

            {/* Children Overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <User size={18} /> My Children
                </h3>

                {children.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {children.map(child => (
                            <div
                                key={child.id}
                                className={`border-2 rounded-xl p-4 hover:shadow-md transition-all ${
                                    selectedChild && selectedChild.id === child.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-gray-200'
                                }`}
                                onClick={() => selectChild(child)}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center ${
                                        selectedChild && selectedChild.id === child.id
                                            ? 'border-primary/20 bg-primary'
                                            : 'border-gray-200 bg-gray-50'
                                    }">
                                        <CheckCircle size={16} className={
                                            selectedChild && selectedChild.id === child.id
                                                ? 'text-white'
                                                : 'text-gray-600'
                                        } />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{child.full_name}</p>
                                        <p className="text-sm text-gray-500">
                                            Reg: {child.reg_number} • Block {child.hostel_block} • Room {child.room_number}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-600">
                                    Mess: {(child.mess_type || 'Not Set').replace('_', ' ')}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 py-8">No children found</p>
                )}
            </div>

            {/* Selected Child Details */}
            {selectedChild && (
                <>
                    {/* Child Banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-full">
                                <CheckCircle size={20} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-emerald-600 font-medium">Selected Child</p>
                                <p className="font-bold text-gray-800">{selectedChild.full_name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setSelectedChild(null);
                                    setSearchedChildId('');
                                    setSearchResults(null);
                                }}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200 mb-6">
                        <div className="flex flex-col sm:flex-row border-b border-gray-200">
                            <button
                                onClick={() => setActiveDays(7)}
                                className={`flex-1 py-3 px-4 text-sm font-medium ${
                                    activeDays === 7
                                        ? 'border-b-2 border-primary text-primary'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-600'
                                }`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setActiveDays(14)}
                                className={`flex-1 py-3 px-4 text-sm font-medium ${
                                    activeDays === 14
                                        ? 'border-b-2 border-primary text-primary'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-600'
                                }`}
                            >
                                14 Days
                            </button>
                            <button
                                onClick={() => setActiveDays(30)}
                                className={`flex-1 py-3 px-4 text-sm font-medium ${
                                    activeDays === 30
                                        ? 'border-b-2 border-primary text-primary'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-600'
                                }`}
                            >
                                30 Days
                            </button>
                        </div>
                    </div>

                    {/* Search Section (only show if no child selected via auto-load) */}
                    {!selectedChild && children.length === 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Search size={18} /> Find Your Child
                            </h3>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Enter student registration number..."
                                    value={searchedChildId}
                                    onChange={e => setSearchedChildId(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && searchChild()}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
                                />
                                <button
                                    onClick={searchChild}
                                    disabled={searchLoading}
                                    className="px-6 py-2.5 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                                >
                                    {searchLoading ? (
                                        'Searching...'
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Search size={16} /> Search
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Search Results */}
                    {searchResults && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <CheckCircle size={18} className="shrink-0 mt-0.5 text-emerald-500" />
                                <div>
                                    <p className="font-medium mb-1">Child Found</p>
                                    <p className="text-sm text-emerald-700">
                                        {searchResults.full_name} (Reg: {searchResults.reg_number})
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={() => selectChild(searchResults)}
                                    className="w-full py-3 px-4 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                                >
                                    Select This Child
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Child Profile Info */}
                    {selectedChild && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User size={18} /> Student Information
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Name', value: selectedChild.full_name, icon: User },
                                    { label: 'Reg No.', value: selectedChild.reg_number, icon: Calendar },
                                    { label: 'Hostel', value: `${selectedChild.hostel_block} • Room ${selectedChild.room_number || 'N/A'}`, icon: MapPin },
                                    { label: 'Mess Type', value: (selectedChild.mess_type || 'Not Set').replace('_', ' '), icon: Utensils }
                                ].map(({ label, value, icon: Icon }) => (
                                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                            <Icon size={10} /> {label}
                                        </p>
                                        <p className="font-bold text-gray-900 text-sm capitalize truncate">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Attendance Section */}
                    {selectedChild && attendance.length > 0 && (
                        <>
                            {/* Attendance Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {attendanceStats.map(({ meal, count, pct }) => (
                                    <div key={meal} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${
                                            pct >= 70 ? 'bg-emerald-100' : pct >= 40 ? 'bg-amber-100' : 'bg-gray-100'
                                        }`}>
                                            <Utensils size={18} className={pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-gray-400'} />
                                        </div>
                                        <p className="text-xs text-gray-500 capitalize mb-1">{meal}</p>
                                        <p className="text-xl font-bold text-gray-900">{count}</p>
                                        <p className="text-xs text-gray-400">{activeDays} days ({pct}%)</p>
                                    </div>
                                ))}
                            </div>

                            {/* Attendance Calendar */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <Calendar size={18} /> Last {activeDays} Days Attendance
                                    </h3>
                                    <div className="flex gap-2">
                                        {[7, 14, 30].map(days => (
                                            <button
                                                key={days}
                                                onClick={() => { setActiveDays(days); fetchAttendance(selectedChild.id, days); }}
                                                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                                                    activeDays === days ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {days}D
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {Object.keys(byDate).length === 0 ? (
                                    <div className="text-center py-10">
                                        <Calendar size={40} className="mx-auto text-gray-200 mb-3" />
                                        <p className="text-gray-400">No attendance records found.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    <th className="text-left py-3 pr-6 text-gray-500 font-semibold">Date</th>
                                                    {MEAL_TYPES.map(m => (
                                                        <th key={m} className="text-center py-3 px-3 text-gray-500 font-semibold capitalize">{m}</th>
                                                    ))}
                                                    <th className="text-center py-3 px-3 text-gray-500 font-semibold">Meals</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(byDate)
                                                    .sort((a, b) => b[0].localeCompare(a[0]))
                                                    .slice(0, activeDays)
                                                    .map(([date, rows]) => {
                                                        const present = new Set(rows.map(r => r.meal_type));
                                                        const mealCount = rows.length;
                                                        return (
                                                            <tr key={date} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                                <td className="py-3 pr-6">
                                                                    <p className="font-medium text-gray-700">
                                                                        {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                                    </p>
                                                                </td>
                                                                {MEAL_TYPES.map(m => (
                                                                    <td key={m} className="py-3 px-3 text-center">
                                                                        {present.has(m) ? (
                                                                            <CheckCircle size={18} className="text-emerald-500 mx-auto" />
                                                                        ) : (
                                                                            <XCircle size={18} className="text-gray-200 mx-auto" />
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                <td className="py-3 px-3 text-center">
                                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                                        mealCount >= 3 ? 'bg-emerald-100 text-emerald-700' :
                                                                        mealCount >= 2 ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                        {mealCount}/4
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Today's Menu Preview */}
                    {selectedChild && selectedChild.mess_type && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Utensils size={18} /> Today&apos;s Approved Menu
                            </h3>

                            {Object.keys(menuData).length === 0 ? (
                                <div className="text-center py-8">
                                    <Utensils size={32} className="mx-auto text-gray-200 mb-3" />
                                    <p className="text-gray-500">No menu data available for today.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-3">
                                        <p className="text-sm text-gray-500">
                                            Menu for: {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        {MEAL_TYPES.map((mealType) => {
                                            const items = menuData[new Date().toISOString().split('T')[0]]?.[mealType] || [];
                                            if (items.length === 0) return null;

                                            return (
                                                <div key={mealType} className="border border-gray-100 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-lg">{mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🍛' : mealType === 'snacks' ? '🧁' : '🍽️'}</span>
                                                        <span className="font-bold text-gray-700 capitalize">{mealType}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {items.map(item => (
                                                            <span
                                                                key={item.id}
                                                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm"
                                                            >
                                                                {item.name}
                                                                {item.kcal !== null && (
                                                                    <>
                                                                        <span className="ml-2 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600">
                                                                            <Flame size={10} /> {item.kcal} kcal
                                                                        </span>
                                                                        {item.protein_grams !== null && (
                                                                            <span className="ml-1 inline-flex items-center gap-1 text-xs bg-green-50 text-green-600">
                                                                                <Dumbbell size={10} /> {item.protein_grams}g
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ParentDashboard;