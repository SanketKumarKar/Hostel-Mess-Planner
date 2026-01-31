import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Calendar, MapPin, Trash, X } from 'lucide-react';

interface Event {
    id: string;
    title: string;
    description: string;
    date: string;
    location: string;
    image_url?: string;
}

const EventsPage = () => {
    const { profile } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [location, setLocation] = useState('');

    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('date', { ascending: true });

            if (error) throw error;
            setEvents(data || []);
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('events').insert({
                title,
                description,
                date,
                location
            });

            if (error) throw error;

            setShowCreate(false);
            // Reset form
            setTitle('');
            setDescription('');
            setDate('');
            setLocation('');

            fetchEvents();
        } catch (error) {
            alert('Error creating event');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            await supabase.from('events').delete().eq('id', id);
            setEvents(events.filter(e => e.id !== id));
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading events...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Upcoming Events</h2>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Add Event
                    </button>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold">Create New Event</h3>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                                <input required type="text" className="w-full px-3 py-2 border rounded-lg" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Hostel Night 2024" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                                <input required type="datetime-local" className="w-full px-3 py-2 border rounded-lg" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input required type="text" className="w-full px-3 py-2 border rounded-lg" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Main Auditorium" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea required className="w-full px-3 py-2 border rounded-lg h-24" value={description} onChange={e => setDescription(e.target.value)} placeholder="Event details..." />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700">Create Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {events.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
                    <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No Upcoming Events</h3>
                    <p className="text-gray-500 mt-1">Check back later for new announcements.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map(event => (
                        <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                            {event.image_url ? (
                                <div className="h-48 bg-gray-200 w-full object-cover">
                                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                    <Calendar size={48} className="opacity-50" />
                                </div>
                            )}
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                                <div className="space-y-2 text-sm text-gray-600 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={16} className="text-primary" />
                                        <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-primary" />
                                        <span>{event.location}</span>
                                    </div>
                                </div>
                                <p className="text-gray-600 text-sm line-clamp-3 mb-4">{event.description}</p>

                                {isAdmin && (
                                    <div className="pt-4 border-t flex justify-end">
                                        <button
                                            onClick={() => handleDelete(event.id)}
                                            className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                        >
                                            <Trash size={16} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EventsPage;
