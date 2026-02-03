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
    const [messType, setMessType] = useState<'veg' | 'non_veg' | 'special' | 'food_park'>('veg');
    const [role, setRole] = useState<'student' | 'caterer' | 'admin'>('student');
    const [settings, setSettings] = useState<{ caterer: boolean, admin: boolean }>({ caterer: true, admin: true });

    // New Fields
    const [servedMessTypes, setServedMessTypes] = useState<string[]>([]);
    const [availableCaterers, setAvailableCaterers] = useState<any[]>([]);
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

            // Logic: Find caterers who have 'messType' in their served_mess_types array
            // PostgreSQL operator for array contains is @> but Supabase uses .cs (contains)
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

    const handleServedTypeChange = (type: string) => {
        setServedMessTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleAuth = async (e: React.FormEvent) => {
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

                // Step 1: Create auth account
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });

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

                // Step 3: Create or Update profile
                if (signInData?.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: signInData.user.id,
                            full_name: fullName,
                            role: role,
                            mess_type: role === 'student' ? messType : null,
                            reg_number: role === 'student' ? regNumber : null,
                            served_mess_types: role === 'caterer' ? servedMessTypes : null,
                            assigned_caterer_id: role === 'student' ? assignedCatererId : null
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
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/');
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            const errorMessage = error.message || 'An error occurred. Please try again.';
            alert(errorMessage);
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
                                                        onChange={(e) => setMessType(e.target.value as any)}
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
