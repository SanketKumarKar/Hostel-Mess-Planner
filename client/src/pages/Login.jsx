import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CustomSelect from '../components/CustomSelect';
import { X, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const navigate = useNavigate();

    // Registration-only fields
    const [fullName, setFullName] = useState('');
    const [regNumber, setRegNumber] = useState('');
    const [messType, setMessType] = useState('Veg');
    const [role, setRole] = useState('student');
    const [settings, setSettings] = useState({ caterer: true, admin: true });

    // New Fields
    const [servedMessTypes, setServedMessTypes] = useState([]);
    const [availableCaterers, setAvailableCaterers] = useState([]);
    const [assignedCatererId, setAssignedCatererId] = useState('');
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    // Validation States
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [showPassword, setShowPassword] = useState(false);

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
            setErrors(prev => ({ ...prev, assignedCatererId: '' }));
        };

        fetchCaterers();
    }, [messType, role, isRegister]);

    const handleServedTypeChange = (type) => {
        const nextTypes = servedMessTypes.includes(type)
            ? servedMessTypes.filter(t => t !== type)
            : [...servedMessTypes, type];
        setServedMessTypes(nextTypes);
        if (touched.servedMessTypes) {
            validateField('servedMessTypes', nextTypes);
        }
    };
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Reset validations on mode/role change
    useEffect(() => {
        setErrors({});
        setTouched({});
    }, [isRegister, role]);

    const getPasswordStrength = (pass) => {
        if (!pass) return { score: 0, label: '', color: 'bg-gray-200', textClass: 'text-gray-400' };
        if (pass.length < 6) return { score: 1, label: 'Too Short', color: 'bg-red-500 w-1/4', textClass: 'text-red-500 font-medium' };

        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 1) return { score: 2, label: 'Weak', color: 'bg-orange-500 w-2/4', textClass: 'text-orange-500 font-medium' };
        if (score === 2 || score === 3) return { score: 3, label: 'Medium', color: 'bg-yellow-500 w-3/4', textClass: 'text-yellow-600 font-medium' };
        return { score: 4, label: 'Strong', color: 'bg-green-500 w-full', textClass: 'text-green-600 font-bold' };
    };

    const validateField = (name, value, currentRole = role) => {
        let errorMsg = '';
        if (isRegister) {
            if (name === 'fullName') {
                if (!value.trim()) {
                    errorMsg = 'Please enter your full name';
                } else if (value.trim().length < 3) {
                    errorMsg = 'Full name must be at least 3 characters';
                } else if (!/^[A-Za-z\s]+$/.test(value)) {
                    errorMsg = 'Name can only contain letters and spaces';
                } else if (currentRole === 'student' && value.trim().split(/\s+/).length < 2) {
                    errorMsg = 'Please enter both first and last name';
                }
            } else if (name === 'regNumber' && currentRole === 'student') {
                if (!value.trim()) {
                    errorMsg = 'Please enter your registration number';
                } else if (!/^\d{2}[A-Za-z]{3}\d{4}$/.test(value.trim().toUpperCase())) {
                    errorMsg = 'Must be a valid VIT registration number (e.g., 20BCE0123)';
                }
            } else if (name === 'assignedCatererId' && currentRole === 'student') {
                if (!value) {
                    errorMsg = 'Please select a caterer';
                }
            } else if (name === 'servedMessTypes' && currentRole === 'caterer') {
                if (!value || value.length === 0) {
                    errorMsg = 'Please select at least one served mess type';
                }
            }
        }

        if (name === 'email') {
            if (!value) {
                errorMsg = 'Please enter your email';
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errorMsg = 'Please enter a valid email address';
                } else if (isRegister && currentRole === 'student') {
                    const domain = value.split('@')[1];
                    if (domain !== 'vitstudent.ac.in' && domain !== 'vit.ac.in') {
                        errorMsg = 'Students must register with a valid VIT email address (@vitstudent.ac.in or @vit.ac.in).';
                    }
                }
            }
        }

        if (name === 'password') {
            if (!value) {
                errorMsg = 'Please enter your password';
            } else if (value.length < 6) {
                errorMsg = 'Password must be at least 6 characters';
            }
        }

        setErrors(prev => ({ ...prev, [name]: errorMsg }));
        return errorMsg;
    };

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        let val = '';
        if (field === 'fullName') val = fullName;
        else if (field === 'regNumber') val = regNumber;
        else if (field === 'email') val = email;
        else if (field === 'password') val = password;
        else if (field === 'assignedCatererId') val = assignedCatererId;
        else if (field === 'servedMessTypes') val = servedMessTypes;
        validateField(field, val);
    };

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

        // Validate all relevant fields
        const fieldsToValidate = ['email', 'password'];
        if (isRegister) {
            fieldsToValidate.push('fullName');
            if (role === 'student') {
                fieldsToValidate.push('regNumber');
                fieldsToValidate.push('assignedCatererId');
            }
            if (role === 'caterer') {
                fieldsToValidate.push('servedMessTypes');
            }
        }

        const newTouched = {};
        const newErrors = {};
        let hasErrors = false;

        fieldsToValidate.forEach(field => {
            newTouched[field] = true;
            let val = '';
            if (field === 'fullName') val = fullName;
            else if (field === 'regNumber') val = regNumber;
            else if (field === 'email') val = email;
            else if (field === 'password') val = password;
            else if (field === 'assignedCatererId') val = assignedCatererId;
            else if (field === 'servedMessTypes') val = servedMessTypes;

            const err = validateField(field, val, role);
            if (err) {
                newErrors[field] = err;
                hasErrors = true;
            }
        });

        setTouched(newTouched);
        if (hasErrors) {
            toast.error('Please correct the errors in the form');
            return;
        }

        setLoading(true);
        try {
            if (isRegister) {
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
                            reg_number: role === 'student' ? regNumber.toUpperCase() : null,
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 animate-fade-in">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                <div className="flex justify-center mb-6">
                    <img src="/FeastFull_LOGO.png" alt="FeastFull Logo" className="h-24 w-auto object-contain" />
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
                            We&apos;ve sent a confirmation link to:
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
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                placeholder="Enter your full name"
                                                className={`mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all ${
                                                    touched.fullName && errors.fullName
                                                        ? 'border-red-500 focus:ring-red-200'
                                                        : touched.fullName && !errors.fullName
                                                        ? 'border-green-500 focus:ring-green-200'
                                                        : 'border-gray-300 focus:ring-primary'
                                                }`}
                                                value={fullName}
                                                onChange={(e) => {
                                                    setFullName(e.target.value);
                                                    validateField('fullName', e.target.value);
                                                }}
                                                onBlur={() => handleBlur('fullName')}
                                            />
                                            {touched.fullName && (
                                                <div className="absolute right-3 top-[14px] flex items-center">
                                                    {errors.fullName ? (
                                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                                    ) : fullName && (
                                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {touched.fullName && errors.fullName && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1 animate-slide-down">
                                                {errors.fullName}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Role *</label>
                                        <CustomSelect
                                            value={role}
                                            onChange={(val) => setRole(val)}
                                            options={[
                                                { value: 'student', label: 'Student' },
                                                ...(settings.caterer ? [{ value: 'caterer', label: 'Caterer' }] : []),
                                                ...(settings.admin ? [{ value: 'admin', label: 'Admin' }] : [])
                                            ]}
                                        />
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
                                                            onBlur={() => handleBlur('servedMessTypes')}
                                                        />
                                                        <span className="capitalize">{type.replace('_', ' ')}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Select all the mess types you serve.</p>
                                            {touched.servedMessTypes && errors.servedMessTypes && (
                                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                    {errors.servedMessTypes}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {role === 'student' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Registration Number *</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="e.g., 20BCE0123"
                                                        className={`mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${
                                                            touched.regNumber && errors.regNumber
                                                                ? 'border-red-500 focus:ring-red-200'
                                                                : touched.regNumber && !errors.regNumber
                                                                ? 'border-green-500 focus:ring-green-200'
                                                                : 'border-gray-300 focus:ring-primary'
                                                        }`}
                                                        value={regNumber}
                                                        onChange={(e) => {
                                                            setRegNumber(e.target.value);
                                                            validateField('regNumber', e.target.value);
                                                        }}
                                                        onBlur={() => handleBlur('regNumber')}
                                                    />
                                                    {touched.regNumber && (
                                                        <div className="absolute right-3 top-[14px] flex items-center">
                                                            {errors.regNumber ? (
                                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                                            ) : regNumber && (
                                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {touched.regNumber && errors.regNumber && (
                                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        {errors.regNumber}
                                                    </p>
                                                )}
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
                                                <CustomSelect
                                                    value={assignedCatererId}
                                                    onChange={(val) => {
                                                        setAssignedCatererId(val);
                                                        validateField('assignedCatererId', val);
                                                    }}
                                                    options={availableCaterers.map((c) => ({ value: c.id, label: c.full_name }))}
                                                    placeholder="-- Choose a Caterer --"
                                                    disabled={availableCaterers.length === 0}
                                                />
                                                {touched.assignedCatererId && errors.assignedCatererId && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        {errors.assignedCatererId}
                                                    </p>
                                                )}
                                                {availableCaterers.length === 0 && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        Please select another mess type.
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email *</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        required
                                        className={`mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${
                                            touched.email && errors.email
                                                ? 'border-red-500 focus:ring-red-200'
                                                : touched.email && !errors.email
                                                ? 'border-green-500 focus:ring-green-200'
                                                : 'border-gray-300 focus:ring-primary'
                                        }`}
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            validateField('email', e.target.value);
                                        }}
                                        onBlur={() => handleBlur('email')}
                                    />
                                    {touched.email && (
                                         <div className="absolute right-3 top-[14px] flex items-center">
                                             {errors.email ? (
                                                 <AlertCircle className="w-5 h-5 text-red-500" />
                                             ) : email && (
                                                 <CheckCircle2 className="w-5 h-5 text-green-500" />
                                             )}
                                         </div>
                                    )}
                                </div>
                                {touched.email && errors.email && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        {errors.email}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password *</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className={`mt-1 w-full pl-4 pr-16 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${
                                            touched.password && errors.password
                                                ? 'border-red-500 focus:ring-red-200'
                                                : touched.password && !errors.password
                                                ? 'border-green-500 focus:ring-green-200'
                                                : 'border-gray-300 focus:ring-primary'
                                        }`}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            validateField('password', e.target.value);
                                        }}
                                        onBlur={() => handleBlur('password')}
                                    />
                                    <div className="absolute right-3 top-[14px] flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-gray-400 hover:text-gray-600 focus:outline-none flex items-center"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                        {touched.password && (
                                            <div className="flex items-center shrink-0">
                                                {errors.password ? (
                                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                                ) : password && (
                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {touched.password && errors.password && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        {errors.password}
                                    </p>
                                )}
                                
                                {/* Password Strength Meter */}
                                {isRegister && password && (
                                    <div className="mt-2 space-y-1 animate-slide-down">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500">Password Strength:</span>
                                            <span className={getPasswordStrength(password).textClass}>
                                                {getPasswordStrength(password).label}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(password).color}`}
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400">
                                            Use 8+ characters with mixed case, numbers, and symbols for a strong password.
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            {isRegister && (
                                <div className="flex items-start gap-2 mt-2">
                                    <input 
                                        type="checkbox" 
                                        id="privacy" 
                                        checked={agreePrivacy}
                                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                                        className="custom-checkbox mt-[5px] w-3.5 h-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
                                    />
                                    <label htmlFor="privacy" className="text-sm text-gray-600">
                                        I agree to the <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-primary hover:underline font-medium">Privacy Policy</button>
                                    </label>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || (isRegister && !agreePrivacy)}
                                className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-2"
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

            {/* Privacy Policy Modal */}
            {showPrivacyModal && (
                <div className="fixed inset-0 bg-transparent backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPrivacyModal(false)}>
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
                            <p>We collect personal information that you voluntarily provide to us when you register on the App, including your name, email address, roll number, and dietary preferences (such as mess type). We also collect data regarding your voting activity, feedback, and app usage.</p>
                            
                            <h3 className="font-bold text-gray-800 text-base mt-4">2. How We Use Your Information</h3>
                            <p>We use personal information collected via our App for a variety of business purposes, including:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>To facilitate account creation and login process.</li>
                                <li>To manage your orders, voting, and meal preferences.</li>
                                <li>To improve our services and platform analytics.</li>
                                <li>To send administrative information to you.</li>
                            </ul>

                            <h3 className="font-bold text-gray-800 text-base mt-4">3. Will Your Information Be Shared?</h3>
                            <p>We only share and disclose your information in the following situations:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Caterers:</strong> Your assigned caterer may see your feedback and meal preferences to improve food quality.</li>
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

export default Login;
