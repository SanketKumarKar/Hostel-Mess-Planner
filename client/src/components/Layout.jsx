import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { LogOut, User, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomSelect from './CustomSelect';

// ─────────────────────────────────────────────
// Profile Setup Modal — shown after Google OAuth
// when required student fields are missing
// ─────────────────────────────────────────────
const ProfileSetupModal = ({ profile, onComplete, refreshProfile }) => {
    const [regNumber, setRegNumber] = useState('');
    const [messType, setMessType] = useState('veg');
    const [catererId, setCatererId] = useState('');
    const [caterers, setCaterers] = useState([]);
    const [hostelBlock, setHostelBlock] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!regNumber.trim()) { toast.error('Please enter your registration number.'); return; }
        if (!catererId) { toast.error('Please select a caterer.'); return; }
        if (!hostelBlock) { toast.error('Please select your hostel block.'); return; }
        if (!roomNumber.trim()) { toast.error('Please enter your room number.'); return; }
        if (!parentEmail.trim()) { toast.error('Please enter parent email.'); return; }
        if (!validateEmail(parentEmail)) { toast.error('Please enter a valid email address.'); return; }
        if (!agreePrivacy) { toast.error('Please agree to the privacy policy.'); return; }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    reg_number: regNumber.trim(),
                    mess_type: messType,
                    assigned_caterer_id: catererId,
                    hostel_block: hostelBlock.toUpperCase(),
                    room_number: roomNumber.trim(),
                    parent_email: parentEmail.trim().toLowerCase(),
                })
                .eq('id', profile.id);

            if (error) throw error;
            onComplete();
            await refreshProfile(); // Refresh context instead of reload
        } catch (err) {
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
                        <CustomSelect
                            value={catererId}
                            onChange={(val) => setCatererId(val)}
                            options={caterers.map(c => ({ value: c.id, label: c.full_name }))}
                            placeholder="-- Choose a Caterer --"
                            disabled={caterers.length === 0}
                        />
                        {caterers.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">
                                Please select any mess type or contact admin.
                            </p>
                        )}
                    </div>

                    {/* Hostel Block */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Hostel Block *</label>
                        <CustomSelect
                            value={hostelBlock}
                            onChange={(val) => setHostelBlock(val)}
                            options={['A', 'B', 'C', 'D', 'E'].map(b => ({ value: b, label: `Block ${b}` }))}
                            placeholder="-- Select Block --"
                        />
                    </div>

                    {/* Room Number */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Room Number *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g., 304"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                        />
                    </div>

                    {/* Parent Email */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Parent Email *</label>
                        <input
                            type="email"
                            required
                            placeholder="parent@example.com"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                            value={parentEmail}
                            onChange={(e) => setParentEmail(e.target.value)}
                        />
                    </div>

                    {/* Privacy Agreement */}
                    <div className="flex items-start gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="setup-privacy"
                            checked={agreePrivacy}
                            onChange={(e) => setAgreePrivacy(e.target.checked)}
                            className="custom-checkbox mt-[5px] w-3.5 h-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
                        />
                        <label htmlFor="setup-privacy" className="text-sm text-gray-600">
                            I agree to the <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-primary hover:underline font-medium">Privacy Policy</button>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !catererId || !agreePrivacy}
                        className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
                    >
                        {saving ? 'Saving...' : 'Save & Continue'}
                    </button>
                </form>
            </div>

            {/* Privacy Policy Modal */}
            {showPrivacyModal && (
                <div className="fixed inset-0 bg-transparent backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setShowPrivacyModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">Privacy Policy</h2>
                            <button onClick={() => setShowPrivacyModal(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-gray-600 space-y-4">
                            <p>Welcome to FeastFull. We are committed to protecting your personal information and your right to privacy.</p>

                            <h3 className="font-bold text-gray-800 text-base mt-4">1. Information We Collect</h3>
                            <p>We collect personal information that you voluntarily provide to us when you register on the App, including your name, email address, roll number, hostel block, room number, parent email, and dietary preferences (such as mess type). We also collect data regarding your voting activity, feedback, attendance, and app usage.</p>

                            <h3 className="font-bold text-gray-800 text-base mt-4">2. How We Use Your Information</h3>
                            <p>We use personal information collected via our App for a variety of business purposes, including:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>To facilitate account creation and login process.</li>
                                <li>To manage your orders, voting, meal preferences, and attendance.</li>
                                <li>To enable parent portal access for linked children.</li>
                                <li>To improve our services and platform analytics.</li>
                                <li>To send administrative information to you.</li>
                            </ul>

                            <h3 className="font-bold text-gray-800 text-base mt-4">3. Will Your Information Be Shared?</h3>
                            <p>We only share and disclose your information in the following situations:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Caterers:</strong> Your assigned caterer may see your feedback, meal preferences, and room delivery requests to improve food quality.</li>
                                <li><strong>Parents:</strong> Parents linked via email can view their child&apos;s profile, attendance, and menu.</li>
                                <li><strong>Administrators:</strong> App admins have access to user lists for management and security purposes.</li>
                                <li><strong>Legal Obligations:</strong> If required by law, we may disclose your information.</li>
                            </ul>

                            <h3 className="font-bold text-gray-800 text-base mt-4">4. Security of Your Information</h3>
                            <p>We use administrative, technical, and physical security measures to help protect your personal information (powered by Supabase). While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable.</p>

                            <p className="pt-4 text-xs text-gray-400">By using FeastFull, you agree to this Privacy Policy.</p>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button onClick={() => setShowPrivacyModal(false)} className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────
const Layout = () => {
    const { signOut, profile, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [dismissedSetupProfileId, setDismissedSetupProfileId] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Extended required fields for student setup
    const profileNeedsSetup = profile?.role === 'student' && (
        !profile.reg_number ||
        !profile.assigned_caterer_id ||
        !profile.mess_type ||
        !profile.hostel_block ||
        !profile.room_number ||
        !profile.parent_email
    );
    const showSetup = profileNeedsSetup && dismissedSetupProfileId !== profile.id;

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleNavClick = (path) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-8">
                        <div className="flex shrink-0 items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                            <img src="/FeastFull_LOGO.png" alt="FeastFull Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
                            <h1 className="text-lg sm:text-xl font-bold text-primary truncate max-w-[150px] sm:max-w-none">FeastFull</h1>
                        </div>
                        <nav className="hidden min-w-0 flex-1 items-center gap-3 overflow-x-auto md:flex" aria-label="Primary navigation">
                            <button onClick={() => navigate('/')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Dashboard</button>
                            <button onClick={() => navigate('/events')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Events</button>
                            {['student', 'admin'].includes(profile?.role || '') && (
                                <button onClick={() => navigate('/announcements')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Announcements</button>
                            )}
                            {profile?.role === 'student' && (
                                <>
                                    <button onClick={() => navigate('/feedback')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Feedback</button>
                                    <button onClick={() => navigate('/night-mess')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Night Mess</button>
                                    <button onClick={() => navigate('/nutriplan')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">NutriPlan</button>
                                    <button onClick={() => navigate('/room-delivery')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Care Delivery</button>
                                </>
                            )}
                            {profile?.role === 'caterer' && (
                                <button onClick={() => navigate('/room-delivery')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">Special Requests</button>
                            )}
                            {profile?.role === 'parent' && (
                                <button onClick={() => navigate('/parent')} className="shrink-0 whitespace-nowrap text-gray-600 hover:text-primary font-medium">My Children</button>
                            )}
                        </nav>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
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
                            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                            aria-expanded={isMobileMenuOpen}
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
                                <>
                                    <button onClick={() => handleNavClick('/feedback')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Feedback</button>
                                    <button onClick={() => handleNavClick('/night-mess')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Night Mess</button>
                                    <button onClick={() => handleNavClick('/nutriplan')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">NutriPlan</button>
                                    <button onClick={() => handleNavClick('/room-delivery')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Care Delivery</button>
                                </>
                            )}
                            {profile?.role === 'caterer' && (
                                <button onClick={() => handleNavClick('/room-delivery')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">Special Requests</button>
                            )}
                            {profile?.role === 'parent' && (
                                <button onClick={() => handleNavClick('/parent')} className="text-left px-3 py-3 text-gray-700 hover:bg-indigo-50 hover:text-primary font-medium rounded-lg">My Children</button>
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
                    Made with ❤️ by <span className="font-semibold text-primary">VITians</span>
                </div>
            </footer>

            {/* Mandatory profile setup modal for Google OAuth users */}
            {showSetup && profile && (
                <ProfileSetupModal
                    profile={profile}
                    onComplete={() => setDismissedSetupProfileId(profile.id)}
                    refreshProfile={refreshProfile}
                />
            )}
        </div>
    );
};

export default Layout;
