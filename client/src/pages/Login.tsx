import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const navigate = useNavigate();

    // Registration-only fields
    const [fullName, setFullName] = useState('');
    const [regNumber, setRegNumber] = useState('');
    const [messType, setMessType] = useState<'veg' | 'non_veg' | 'special'>('veg');
    const [role, setRole] = useState<'student' | 'caterer' | 'admin'>('student');
    const [settings, setSettings] = useState<{ caterer: boolean, admin: boolean }>({ caterer: true, admin: true });

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

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegister) {
                // Validation
                if (!fullName.trim()) {
                    alert('Please enter your full name');
                    setLoading(false);
                    return;
                }
                if (role === 'student' && !regNumber.trim()) {
                    alert('Please enter your registration number');
                    setLoading(false);
                    return;
                }

                // Step 1: Create auth account
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });

                console.log('Signup response:', { data, error });

                if (error) throw error;

                // Check if already registered
                if (data?.user?.identities?.length === 0) {
                    alert('This email is already registered. Please sign in instead.');
                    setLoading(false);
                    return;
                }

                // Step 2: Auto sign-in to authenticate
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (signInError) {
                    alert('Account created! Please sign in manually.');
                    setIsRegister(false);
                    setLoading(false);
                    return;
                }

                // Step 3: Create or Update profile (handles case if trigger already created it)
                if (signInData?.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: signInData.user.id,
                            full_name: fullName,
                            role: role,
                            mess_type: messType,
                            reg_number: role === 'student' ? regNumber : null
                        });

                    if (profileError) {
                        console.error('Profile error:', profileError);
                        await supabase.auth.signOut();
                        alert('Setup failed: ' + profileError.message);
                        setLoading(false);
                        return;
                    }

                    alert('Welcome! Account ready.');
                    navigate('/');
                }
            } else {
                // Sign in
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                console.log('Sign in response:', { data, error });
                if (error) throw error;
                navigate('/');
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            const errorMessage = error.message || 'An error occurred. Please try again.';

            // Provide more helpful error messages
            if (errorMessage.includes('Invalid login credentials')) {
                alert('Invalid email or password. Please try again.');
            } else if (errorMessage.includes('Email not confirmed')) {
                alert('Please confirm your email address before signing in.');
            } else if (errorMessage.includes('fetch')) {
                alert('Network error. Please check your internet connection and try again.');
            } else {
                alert(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Hostel Mess Logo" className="h-24 w-auto object-contain" />
                </div>
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
                                    onChange={(e) => setRole(e.target.value as 'student' | 'caterer' | 'admin')}
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
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="messType"
                                                    value="veg"
                                                    checked={messType === 'veg'}
                                                    onChange={(e) => setMessType(e.target.value as 'veg')}
                                                    className="text-primary focus:ring-primary"
                                                />
                                                <span>Veg</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="messType"
                                                    value="non_veg"
                                                    checked={messType === 'non_veg'}
                                                    onChange={(e) => setMessType(e.target.value as 'non_veg')}
                                                    className="text-primary focus:ring-primary"
                                                />
                                                <span>Non-Veg</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="messType"
                                                    value="special"
                                                    checked={messType === 'special'}
                                                    onChange={(e) => setMessType(e.target.value as 'special')}
                                                    className="text-primary focus:ring-primary"
                                                />
                                                <span>Special</span>
                                            </label>
                                        </div>
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
                <div className="mt-4 text-center">
                    <button
                        onClick={() => setIsRegister(!isRegister)}
                        className="text-sm text-primary hover:underline"
                    >
                        {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
