import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { LogOut, User, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// Profile Setup Modal — shown after Google OAuth
// when required student fields are missing
// ─────────────────────────────────────────────
const ProfileSetupModal = ({ profile, onComplete }: { profile: any, onComplete: () => void }) => {
    const [regNumber, setRegNumber] = useState('');
    const [messType, setMessType] = useState<string>('veg');
    const [catererId, setCatererId] = useState('');
    const [caterers, setCaterers] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    // Fetch caterers matching the selected mess type
    useEffect(() => {
        const fetchCaterers = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, served_mess_types')
                .eq('role', 'caterer')
                .contains('served_mess_types', [messType]);
            setCaterers(data || []);
            setCatererId(''); // reset on mess type change
        };
        fetchCaterers();
    }, [messType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regNumber.trim()) { toast.error('Please enter your registration number.'); return; }
        if (!catererId) { toast.error('Please select a caterer.'); return; }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    reg_number: regNumber.trim(),
                    mess_type: messType,
                    assigned_caterer_id: catererId,
                })
                .eq('id', profile.id);

            if (error) throw error;
            onComplete();
            window.location.reload();
        } catch (err: any) {
            toast.error('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-indigo-700 p-6 text-white text-center">
                    <div className="bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User size={28} />
                    </div>
                    <h2 className="text-xl font-bold">Complete Your Profile</h2>
                    <p className="text-sm opacity-90 mt-1">Please fill in the required details to continue</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Registration Number */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Registration Number *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g., 2024001"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                            value={regNumber}
                            onChange={(e) => setRegNumber(e.target.value)}
                        />
                    </div>

                    {/* Mess Type */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Mess Type *</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['veg', 'non_veg', 'special', 'food_park'].map((type) => (
                                <label
                                    key={type}
                                    className={`flex items-center justify-center p-2.5 rounded-lg border-2 cursor-pointer hover:bg-gray-50 transition-all text-sm font-medium capitalize ${messType === type
                                            ? 'border-primary bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 text-gray-600'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="messType"
                                        value={type}
                                        checked={messType === type}
                                        onChange={(e) => setMessType(e.target.value)}
                                        className="sr-only"
                                    />
                                    {type.replace('_', ' ')}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Caterer Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Select Caterer *</label>
                        <select
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all bg-white"
                            value={catererId}
                            onChange={(e) => setCatererId(e.target.value)}
                            required
                            disabled={caterers.length === 0}
                        >
                            <option value="">-- Choose a Caterer --</option>
                            {caterers.map((c) => (
                                <option key={c.id} value={c.id}>{c.full_name}</option>
                            ))}
                        </select>
                        {caterers.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">
                                No caterers found serving {messType.replace('_', ' ')}. Contact admin.
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !catererId}
                        className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
                    >
                        {saving ? 'Saving...' : 'Save & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────
const Layout = () => {
    const { signOut, profile } = useAuth();
    const navigate = useNavigate();
    const [showSetup, setShowSetup] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Check if the student profile is incomplete
    useEffect(() => {
        if (profile && profile.role === 'student') {
            const needsSetup = !profile.reg_number || !profile.assigned_caterer_id || !profile.mess_type;
            setShowSetup(needsSetup);
        }
    }, [profile]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleNavClick = (path: string) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                            <img src="/logo.png" alt="Hostel Mess Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
                            <h1 className="text-lg sm:text-xl font-bold text-primary truncate max-w-[150px] sm:max-w-none">Hostel Menu</h1>
                        </div>
                        <nav className="hidden md:flex gap-4">
                            <button onClick={() => navigate('/')} className="text-gray-600 hover:text-primary font-medium">Dashboard</button>
                            <button onClick={() => navigate('/events')} className="text-gray-600 hover:text-primary font-medium">Events</button>
                            {['student', 'admin'].includes(profile?.role || '') && (
                                <button onClick={() => navigate('/announcements')} className="text-gray-600 hover:text-primary font-medium">Announcements</button>
                            )}
                            {profile?.role === 'student' && (
                                <button onClick={() => navigate('/feedback')} className="text-gray-600 hover:text-primary font-medium">Feedback</button>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        {profile && (
                            <div className="flex items-center gap-1 sm:gap-2 text-sm text-gray-600">
                                <span className="hidden sm:inline bg-gray-100 p-1 rounded-full"><User size={16} /></span>
                                <span className="max-w-[80px] sm:max-w-[150px] truncate text-xs sm:text-sm font-medium">{profile.full_name || 'User'}</span>
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:inline-block">{profile.role}</span>
                            </div>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Sign Out"
                        >
                            <LogOut size={18} className="sm:w-5 sm:h-5" />
                        </button>

                        {/* Mobile Menu Toggle */}
                        <button
                            className="md:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg ml-1"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-gray-100 bg-white animate-slide-down">
                        <nav className="flex flex-col px-4 pt-2 pb-4 space-y-1 shadow-inner">
                            <button onClick={() => handleNavClick('/')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Dashboard</button>
                            <button onClick={() => handleNavClick('/events')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Events</button>
                            {['student', 'admin'].includes(profile?.role || '') && (
                                <button onClick={() => handleNavClick('/announcements')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Announcements</button>
                            )}
                            {profile?.role === 'student' && (
                                <button onClick={() => handleNavClick('/feedback')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Feedback</button>
                            )}
                        </nav>
                    </div>
                )}
            </header>
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                <Outlet />
            </main>
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
                    Made with ❤️ by <span className="font-semibold text-primary">Sanket Kar</span>
                </div>
            </footer>

            {/* Mandatory profile setup modal for Google OAuth users */}
            {showSetup && profile && (
                <ProfileSetupModal
                    profile={profile}
                    onComplete={() => setShowSetup(false)}
                />
            )}
        </div>
    );
};

export default Layout;
