import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const navigate = useNavigate();

    // Registration-only fields
    const [fullName, setFullName] = useState('');
    const [regNumber, setRegNumber] = useState('');
    const [messType, setMessType] = useState('veg');
    const [role, setRole] = useState('student');
    const [settings, setSettings] = useState({ caterer: true, admin: true });

    // New Fields
    const [servedMessTypes, setServedMessTypes] = useState([]);
    const [availableCaterers, setAvailableCaterers] = useState([]);
    const [assignedCatererId, setAssignedCatererId] = useState('');

    useEffect(() => {
        const checkSettings = async () => {
            const { data } = await supabase.from('system_settings').select('*');
            if (data) {
                const caterer = data.find(s => s.setting_key === 'caterer_registration')?.setting_value === 'true';
                const admin = data.find(s => s.setting_key === 'admin_registration')?.setting_value === 'true';
                setSettings({ caterer: !!caterer, admin: !!admin });
            }
        };
        checkSettings();
    }, []);

    // Fetch Caterers when Mess Type changes (for Students)
    useEffect(() => {
        const fetchCaterers = async () => {
            if (role !== 'student' || !isRegister) return;

            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, served_mess_types')
                .eq('role', 'caterer')
                .contains('served_mess_types', [messType]);

            setAvailableCaterers(data || []);
            setAssignedCatererId(''); // Reset selection
        };

        fetchCaterers();
    }, [messType, role, isRegister]);

    const handleServedTypeChange = (type) => {
        setServedMessTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const redirectTo = window.location.hostname === 'localhost'
                ? `${window.location.origin}/`
                : 'https://hostel-mess-planner.vercel.app/';

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });
            if (error) throw error;
        } catch (error) {
            toast.error(error.message || 'Google sign in failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegister) {
                // Validation
                if (!fullName.trim()) throw new Error('Please enter your full name');

                if (role === 'student') {
                    if (!regNumber.trim()) throw new Error('Please enter your registration number');
                    if (!assignedCatererId) throw new Error('Please select a caterer');
                }

                if (role === 'caterer') {
                    if (servedMessTypes.length === 0) throw new Error('Please select at least one served mess type');
                }

                if (role === 'student') {
                    const emailDomain = email.split('@')[1];
                    if (emailDomain !== 'vitstudent.ac.in' && emailDomain !== 'vit.ac.in') {
                        throw new Error('Students must register with a valid VIT email address (@vitstudent.ac.in or @vit.ac.in).');
                    }
                }

                const emailRedirectTo = window.location.hostname === 'localhost'
                    ? `${window.location.origin}/login`
                    : 'https://hostel-mess-planner.vercel.app/login';

                // Step 1: Create auth account (email confirmation required)
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo,
                        data: {
                            full_name: fullName,
                            role: role,
                        }
                    }
                });

                if (error) throw error;

                // Check if already registered
                if (data?.user?.identities?.length === 0) {
                    toast.error('This email is already registered. Please sign in instead.');
                    setLoading(false);
                    return;
                }

                // Step 2: Create profile with the new user's ID
                if (data?.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: data.user.id,
                            full_name: fullName,
                            role: role,
                            mess_type: role === 'student' ? messType : null,
                            reg_number: role === 'student' ? regNumber : null,
                            served_mess_types: role === 'caterer' ? servedMessTypes : null,
                            assigned_caterer_id: role === 'student' ? assignedCatererId : null
                        });

                    if (profileError) {
                        console.error('Profile error:', profileError);
                    }
                }

                // Step 3: Show confirmation screen instead of auto-signing in
                setShowConfirmation(true);

            } else {
                // Sign in
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) {
                    if (error.message?.includes('Email not confirmed')) {
                        throw new Error('Please confirm your email before signing in. Check your inbox for the confirmation link.');
                    }
                    throw error;
                }
                navigate('/');
            }
        } catch (error) {
            console.error('Auth error:', error);
            const errorMessage = error.message || 'An error occurred. Please try again.';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Hostel Mess Logo" className="h-24 w-auto object-contain" />
                </div>

                {showConfirmation ? (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">Check Your Email</h2>
                        <p className="text-gray-600 mb-2">
                            We've sent a confirmation link to:
                        </p>
                        <p className="font-semibold text-primary mb-4">{email}</p>
                        <p className="text-sm text-gray-500 mb-6">
                            Click the link in the email to verify your account, then come back and sign in.
                        </p>
                        <button
                            onClick={() => { setShowConfirmation(false); setIsRegister(false); }}
                            className="w-full py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Back to Sign In
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
                            {isRegister ? 'Create Account' : 'Welcome Back'}
                        </h2>
                        <form onSubmit={handleAuth} className="space-y-6">
                            {isRegister && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Enter your full name"
                                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Role *</label>
                                        <select
                                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                        >
                                            <option value="student">Student</option>
                                            {settings.caterer && <option value="caterer">Caterer</option>}
                                            {settings.admin && <option value="admin">Admin</option>}
                                        </select>
                                    </div>

                                    {!settings.caterer && !settings.admin && role === 'student' && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            * Registration for Caterers and Admins is currently closed.
                                        </p>
                                    )}

                                    {role === 'caterer' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Serving Mess Types *</label>
                                            <div className="space-y-2">
                                                {['veg', 'non_veg', 'special', 'food_park'].map((type) => (
                                                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={servedMessTypes.includes(type)}
                                                            onChange={() => handleServedTypeChange(type)}
                                                            className="w-4 h-4 text-primary rounded focus:ring-primary"
                                                        />
                                                        <span className="capitalize">{type.replace('_', ' ')}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Select all the mess types you serve.</p>
                                        </div>
                                    )}

                                    {role === 'student' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Registration Number *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g., 2024001"
                                                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                                    value={regNumber}
                                                    onChange={(e) => setRegNumber(e.target.value)}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Mess Type *</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {['veg', 'non_veg', 'special', 'food_park'].map((type) => (
                                                        <label key={type} className={`
                                                    flex items-center justify-center p-2 rounded-lg border cursor-pointer hover:bg-gray-50 transition-all
                                                    ${messType === type ? 'border-primary bg-indigo-50 text-indigo-700 ring-1 ring-primary' : 'border-gray-200'}
                                                `}>
                                                            <input
                                                                type="radio"
                                                                name="messType"
                                                                value={type}
                                                                checked={messType === type}
                                                                onChange={(e) => setMessType(e.target.value)}
                                                                className="sr-only"
                                                            />
                                                            <span className="capitalize text-sm font-medium">{type.replace('_', ' ')}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Caterer *</label>
                                                <select
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                                    value={assignedCatererId}
                                                    onChange={(e) => setAssignedCatererId(e.target.value)}
                                                    required
                                                    disabled={availableCaterers.length === 0}
                                                >
                                                    <option value="">-- Choose a Caterer --</option>
                                                    {availableCaterers.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.full_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {availableCaterers.length === 0 && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        No caterers found serving {messType.replace('_', ' ')}. Please ask an admin to register caterers.
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Sign In')}
                            </button>
                        </form>

                        {/* Divider */}
                        {!isRegister && (
                            <>
                                <div className="my-5 flex items-center gap-3">
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                    <span className="text-xs text-gray-400 font-medium uppercase">or</span>
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                </div>

                                {/* Google Sign-In Button */}
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium text-gray-700"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Sign in with Google
                                </button>
                            </>
                        )}

                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setIsRegister(!isRegister)}
                                className="text-sm text-primary hover:underline"
                            >
                                {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Login;
