import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';

const Layout = () => {
    const { signOut, profile } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <h1 className="text-xl font-bold text-primary cursor-pointer" onClick={() => navigate('/')}>Hostel Menu</h1>
                        <nav className="hidden md:flex gap-4">
                            <button onClick={() => navigate('/')} className="text-gray-600 hover:text-primary font-medium">Dashboard</button>
                            <button onClick={() => navigate('/events')} className="text-gray-600 hover:text-primary font-medium">Events</button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        {profile && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User size={16} />
                                <span className="hidden sm:inline">{profile.full_name || 'User'}</span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium uppercase">{profile.role}</span>
                            </div>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                            title="Sign Out"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
