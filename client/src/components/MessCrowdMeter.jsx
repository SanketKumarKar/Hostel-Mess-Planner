import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, TrendingUp, Clock } from 'lucide-react';

const MessCrowdMeter = ({ messType }) => {
    const [crowdData, setCrowdData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCrowdStatus();
        const interval = setInterval(fetchCrowdStatus, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messType]);

    const fetchCrowdStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('meal_attendance')
                .select('id, check_in_time, expected_exit_time')
                .eq('date', new Date().toISOString().split('T')[0])
                .gt('expected_exit_time', new Date().toISOString());

            if (error) throw error;

            const activeDiners = data?.length || 0;
            setCrowdData({
                count: activeDiners,
                status: getStatus(activeDiners),
                color: getColor(activeDiners),
                waitTime: getWaitTime(activeDiners),
                percentage: Math.min((activeDiners / 120) * 100, 100)
            });
        } catch (err) {
            console.error('Error fetching crowd status:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatus = (count) => {
        if (count < 40) return 'Low';
        if (count <= 90) return 'Moderate';
        return 'High';
    };

    const getColor = (count) => {
        if (count < 40) return 'green';
        if (count <= 90) return 'yellow';
        return 'red';
    };

    const getWaitTime = (count) => {
        if (count < 40) return '0-3 min';
        if (count <= 90) return '5-10 min';
        return '15-20 min';
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!crowdData) return null;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Users size={18} /> Mess Crowd Status
                </h3>
                <button
                    onClick={fetchCrowdStatus}
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-all"
                    title="Refresh"
                >
                    <Clock size={16} />
                </button>
            </div>

            <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            crowdData.color === 'green' ? 'bg-green-100' :
                            crowdData.color === 'yellow' ? 'bg-yellow-100' :
                            'bg-red-100'
                        }`}>
                            <Users size={20} className={
                                crowdData.color === 'green' ? 'text-green-600' :
                                crowdData.color === 'yellow' ? 'text-yellow-600' :
                                'text-red-600'
                            } />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-lg">{crowdData.count} Active Diners</p>
                            <p className={`text-sm font-medium ${
                                crowdData.color === 'green' ? 'text-green-600' :
                                crowdData.color === 'yellow' ? 'text-yellow-600' :
                                'text-red-600'
                            }`}>
                                {crowdData.status} Crowd
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Expected Wait</p>
                        <p className="font-bold text-gray-700">{crowdData.waitTime}</p>
                    </div>
                </div>

                {/* Occupancy Bar */}
                <div className="relative">
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                crowdData.color === 'green' ? 'bg-green-500' :
                                crowdData.color === 'yellow' ? 'bg-yellow-500' :
                                'bg-red-500'
                            }`}
                            style={{ width: `${crowdData.percentage}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1.5">
                        <span>0</span>
                        <span className="text-gray-400">40</span>
                        <span className="text-gray-400">90</span>
                        <span>120+</span>
                    </div>
                </div>

                {/* Peak Hours Hint */}
                {crowdData.status === 'High' && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                        <TrendingUp size={16} className="mt-0.5 flex-shrink-0" />
                        <p>Peak hours! Consider visiting during off-peak times for a better experience.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessCrowdMeter;
