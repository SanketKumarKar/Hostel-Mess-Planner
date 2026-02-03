import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Feedback, Profile } from '../types';
import { Send, MessageSquare, CheckCircle, Clock } from 'lucide-react';

const FeedbackPage = () => {
    const { profile } = useAuth();
    const [caterers, setCaterers] = useState<Profile[]>([]);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [selectedCaterer, setSelectedCaterer] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [profile]);

    const fetchData = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            // Fetch Caterers
            const { data: catererData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'caterer');

            setCaterers(catererData || []);

            // Fetch My Feedbacks
            const { data: feedbackData } = await supabase
                .from('feedbacks')
                .select('*, caterer:profiles!caterer_id(full_name)')
                .eq('student_id', profile.id)
                .order('created_at', { ascending: false });

            setFeedbacks(feedbackData as Feedback[] || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCaterer || !message.trim()) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('feedbacks')
                .insert({
                    student_id: profile.id,
                    caterer_id: selectedCaterer,
                    message: message.trim()
                });

            if (error) throw error;

            setMessage('');
            setSelectedCaterer('');
            alert('Feedback submitted successfully!');
            fetchData(); // Refresh list
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center py-10">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <MessageSquare /> Feedback Center
                </h2>
                <p className="opacity-90">Share your thoughts directly with the caterers to help improve the service.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Submit Feedback Form */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Submit New Feedback</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Caterer</label>
                            <select
                                value={selectedCaterer}
                                onChange={(e) => setSelectedCaterer(e.target.value)}
                                className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary p-2.5 bg-gray-50 hover:bg-white transition-colors border"
                                required
                            >
                                <option value="">-- Choose a Caterer --</option>
                                {caterers.map(c => (
                                    <option key={c.id} value={c.id}>{c.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Your Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                className="w-full rounded-lg border-gray-300 focus:ring-primary focus:border-primary p-3 bg-gray-50 hover:bg-white transition-colors border resize-none"
                                placeholder="Write your compliments or complaints here..."
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || !selectedCaterer || !message}
                            className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-all
                                ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-indigo-700 hover:shadow-md'}`}
                        >
                            {submitting ? 'Sending...' : <><Send size={18} /> Submit Feedback</>}
                        </button>
                    </form>
                </div>

                {/* Feedback History */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">My History</h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {feedbacks.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed hover:bg-gray-100 transition-colors">
                                <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
                                <p>No feedback sent yet.</p>
                            </div>
                        ) : (
                            feedbacks.map((item) => (
                                <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">To</span>
                                            <h4 className="font-bold text-gray-800">{item.caterer?.full_name}</h4>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-lg text-gray-700 text-sm mb-3 border border-gray-100">
                                        "{item.message}"
                                    </div>

                                    {item.response ? (
                                        <div className="flex gap-3 items-start bg-green-50/50 p-3 rounded-lg border border-green-100">
                                            <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <p className="text-xs font-bold text-green-700 mb-1">Response:</p>
                                                <p className="text-sm text-gray-700">{item.response}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                                            <Clock size={12} /> Pending Response
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeedbackPage;
