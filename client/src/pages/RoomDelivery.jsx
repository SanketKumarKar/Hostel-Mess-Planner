import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    FileText,
    Image,
    MapPin,
    Package,
    Plus,
    RefreshCw,
    Truck,
    XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';//

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_CONFIG = {
    pending: { label: 'Pending review', color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
    approved: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-50', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
    packed: { label: 'Packed', color: 'text-purple-700', bg: 'bg-purple-50', icon: Package },
    out_for_delivery: { label: 'Out for delivery', color: 'text-orange-700', bg: 'bg-orange-50', icon: Truck },
    delivered: { label: 'Delivered', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle }
};

const getAuthHeaders = async () => {
    const { supabase } = await import('../supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

    return {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
    };
};

const apiRequest = async (path, options = {}) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body;
};

const RequestCard = ({ request, children }) => {
    const config = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
    const StatusIcon = config.icon;

    return (
        <article className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <div className="flex flex-wrap gap-2 items-center mb-1">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold ${config.bg} ${config.color}`}>
                            <StatusIcon size={13} /> {config.label}
                        </span>
                        <span className="text-xs text-gray-400">
                            Submitted {new Date(request.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <h3 className="font-bold text-gray-900 capitalize">
                        {request.meal_type} · {new Date(`${request.date}T00:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'short', day: 'numeric', month: 'short'
                        })}
                    </h3>
                </div>
                <StatusIcon className={config.color} size={22} />
            </div>

            {request.student && (
                <p className="text-sm font-medium text-gray-700 mb-2">
                    {request.student.full_name} <span className="text-xs font-normal text-gray-400">({request.student.reg_number || 'No registration number'})</span>
                </p>
            )}

            <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <p className="flex items-center gap-1.5"><MapPin size={13} /> Block {request.hostel_block} · Room {request.room_number}</p>
                <p className="flex items-center gap-1.5"><FileText size={13} /> {request.reason}</p>
            </div>

            {request.admin_notes && (
                <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-xs text-blue-800">
                    <span className="font-bold">Admin note: </span>{request.admin_notes}
                </p>
            )}

            {request.proof_image_url && (
                <a
                    href={request.proof_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                    <Image size={13} /> View attached proof
                </a>
            )}
            {children}
        </article>
    );
};

