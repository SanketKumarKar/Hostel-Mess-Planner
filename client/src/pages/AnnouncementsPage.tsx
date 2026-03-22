import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Megaphone, Calendar } from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    body: string;
    mess_type: string;
    caterer_id: string;
    created_at: string;
    caterer?: { full_name: string };
}

const AnnouncementsPage = () => {
    const { profile } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            if (!profile) return;
            
            try {
                let query = supabase.from('announcements').select('*, caterer:profiles!caterer_id(full_name)').order('created_at', { ascending: false });
                
                if (profile.role === 'student') {
                    if (!profile.assigned_caterer_id || !profile.mess_type) {
                        setAnnouncements([]);
                        setLoading(false);
                        return;
                    }
                    query = query
                        .eq('caterer_id', profile.assigned_caterer_id)
                        .in('mess_type', [profile.mess_type, 'all']);
                } else if (profile.role === 'caterer') {
                    query = query.eq('caterer_id', profile.id);
                }
                
                const { data } = await query;
                setAnnouncements(data || []);
            } catch (error) {
                console.error("Error fetching announcements:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnnouncements();
    }, [profile]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Loading announcements...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
                        <Megaphone className="w-6 h-6 sm:w-8 sm:h-8" />
                        Announcements
                    </h2>
                    <p className="opacity-90 max-w-xl text-sm sm:text-base">
                        Stay updated with the latest news, menu changes, and special events from your mess caterer.
                    </p>
                </div>
            </div>

            {announcements.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <Megaphone className="text-gray-300 mx-auto mb-4" size={48} />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">No Announcements</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                        {profile?.role === 'student' && (!profile.assigned_caterer_id || !profile.mess_type) 
                            ? "Please update your profile with a mess type to see announcements."
                            : "There are no announcements to display right now."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {announcements.map((ann) => (
                        <div key={ann.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">{ann.title}</h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {new Date(ann.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                        <span className="capitalize bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold border border-amber-200">
                                            To: {ann.mess_type === 'all' ? 'All' : ann.mess_type.replace('_', ' ')} 
                                            {ann.caterer?.full_name && <span className="lowercase font-normal mx-1">by</span>} 
                                            {ann.caterer?.full_name && <span className="font-semibold">{ann.caterer.full_name}</span>}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="prose prose-sm max-w-none text-gray-700">
                                <p className="whitespace-pre-wrap">{ann.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnnouncementsPage;
