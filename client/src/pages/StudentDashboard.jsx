import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
    getCurrentMealInfo, 
    getMealLabel, 
    isWithinMealWindow, 
    getNextMeal, 
    getMealWindow, 
    MEAL_TYPES 
} from '../utils/mealTimeUtils';
import { 
    User, 
    Utensils, 
    CheckCircle, 
    Flame, 
    Dumbbell, 
    Calendar, 
    Clock, 
    Check, 
    Megaphone, 
    Sun, 
    Moon, 
    Coffee, 
    Cookie,
    RotateCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatSlotLabel, buildSlotOptions } from '../utils/menuSlots';
import CustomSelect from '../components/CustomSelect';
import MessCrowdMeter from '../components/MessCrowdMeter';

const StudentDashboard = () => {
    const { profile, refreshProfile } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [assignedCaterer, setAssignedCaterer] = useState(null);

    // Attendance State
    const [checkedIn, setCheckedIn] = useState(false);
    const [checkInDetails, setCheckInDetails] = useState(null);
    const [expectedExit, setExpectedExit] = useState(null);

    // Fetch assigned caterer
    useEffect(() => {
        const fetchCaterer = async () => {
            if (profile?.assigned_caterer_id) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', profile.assigned_caterer_id)
                    .single();
                setAssignedCaterer(data);
            }
        };
        fetchCaterer();
    }, [profile]);

    // Fetch all voting sessions
    const fetchAllSessions = useCallback(async () => {
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
    }, []);

    // Fetch today's attendance status
    const fetchTodayAttendance = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('meal_attendance')
                .select('*')
                .eq('student_id', profile.id)
                .eq('date', today);

            if (error) throw error;

            const record = data?.[0] || null;
            setCheckedIn(!!record);

            if (record) {
                setCheckInDetails({
                    mealType: record.meal_type,
                    checkInTime: new Date(record.check_in_time),
                    expectedExitTime: new Date(record.expected_exit_time),
                    source: record.source
                });
                setExpectedExit(new Date(record.expected_exit_time));
            } else {
                setCheckInDetails(null);
                setExpectedExit(null);
            }
        } catch (err) {
            console.error('Error fetching attendance:', err);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchAllSessions();
        fetchTodayAttendance();
    }, [fetchAllSessions, fetchTodayAttendance]);

    const handleCheckIn = async (mealType) => {
        try {
            if (!isWithinMealWindow(mealType)) {
                toast.error(`Not within ${getMealLabel(mealType)} window (${getMealWindow(mealType)})`);
                return;
            }

            if (checkedIn) {
                toast.error('You have already checked in for a meal today');
                return;
            }

            const checkInTime = new Date();
            const exitOffsetMinutes = Math.floor(Math.random() * 8) + 15; // 15-22 minutes
            const expectedExitTime = new Date(checkInTime.getTime() + exitOffsetMinutes * 60 * 1000);
            const today = new Date().toISOString().split('T')[0];

            const { error } = await supabase
                .from('meal_attendance')
                .insert({
                    student_id: profile.id,
                    meal_date: today,
                    date: today,
                    meal_type: mealType,
                    mess_type: profile.mess_type,
                    logged_at: checkInTime.toISOString(),
                    duration_mins: exitOffsetMinutes,
                    method: 'self_log',
                    source: 'self_check_in',
                    check_in_time: checkInTime.toISOString(),
                    expected_exit_time: expectedExitTime.toISOString()
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    toast.error('Already checked in for this meal');
                } else {
                    throw error;
                }
                return;
            }

            toast.success(`Checked in for ${getMealLabel(mealType)}`);
            setCheckedIn(true);
            setCheckInDetails({
                mealType,
                checkInTime,
                expectedExitTime: expectedExitTime,
                source: 'self_check_in'
            });
            setExpectedExit(expectedExitTime);

            setTimeout(() => {
                fetchTodayAttendance();
            }, 1000);
        } catch (err) {
            toast.error(err.message || 'Check-in failed');
        }
    };

    const handleCheckOut = async () => {
        if (!checkInDetails) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const { error } = await supabase
                .from('meal_attendance')
                .delete()
                .match({
                    student_id: profile.id,
                    date: today,
                    meal_type: checkInDetails.mealType
                });

            if (error) throw error;

            toast.success('Checked out successfully');
            setCheckedIn(false);
            setCheckInDetails(null);
            setExpectedExit(null);
            fetchTodayAttendance();
        } catch (err) {
            toast.error(err.message || 'Check-out failed');
        }
    };

    const timeUntilExit = () => {
        if (!expectedExit) return null;
        const now = new Date();
        const diffMs = expectedExit - now;
        if (diffMs <= 0) return '00:00';
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const canCheckOut = () => {
        if (!expectedExit) return false;
        const now = new Date();
        const gracePeriodMs = 10 * 60 * 1000;
        return now <= new Date(expectedExit.getTime() + gracePeriodMs);
    };

    const SessionSwitcher = () => {
        const getShortStatus = (status) => {
            if (status === 'open_for_voting') return 'Voting';
            if (status === 'finalized') return 'Final';
            return status;
        };
        const formatTitle = (title) => (title && title.length > 22 ? title.substring(0, 22) + '...' : title || 'Session');

        if (!sessions || sessions.length === 0) return null;

        return (
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-gray-500 whitespace-nowrap hidden md:inline">Session:</span>
                <CustomSelect
                    value={selectedSession?.id || ''}
                    onChange={(val) => {
                        const s = sessions.find(s => s.id === val);
                        if (s) setSelectedSession(s);
                    }}
                    options={sessions.map(s => ({
                        value: s.id,
                        label: `${formatTitle(s.title)} ${s.week_label ? `[${s.week_label === 'week1' ? 'W1' : 'W2'}]` : ''} (${getShortStatus(s.status)})`
                    }))}
                    className="w-full sm:w-72"
                />
            </div>
        );
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
            {/* Top Bar with Title & Session Selection on Top Right */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Student Dashboard</h1>
                    <p className="text-xs sm:text-sm text-gray-500">Live menu, dining attendance, and voting sessions</p>
                </div>
                <div className="w-full sm:w-auto flex justify-end">
                    <SessionSwitcher />
                </div>
            </div>

            {/* Welcome Profile Card */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-primary rounded-2xl p-5 sm:p-6 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3.5 rounded-2xl backdrop-blur-md shrink-0">
                            <User size={28} />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold">Welcome, {profile?.full_name || 'Student'}</h2>
                            <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                                {profile?.hostel_block ? `Hostel Block ${profile.hostel_block}` : 'Hostel Block Not Set'} 
                                {profile?.room_number ? ` • Room ${profile.room_number}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                        {profile?.mess_type && (
                            <div className="bg-white/15 px-3 py-1.5 rounded-full font-medium backdrop-blur-md border border-white/20">
                                Mess: <span className="font-bold capitalize">{profile.mess_type.replace('_', ' ')}</span>
                            </div>
                        )}
                        {assignedCaterer && (
                            <div className="bg-white/15 px-3 py-1.5 rounded-full font-medium backdrop-blur-md border border-white/20">
                                Caterer: <span className="font-bold">{assignedCaterer.full_name}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setShowProfileEdit(true)}
                            className="bg-white text-primary px-3.5 py-1.5 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-sm"
                        >
                            Change Preferences
                        </button>
                        {profile?.role === 'admin' && (
                            <button onClick={() => refreshProfile()} className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full" title="Refresh Profile">
                                <RotateCw size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Today's Meal Status */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base sm:text-lg">
                    <Utensils size={18} className="text-primary" /> Today&apos;s Meal Status
                </h3>

                {(() => {
                    const mealInfo = getCurrentMealInfo();
                    if (!mealInfo) return null;
                    return (
                        <div className="mb-4 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Active meal window</p>
                                <p className="font-bold text-gray-900 text-base sm:text-lg">
                                    {getMealLabel(mealInfo.mealType)} ({getMealWindow(mealInfo.mealType)})
                                </p>
                            </div>
                        </div>
                    );
                })()}

                {/* Check-in / Check-out Panel */}
                <div className="space-y-3">
                    {checkedIn && checkInDetails ? (
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-100 shrink-0">
                                        <CheckCircle size={20} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            Checked in for {getMealLabel(checkInDetails.mealType)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Entry at {checkInDetails.checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
                                            Expected exit: {new Date(checkInDetails.expectedExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                {canCheckOut() && (
                                    <button
                                        onClick={handleCheckOut}
                                        className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
                                    >
                                        Check Out
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 text-xs text-emerald-800 font-medium">
                                Estimated time remaining: {timeUntilExit()}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                                {MEAL_TYPES.map((mealType) => {
                                    const inWindow = isWithinMealWindow(mealType);
                                    return (
                                        <button
                                            key={mealType}
                                            onClick={() => inWindow && handleCheckIn(mealType)}
                                            disabled={!inWindow || checkedIn}
                                            className={`p-3.5 rounded-xl border-2 transition-all text-left ${
                                                !inWindow
                                                    ? 'border-dashed border-gray-200 bg-gray-50/70 text-gray-400 cursor-not-allowed'
                                                    : checkedIn
                                                    ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'border-primary/40 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10 hover:shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    inWindow ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    <Utensils size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 truncate">{getMealLabel(mealType)}</p>
                                                    <p className="text-[11px] text-gray-500 truncate">{getMealWindow(mealType)}</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {!checkedIn && getNextMeal() && (
                                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                                    <Clock size={14} className="text-blue-600 shrink-0" />
                                    <span>Next meal: <strong>{getMealLabel(getNextMeal().meal)}</strong> in {getNextMeal().startsInMinutes} minutes</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Mess Crowd Status */}
            <MessCrowdMeter messType={profile?.mess_type} />

            {/* Announcements Panel */}
            {profile?.assigned_caterer_id && profile?.mess_type && (
                <AnnouncementsPanel catererId={profile.assigned_caterer_id} messType={profile.mess_type} />
            )}

            {/* Active Session Content */}
            {!selectedSession ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <Calendar size={36} className="mx-auto text-gray-300 mb-3" />
                    <h3 className="text-lg font-bold text-gray-800 mb-1">No Active Voting Sessions</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto">There are currently no menu sessions open for voting. Please check back later!</p>
                </div>
            ) : selectedSession.status === 'draft' ? (
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden text-center">
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-white/20 p-3.5 rounded-full mb-3 animate-pulse"><Utensils size={32} /></div>
                        <h2 className="text-xl sm:text-2xl font-bold mb-2">Menu Planning in Progress</h2>
                        <p className="text-sm sm:text-base opacity-95 mb-4 max-w-lg">
                            Menu items are being planned for <strong>{selectedSession.title}</strong>.
                        </p>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 w-full max-w-sm border border-white/20 text-xs sm:text-sm">
                            <h3 className="font-semibold mb-2.5 flex items-center justify-center gap-2">
                                <Calendar size={16} /> Upcoming Dates
                            </h3>
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                                    <span className="opacity-80">Start</span>
                                    <span className="font-bold">{new Date(selectedSession.start_date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="opacity-80">End</span>
                                    <span className="font-bold">{new Date(selectedSession.end_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs bg-black/20 px-3.5 py-1.5 rounded-full">
                            <Clock size={14} />
                            <span>Voting will open soon. Please check back later.</span>
                        </div>
                    </div>
                </div>
            ) : selectedSession.status === 'finalized' ? (
                <div className="space-y-6">
                    <TodayMenuHighlight session={selectedSession} />
                    <div className="flex justify-center">
                        <button
                            onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/generate-pdf/${selectedSession.id}/${profile?.mess_type}`, '_blank')}
                            className="bg-primary text-white py-2.5 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2 text-sm sm:text-base"
                        >
                            <Utensils size={18} /> Download Full Menu PDF
                        </button>
                    </div>
                </div>
            ) : (
                <VotingInterface session={selectedSession} onEditProfile={() => setShowProfileEdit(true)} />
            )}

            {/* Profile Editor Modal */}
            {showProfileEdit && <ProfileEditor onClose={() => setShowProfileEdit(false)} />}
        </div>
    );
};

const AnnouncementsPanel = ({ catererId, messType }) => {
    const [announcements, setAnnouncements] = useState([]);
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
                className="w-full flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 font-semibold hover:from-amber-100 hover:to-orange-100 transition-colors"
            >
                <span className="flex items-center gap-2 text-xs sm:text-sm">
                    <Megaphone size={16} className="text-amber-500 shrink-0" />
                    Announcements from your Caterer
                    <span className="bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {announcements.length}
                    </span>
                </span>
                <span className="text-amber-400 text-xs sm:text-sm">{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
                <div className="divide-y divide-amber-100 bg-white">
                    {announcements.map((ann) => (
                        <div key={ann.id} className="p-4 sm:p-5">
                            <div className="flex justify-between items-start mb-1 gap-2">
                                <h4 className="font-bold text-gray-900 text-sm">{ann.title}</h4>
                                <span className="text-[10px] sm:text-xs text-gray-400 shrink-0">
                                    {new Date(ann.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{ann.body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileEditor = ({ onClose }) => {
    const { profile } = useAuth();
    const [messType, setMessType] = useState(profile?.mess_type || 'veg');
    const [catererId, setCatererId] = useState(profile?.assigned_caterer_id || '');
    const [caterers, setCaterers] = useState([]);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (profile?.mess_type) setMessType(profile.mess_type);
        if (profile?.assigned_caterer_id) setCatererId(profile.assigned_caterer_id);
    }, [profile]);

    useEffect(() => {
        supabase
            .from('profiles')
            .select('id, full_name, served_mess_types')
            .eq('role', 'caterer')
            .contains('served_mess_types', [messType])
            .then(({ data }) => {
                setCaterers(data || []);
                if (data && !data.find((c) => c.id === catererId)) setCatererId('');
            });
    }, [messType, catererId]);

    const handleUpdate = async () => {
        if (!catererId) {
            toast.error('Please select a caterer.');
            return;
        }
        setUpdating(true);
        try {
            const preferencesChanged = profile?.mess_type !== messType || profile?.assigned_caterer_id !== catererId;
            if (preferencesChanged) {
                await supabase.from('votes').delete().eq('user_id', profile?.id);
            }
            const { error } = await supabase
                .from('profiles')
                .update({ mess_type: messType, assigned_caterer_id: catererId || null })
                .eq('id', profile?.id);

            if (error) throw error;

            toast.success(preferencesChanged ? 'Preferences updated! Previous votes cleared.' : 'Profile updated!');
            window.location.reload();
        } catch (error) {
            console.error('Profile update error:', error);
            toast.error('Error updating profile: ' + (error.message || 'Please try again.'));
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Update Profile Preferences</h3>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Select Mess Type</label>
                <div className="grid grid-cols-2 gap-2 mb-5">
                    {['veg', 'non_veg', 'special', 'food_park'].map((t) => (
                        <label
                            key={t}
                            className={`flex items-center gap-2.5 p-3 border rounded-xl cursor-pointer transition-colors ${
                                messType === t ? 'border-primary bg-primary/5 text-primary font-bold' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                            <input
                                type="radio"
                                name="messType"
                                value={t}
                                checked={messType === t}
                                onChange={(e) => setMessType(e.target.value)}
                                className="text-primary focus:ring-primary h-4 w-4"
                            />
                            <span className="capitalize text-xs sm:text-sm">{t.replace('_', ' ')}</span>
                        </label>
                    ))}
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Select Your Caterer</label>
                    <CustomSelect
                        value={catererId}
                        onChange={(val) => setCatererId(val)}
                        options={caterers.map((cat) => ({ value: cat.id, label: cat.full_name }))}
                        placeholder="Choose a Caterer..."
                        disabled={caterers.length === 0}
                    />
                    {caterers.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">No caterers serving {messType.replace('_', ' ')}. Contact admin.</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={updating || !catererId}
                        className="flex-1 py-2 bg-primary text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors shadow-sm"
                    >
                        {updating ? 'Saving...' : 'Save Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const VotingInterface = ({ session, onEditProfile }) => {
    const { profile } = useAuth();
    const [items, setItems] = useState([]);
    const [votes, setVotes] = useState(new Set());
    const [loading, setLoading] = useState(true);

    const fetchItemsAndVotes = useCallback(async () => {
        setLoading(true);
        try {
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', session.id)
                .eq('mess_type', profile.mess_type)
                .eq('approval_status', 'approved')
                .order('date_served', { ascending: true })
                .order('meal_type', { ascending: true });

            const { data: userVotes } = await supabase
                .from('votes')
                .select('menu_item_id')
                .eq('user_id', profile.id);

            setItems(menuItems || []);
            setVotes(new Set(userVotes?.map((v) => v.menu_item_id) || []));
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [session.id, profile?.mess_type, profile?.id]);

    useEffect(() => {
        if (profile?.mess_type) fetchItemsAndVotes();
    }, [profile?.mess_type, fetchItemsAndVotes]);

    const defaultLimits = { breakfast: 4, lunch: 8, snacks: 2, dinner: 8 };
    const getMealLimit = (mealType) => {
        const key = `${mealType}_limit`;
        return Number(session?.[key]) > 0 ? Number(session[key]) : defaultLimits[mealType] || 4;
    };

    const handleVote = async (targetItem) => {
        const previousVotes = new Set(votes);
        const newVotes = new Set(votes);
        const isVoted = votes.has(targetItem.id);

        if (isVoted) {
            newVotes.delete(targetItem.id);
            setVotes(newVotes);
            const { error } = await supabase
                .from('votes')
                .delete()
                .match({ user_id: profile?.id, menu_item_id: targetItem.id });
            if (error) setVotes(previousVotes);
        } else {
            const mealType = targetItem.meal_type;
            const limit = getMealLimit(mealType);
            const currentMealVotes = items.filter(
                (i) => i.date_served === targetItem.date_served && i.meal_type === mealType && votes.has(i.id)
            );
            if (currentMealVotes.length >= limit) {
                toast.error(`You can only vote for up to ${limit} ${mealType} items for this day.`);
                return;
            }
            newVotes.add(targetItem.id);
            setVotes(newVotes);
            const { error } = await supabase.from('votes').insert({ user_id: profile?.id, menu_item_id: targetItem.id });
            if (error) {
                setVotes(previousVotes);
                toast.error(error.message || 'Failed to cast vote');
            }
        }
    };

    const groupedItems = items.reduce((acc, item) => {
        const date = item.date_served;
        if (!acc[date]) acc[date] = {};
        if (!acc[date][item.meal_type]) acc[date][item.meal_type] = [];
        acc[date][item.meal_type].push(item);
        return acc;
    }, {});

    if (!profile?.mess_type) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 mb-4">Please update your profile with a mess type to vote.</p>
                <button onClick={onEditProfile} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    Set Mess Preference
                </button>
            </div>
        );
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading menu items...</div>;

    if (items.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <Calendar className="text-gray-300 mx-auto mb-3" size={32} />
                <h3 className="text-base font-bold text-gray-900 mb-1">No Menu Items Available Yet</h3>
                <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                    Menu items for <span className="font-semibold text-primary capitalize">{profile.mess_type.replace('_', ' ')}</span> mess are being reviewed by the admin. Check back soon!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {Object.entries(groupedItems).map(([date, meals]) => (
                <div key={date} className="animate-fade-in">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 sticky top-20 bg-background/95 backdrop-blur py-2 z-10 border-b border-gray-200">
                        {formatSlotLabel(date, session.session_weeks, 'long')}
                    </h3>
                    <div className="grid gap-5">
                        {['breakfast', 'lunch', 'snacks', 'dinner'].map((mealType) => {
                            const options = meals[mealType];
                            if (!options?.length) return null;
                            const currentMealVotesCount = options.filter((i) => votes.has(i.id)).length;
                            const limit = getMealLimit(mealType);
                            const isMealFull = currentMealVotesCount >= limit;

                            return (
                                <div key={mealType} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mealType}</h4>
                                        <span
                                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors ${
                                                isMealFull ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                            {currentMealVotesCount}/{limit} selected
                                        </span>
                                    </div>
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {options.map((item) => {
                                            const isVoted = votes.has(item.id);
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleVote(item)}
                                                    className={`relative cursor-pointer rounded-xl border-2 p-3.5 transition-all group ${
                                                        isVoted
                                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                            : isMealFull
                                                            ? 'border-gray-100 opacity-80 hover:border-gray-200'
                                                            : 'border-gray-100 hover:border-gray-300 hover:shadow-md'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <h5 className="font-semibold text-gray-900 text-sm">{item.name}</h5>
                                                        {isVoted ? (
                                                            <div className="bg-primary text-white p-1 rounded-full shadow-sm shrink-0">
                                                                <Check size={12} />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-200 group-hover:border-primary transition-colors shrink-0" />
                                                        )}
                                                    </div>

                                                    {item.description && (
                                                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description}</p>
                                                    )}

                                                    <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                                        {item.kcal !== null && item.kcal !== undefined && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">
                                                                <Flame size={10} /> {item.kcal} kcal
                                                            </span>
                                                        )}
                                                        {item.protein_grams !== null && item.protein_grams !== undefined && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
                                                                <Dumbbell size={10} /> {item.protein_grams}g
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                            isVoted
                                                                ? 'bg-primary text-white'
                                                                : 'bg-gray-100 text-gray-600 group-hover:bg-primary group-hover:text-white'
                                                        }`}
                                                    >
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

const TodayMenuHighlight = ({ session }) => {
    const { profile } = useAuth();
    const [todayItems, setTodayItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeMeal, setActiveMeal] = useState(() => getCurrentMealInfo()?.mealType || 'breakfast');
    const mealInfo = getCurrentMealInfo();

    useEffect(() => {
        if (!profile?.mess_type || !session) return;
        const fetchToday = async () => {
            try {
                const slots = buildSlotOptions(session.session_weeks);
                const todayDayIndex = new Date().getDay();
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const todayName = dayNames[todayDayIndex];

                const matchingSlots = slots.filter((s) => {
                    const slotDate = new Date(`${s.value}T00:00:00`);
                    return slotDate.toLocaleDateString('en-US', { weekday: 'long' }) === todayName;
                });

                if (matchingSlots.length === 0) {
                    setLoading(false);
                    return;
                }

                const slotDates = matchingSlots.map((s) => s.value);
                const { data: items } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('session_id', session.id)
                    .is('is_selected', true)
                    .eq('mess_type', profile.mess_type)
                    .in('date_served', slotDates)
                    .order('meal_type', { ascending: true });

                const grouped = {};
                (items || []).forEach((item) => {
                    if (!grouped[item.meal_type]) grouped[item.meal_type] = [];
                    grouped[item.meal_type].push(item);
                });
                setTodayItems(grouped);
            } catch (err) {
                console.error('Error fetching today menu:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchToday();
    }, [session, profile?.mess_type]);

    if (loading) return null;
    const mealKeys = Object.keys(todayItems);
    if (mealKeys.length === 0) return null;

    const mealIcons = { breakfast: Coffee, lunch: Sun, snacks: Cookie, dinner: Moon };
    const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
    const activeItems = todayItems[activeMeal] || [];

    return (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 rounded-2xl border border-emerald-200/80 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <div className="bg-emerald-100 p-2 rounded-xl shrink-0">
                    <Utensils size={18} className="text-emerald-700" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-bold text-emerald-950 text-sm sm:text-base">
                        Today&apos;s Menu — {mealInfo ? mealInfo.day : 'Daily Menu'}
                    </h3>
                    <p className="text-xs text-emerald-700">Tap a meal category to view confirmed items</p>
                </div>
            </div>

            <div className="flex gap-1.5 mb-3">
                {mealOrder.map((meal) => {
                    const IconComp = mealIcons[meal] || Utensils;
                    const hasItems = todayItems[meal] && todayItems[meal].length > 0;
                    const isActive = meal === activeMeal;
                    const isNow = mealInfo && meal === mealInfo.mealType;
                    return (
                        <button
                            key={meal}
                            onClick={() => setActiveMeal(meal)}
                            disabled={!hasItems}
                            className={`flex-1 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all flex flex-col sm:flex-row items-center justify-center gap-1 relative ${
                                isActive
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : hasItems
                                    ? 'bg-white text-gray-700 hover:bg-white/90 border border-emerald-100'
                                    : 'bg-gray-100/60 text-gray-300 cursor-not-allowed'
                            }`}
                        >
                            <IconComp size={14} />
                            <span>{meal}</span>
                            {isNow && hasItems && (
                                <span
                                    className={`absolute -top-1 -right-1 text-[8px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                        isActive ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                                    }`}
                                >
                                    NOW
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {activeItems.length > 0 ? (
                <div className="max-h-60 overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {activeItems.map((item) => (
                            <div key={item.id} className="bg-white border border-emerald-100 rounded-xl p-3 shadow-xs">
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
                                {item.description && (
                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                )}
                                {(item.kcal || item.protein_grams) && (
                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                        {item.kcal !== null && item.kcal !== undefined && (
                                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                                {item.kcal} kcal
                                            </span>
                                        )}
                                        {item.protein_grams !== null && item.protein_grams !== undefined && (
                                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                                {item.protein_grams}g protein
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-gray-400 text-center py-4">No confirmed items for {activeMeal}</p>
            )}
        </div>
    );
};

export default StudentDashboard;