const StudentRequestForm = ({ onClose, onSuccess }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mealType, setMealType] = useState('lunch');
    const [reason, setReason] = useState('');
    const [proofUrl, setProofUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!reason.trim()) return toast.error('Please provide the reason for delivery.');

        setSubmitting(true);
        try {
            await apiRequest('/api/room-delivery', {
                method: 'POST',
                body: JSON.stringify({
                    date,
                    meal_type: mealType,
                    reason: reason.trim(),
                    proof_image_url: proofUrl.trim() || null
                })
            });
            toast.success('Delivery request submitted for review.');
            onSuccess();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form onSubmit={handleSubmit} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-5 text-white">
                    <h2 className="text-lg font-bold">New room delivery request</h2>
                    <p className="text-sm text-white/80">Your registered block and room will be used automatically.</p>
                </div>
                <div className="space-y-4 p-5">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-bold text-gray-700">Date
                            <input type="date" min={new Date().toISOString().split('T')[0]} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200" required />
                        </label>
                        <label className="text-xs font-bold text-gray-700">Meal
                            <select value={mealType} onChange={(event) => setMealType(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200">
                                {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal) => <option key={meal} value={meal}>{meal[0].toUpperCase() + meal.slice(1)}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="block text-xs font-bold text-gray-700">Medical reason or symptoms
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="For example: Fever and medically advised rest" className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200" required />
                    </label>
                    <label className="block text-xs font-bold text-gray-700">Proof URL (optional)
                        <input type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="Configured private storage link" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200" />
                    </label>
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                        <button disabled={submitting} className="flex-1 rounded-lg bg-rose-500 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit request'}</button>
                    </div>
                </div>
            </form>
        </div>
    );
};

const StudentView = ({ requests, loading, refresh }) => {
    const [showForm, setShowForm] = useState(false);

    const cancelRequest = async (id) => {
        try {
            await apiRequest(`/api/room-delivery/${id}`, { method: 'DELETE' });
            toast.success('Pending request cancelled.');
            refresh();
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <>
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-4"><div className="rounded-xl bg-white/20 p-3"><Package size={28} /></div><div><h1 className="text-xl font-bold">Care Delivery</h1><p className="text-sm text-white/80">Request a meal when you cannot visit the mess.</p></div></div>
                <button onClick={() => setShowForm(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2 font-bold text-rose-600 hover:bg-rose-50"><Plus size={18} /> New request</button>
            </div>
            <InfoBanner />
            <RequestList title="Your requests" requests={requests} loading={loading} refresh={refresh} emptyMessage="You have not requested a room delivery." renderActions={(request) => request.status === 'pending' && <button onClick={() => cancelRequest(request.id)} className="mt-3 text-xs font-semibold text-red-600 hover:underline">Cancel request</button>} />
            {showForm && <StudentRequestForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); refresh(); }} />}
        </>
    );
};

const AdminView = ({ requests, loading, refresh }) => {
    const [notes, setNotes] = useState({});
    const [updatingId, setUpdatingId] = useState(null);

    const review = async (request, status) => {
        const note = notes[request.id]?.trim();
        if (!note) return toast.error('Add an approval or rejection comment first.');

        setUpdatingId(request.id);
        try {
            await apiRequest(`/api/room-delivery/${request.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status, admin_notes: note })
            });
            toast.success(status === 'approved' ? 'Request approved.' : 'Request rejected.');
            refresh();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <>
            <PageHeader title="Care Delivery Reviews" subtitle="Review student medical meal-delivery requests." icon={Package} />
            <RequestList title="Review queue" requests={requests} loading={loading} refresh={refresh} emptyMessage="There are no delivery requests to review." renderActions={(request) => request.status === 'pending' && (
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                    <textarea value={notes[request.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} rows={2} placeholder="Required review comment" className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20" />
                    <div className="flex gap-2">
                        <button disabled={updatingId === request.id} onClick={() => review(request, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                        <button disabled={updatingId === request.id} onClick={() => review(request, 'rejected')} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
                    </div>
                </div>
            )} />
        </>
    );
};

const CatererView = ({ requests, loading, refresh }) => {
    const [updatingId, setUpdatingId] = useState(null);
    const transitions = { approved: ['packed', 'Mark packed'], packed: ['out_for_delivery', 'Send out'], out_for_delivery: ['delivered', 'Mark delivered'] };

    const advance = async (request) => {
        const [status] = transitions[request.status] || [];
        if (!status) return;
        setUpdatingId(request.id);
        try {
            await apiRequest(`/api/room-delivery/${request.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            toast.success(`Marked as ${STATUS_CONFIG[status].label.toLowerCase()}.`);
            refresh();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <>
            <PageHeader title="Care Delivery Kitchen" subtitle="Pack and deliver only requests assigned to your students." icon={Package} />
            <RequestList title="Active delivery jobs" requests={requests} loading={loading} refresh={refresh} emptyMessage="No approved delivery jobs are waiting." renderActions={(request) => {
                const transition = transitions[request.status];
                return transition && <button disabled={updatingId === request.id} onClick={() => advance(request)} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{updatingId === request.id ? 'Updating…' : transition[1]}</button>;
            }} />
        </>
    );
};

const PageHeader = ({ title, subtitle, icon: Icon }) => (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4"><div className="rounded-xl bg-white/20 p-3"><Icon size={28} /></div><div><h1 className="text-xl font-bold">{title}</h1><p className="text-sm text-white/80">{subtitle}</p></div></div>
    </div>
);

const InfoBanner = () => (
    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <p>Use this service when illness or injury prevents you from reaching the mess. An administrator reviews every request before the kitchen packs it.</p>
    </div>
);

const RequestList = ({ title, requests, loading, refresh, emptyMessage, renderActions }) => (
    <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-gray-800">{title}</h2><button onClick={refresh} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-primary"><RefreshCw size={13} /> Refresh</button></div>
        {loading ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div> : requests.length === 0 ? <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm"><Package size={44} className="mx-auto mb-3 text-gray-200" /><p className="text-sm text-gray-500">{emptyMessage}</p></div> : <div className="space-y-3">{requests.map((request) => <RequestCard key={request.id} request={request}>{renderActions(request)}</RequestCard>)}</div>}
    </section>
);

const RoomDelivery = () => {
    const { profile } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        if (!profile?.role) return;
        setLoading(true);
        try {
            const path = profile.role === 'admin' ? '/api/room-delivery/admin' : profile.role === 'caterer' ? '/api/room-delivery/caterer' : '/api/room-delivery/mine';
            const data = await apiRequest(path);
            setRequests(data || []);
        } catch (error) {
            toast.error(error.message || 'Failed to load delivery requests.');
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [profile?.role]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    return (
        <div className="space-y-6 animate-fade-in">
            {profile?.role === 'admin' && <AdminView requests={requests} loading={loading} refresh={fetchRequests} />}
            {profile?.role === 'caterer' && <CatererView requests={requests} loading={loading} refresh={fetchRequests} />}
            {profile?.role === 'student' && <StudentView requests={requests} loading={loading} refresh={fetchRequests} />}
        </div>
    );
};

export default RoomDelivery;
