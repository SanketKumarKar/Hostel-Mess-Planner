import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare, CheckCircle, Clock, Camera, X, Utensils, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getCurrentMealInfo, getMealLabel, MEAL_TYPES } from '../utils/mealTimeUtils';
import { buildSlotOptions } from '../utils/menuSlots';
import CustomSelect from '../components/CustomSelect';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const FeedbackPage = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState('daily');

    return (
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-8 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-4 sm:p-8 text-white shadow-lg">
                <h2 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
                    <MessageSquare className="w-5 h-5 sm:w-8 sm:h-8" /> Feedback Center
                </h2>
                <p className="opacity-90 text-xs sm:text-base">Share your thoughts on today's food or send general feedback to caterers.</p>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1.5 sm:gap-2 bg-white rounded-xl p-1 sm:p-1.5 shadow-sm border border-gray-100">
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'daily' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Utensils size={14} className="sm:w-4 sm:h-4" /> Today's Food
                </button>
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'general' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <MessageSquare size={14} className="sm:w-4 sm:h-4" /> General
                </button>
            </div>

            {activeTab === 'daily' ? <DailyFoodFeedback /> : <GeneralFeedback />}
        </div>
    );
};

// ─── Daily Food Feedback ──────────────────────────────────────
const DailyFoodFeedback = () => {
    const { profile } = useAuth();
    const [defaultMealInfo] = useState(() => getCurrentMealInfo());
    const [selectedMeal, setSelectedMeal] = useState(() => getCurrentMealInfo().mealType);
    const [menuItems, setMenuItems] = useState([]);
    const [message, setMessage] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [loadingMenu, setLoadingMenu] = useState(true);
    const [todaysFeedbacks, setTodaysFeedbacks] = useState([]);
    const [session, setSession] = useState(null);

    // Fetch today's menu from the finalized session
    const fetchTodayMenu = useCallback(async () => {
        if (!profile?.mess_type) return;
        setLoadingMenu(true);
        try {
            const { data: sessions } = await supabase
                .from('voting_sessions')
                .select('*')
                .eq('status', 'finalized')
                .order('start_date', { ascending: false })
                .limit(1);

            if (!sessions || sessions.length === 0) {
                setLoadingMenu(false);
                return;
            }

            const activeSession = sessions[0];
            setSession(activeSession);

            const slots = buildSlotOptions(activeSession.session_weeks);
            const todayDayIndex = new Date().getDay();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = dayNames[todayDayIndex];

            const matchingSlots = slots.filter(s => {
                const slotDate = new Date(`${s.value}T00:00:00`);
                return slotDate.toLocaleDateString('en-US', { weekday: 'long' }) === todayName;
            });

            if (matchingSlots.length === 0) {
                setLoadingMenu(false);
                return;
            }

            const slotDates = matchingSlots.map(s => s.value);
            const { data: items } = await supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', activeSession.id)
                .is('is_selected', true)
                .eq('mess_type', profile.mess_type)
                .eq('meal_type', selectedMeal)
                .in('date_served', slotDates)
                .order('name', { ascending: true });

            setMenuItems(items || []);
        } catch (err) {
            console.error('Error fetching today\'s menu:', err);
        } finally {
            setLoadingMenu(false);
        }
    }, [profile?.mess_type, selectedMeal]);

    // Fetch existing feedbacks for today + selected meal
    const fetchTodaysFeedbacks = useCallback(async () => {
        if (!profile) return;
        const { data } = await supabase
            .from('feedbacks')
            .select('*')
            .eq('student_id', profile.id)
            .eq('feedback_type', 'daily_food')
            .eq('feedback_date', defaultMealInfo.date)
            .eq('meal_type', selectedMeal)
            .order('created_at', { ascending: false });
        setTodaysFeedbacks(data || []);
    }, [profile?.id, defaultMealInfo.date, selectedMeal]);

    useEffect(() => { fetchTodayMenu(); fetchTodaysFeedbacks(); }, [fetchTodayMenu, fetchTodaysFeedbacks]);

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const removeImage = () => { setImageFile(null); setImagePreview(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) { toast.error('Please write your feedback'); return; }
        if (!profile?.assigned_caterer_id) { toast.error('No caterer assigned. Update your profile first.'); return; }

        setSubmitting(true);
        try {
            let imageUrl = null;

            if (imageFile) {
                const base64 = imagePreview.split(',')[1];
                const uploadRes = await axios.post(`${API_URL}/api/ai/upload-food-image`, { image: base64 });
                imageUrl = uploadRes.data.url;
            }

            const { error } = await supabase.from('feedbacks').insert({
                student_id: profile.id,
                caterer_id: profile.assigned_caterer_id,
                message: message.trim(),
                feedback_type: 'daily_food',
                meal_type: selectedMeal,
                feedback_date: defaultMealInfo.date,
                day_label: defaultMealInfo.day,
                image_url: imageUrl,
            });
            if (error) throw error;

            setMessage('');
            removeImage();
            toast.success(`${defaultMealInfo.day} ${selectedMeal} feedback submitted!`);
            fetchTodaysFeedbacks();
        } catch (err) {
            console.error('Feedback submit error:', err);
            toast.error('Failed to submit feedback: ' + (err.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const alreadySubmitted = todaysFeedbacks.length > 0;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Meal info banner + meal selector */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-3 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-amber-100 p-1.5 sm:p-2 rounded-lg shrink-0">
                        <Utensils size={18} className="text-amber-600 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg">{getMealLabel(selectedMeal)}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{defaultMealInfo.day}, {new Date(defaultMealInfo.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* Meal Type Selector */}
                <div className="flex gap-1.5 sm:gap-2">
                    {MEAL_TYPES.map(meal => (
                        <button
                            key={meal}
                            onClick={() => setSelectedMeal(meal)}
                            className={`flex-1 py-1.5 sm:py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-sm font-medium transition-all ${selectedMeal === meal
                                ? 'bg-amber-500 text-white shadow-md'
                                : 'bg-white/80 text-gray-600 hover:bg-white border border-amber-100'
                            }`}
                        >
                            {getMealLabel(meal)}
                            {meal === defaultMealInfo.mealType && selectedMeal !== meal && (
                                <span className="hidden sm:inline text-[9px] ml-1 opacity-60">•now</span>
                            )}
                        </button>
                    ))}
                </div>

                {selectedMeal !== defaultMealInfo.mealType && (
                    <p className="text-[10px] sm:text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Clock size={10} className="shrink-0" />
                        <span>Auto-detected: {getMealLabel(defaultMealInfo.mealType)} — you switched to {getMealLabel(selectedMeal)}</span>
                    </p>
                )}
            </div>

            {/* Today's Menu Items */}
            {loadingMenu ? (
                <div className="text-center py-6 text-gray-400 text-sm">Loading today's menu...</div>
            ) : menuItems.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">Today's {selectedMeal} Menu</h4>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {menuItems.map(item => (
                            <div key={item.id} className="bg-indigo-50 border border-indigo-100 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg">
                                <span className="font-medium text-indigo-900 text-xs sm:text-sm">{item.name}</span>
                                {item.description && <p className="text-[10px] sm:text-xs text-indigo-600 mt-0.5 hidden sm:block">{item.description}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4 sm:p-6 text-center text-gray-400 text-xs sm:text-sm">
                    No finalized menu items found for today's {selectedMeal}. Feedback can still be submitted.
                </div>
            )}

            {/* Feedback Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <Send size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
                    {alreadySubmitted ? 'Submit Additional Feedback' : 'Rate Today\'s Food'}
                </h3>

                {alreadySubmitted && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm text-green-700">
                        <CheckCircle size={14} className="shrink-0" />
                        <span>You've already submitted feedback for this meal.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Your Feedback</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary p-2.5 sm:p-3 bg-gray-50 hover:bg-white transition-colors border resize-none text-sm"
                            placeholder={`How was today's ${selectedMeal}? Any specific dish you liked or disliked?`}
                            required
                        />
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Attach Photo (optional)</label>
                        {imagePreview ? (
                            <div className="relative inline-block">
                                <img src={imagePreview} alt="Preview" className="w-28 h-28 sm:w-40 sm:h-40 object-cover rounded-xl border-2 border-gray-200 shadow-sm" />
                                <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-md transition-colors">
                                    <X size={12} className="sm:w-[14px] sm:h-[14px]" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-24 sm:h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-indigo-50/30 transition-all group">
                                <Camera size={24} className="text-gray-300 group-hover:text-primary transition-colors mb-1.5 sm:mb-2 sm:w-7 sm:h-7" />
                                <span className="text-xs sm:text-sm text-gray-400 group-hover:text-primary transition-colors">Tap to upload food photo</span>
                                <span className="text-[10px] sm:text-xs text-gray-300 mt-0.5">Max 10MB • 1 image</span>
                                <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                            </label>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !message.trim()}
                        className={`w-full py-2.5 sm:py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white text-sm sm:text-base transition-all ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-indigo-700 hover:shadow-md'}`}
                    >
                        {submitting ? (
                            <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                        ) : (
                            <><Send size={16} /> Submit {selectedMeal} Feedback</>
                        )}
                    </button>
                </form>
            </div>

            {/* Today's Feedback History */}
            {todaysFeedbacks.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your {selectedMeal} Feedback Today</h4>
                    {todaysFeedbacks.map(fb => (
                        <div key={fb.id} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] sm:text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium capitalize">{fb.meal_type} • {fb.day_label}</span>
                                <span className="text-[10px] sm:text-xs text-gray-400">{new Date(fb.created_at).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-gray-700 text-xs sm:text-sm bg-gray-50 p-2.5 sm:p-3 rounded-lg border border-gray-100">"{fb.message}"</p>
                            {fb.image_url && (
                                <img src={fb.image_url} alt="Food" className="mt-2 w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(fb.image_url, '_blank')} />
                            )}
                            {fb.response ? (
                                <div className="flex gap-2 items-start bg-green-50/50 p-2.5 rounded-lg border border-green-100 mt-2">
                                    <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={14} />
                                    <div><p className="text-[10px] font-bold text-green-700 mb-0.5">Response:</p><p className="text-xs sm:text-sm text-gray-700">{fb.response}</p></div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit mt-2"><Clock size={10} /> Pending</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── General Feedback (existing) ──────────────────────────────
const GeneralFeedback = () => {
    const { profile } = useAuth();
    const [caterers, setCaterers] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [selectedCaterer, setSelectedCaterer] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchData(); }, [profile]);

    const fetchData = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const { data: catererData } = await supabase.from('profiles').select('*').eq('role', 'caterer');
            setCaterers(catererData || []);
            const { data: feedbackData } = await supabase.from('feedbacks').select('*, caterer:profiles!caterer_id(full_name)').eq('student_id', profile.id).eq('feedback_type', 'general').order('created_at', { ascending: false });
            setFeedbacks(feedbackData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCaterer || !message.trim()) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('feedbacks').insert({ student_id: profile.id, caterer_id: selectedCaterer, message: message.trim(), feedback_type: 'general' });
            if (error) throw error;
            setMessage(''); setSelectedCaterer('');
            toast.success('Feedback submitted successfully!');
            fetchData();
        } catch (error) {
            console.error('Error submitting feedback:', error);
            toast.error('Failed to submit feedback.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center py-10">Loading...</div>;

    return (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 h-fit">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">Submit General Feedback</h3>
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Select Caterer</label>
                        <CustomSelect 
                            value={selectedCaterer} 
                            onChange={(val) => setSelectedCaterer(val)} 
                            options={caterers.map(c => ({ value: c.id, label: c.full_name }))}
                            placeholder="-- Choose a Caterer --"
                        />
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Your Message</label>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary p-2.5 sm:p-3 bg-gray-50 hover:bg-white transition-colors border resize-none text-sm" placeholder="Write your compliments or complaints here..." required />
                    </div>
                    <button type="submit" disabled={submitting || !selectedCaterer || !message} className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-white text-sm transition-all ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-indigo-700 hover:shadow-md'}`}>
                        {submitting ? 'Sending...' : <><Send size={16} /> Submit Feedback</>}
                    </button>
                </form>
            </div>

            <div className="space-y-3 sm:space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2">My History</h3>
                <div className="space-y-3 sm:space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                    {feedbacks.length === 0 ? (
                        <div className="text-center py-8 sm:py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed hover:bg-gray-100 transition-colors">
                            <MessageSquare size={36} className="mx-auto mb-2 opacity-20 sm:w-12 sm:h-12" />
                            <p className="text-sm">No general feedback sent yet.</p>
                        </div>
                    ) : (
                        feedbacks.map((item) => (
                            <div key={item.id} className="bg-white rounded-xl p-3.5 sm:p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2 sm:mb-3">
                                    <div>
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">To</span>
                                        <h4 className="font-bold text-gray-800 text-sm sm:text-base">{item.caterer?.full_name}</h4>
                                    </div>
                                    <span className="text-[10px] sm:text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg text-gray-700 text-xs sm:text-sm mb-2 sm:mb-3 border border-gray-100">"{item.message}"</div>
                                {item.response ? (
                                    <div className="flex gap-2 sm:gap-3 items-start bg-green-50/50 p-2.5 sm:p-3 rounded-lg border border-green-100">
                                        <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={14} />
                                        <div>
                                            <p className="text-[10px] sm:text-xs font-bold text-green-700 mb-0.5 sm:mb-1">Response:</p>
                                            <p className="text-xs sm:text-sm text-gray-700">{item.response}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                                        <Clock size={10} /> Pending Response
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeedbackPage;
