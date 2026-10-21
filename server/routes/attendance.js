const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

// Meal window constants (exact times)
const MEAL_WINDOWS = {
    breakfast: { start: 7.5, end: 10 },      // 07:30–10:00
    lunch: { start: 12, end: 14.5 },         // 12:00–14:30
    snacks: { start: 16.5, end: 18 },        // 16:30–18:00
    dinner: { start: 19.5, end: 22 }         // 19:30–22:00
};

const getCurrentMealType = () => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    for (const [meal, window] of Object.entries(MEAL_WINDOWS)) {
        if (hour >= window.start && hour < window.end) return meal;
    }
    return null;
};

const isWithinMealWindow = (mealType) => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const window = MEAL_WINDOWS[mealType];
    return window && hour >= window.start && hour < window.end;
};

module.exports = (supabase) => {

    // GET: student's own attendance history
    router.get('/mine', requireAuth(supabase), async (req, res) => {
        try {
            const { days } = req.query;
            const since = new Date();
            since.setDate(since.getDate() - (Number(days) || 30));

            const { data, error } = await supabase
                .from('meal_attendance')
                .select('*')
                .eq('student_id', req.auth.profile.id)
                .gte('date', since.toISOString().split('T')[0])
                .order('date', { ascending: false })
                .order('meal_type', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST: log meal attendance (self check-in)
    router.post('/log', requireAuth(supabase), async (req, res) => {
        try {
            const { meal_type, date } = req.body;

            // Validate meal type
            if (!['breakfast', 'lunch', 'snacks', 'dinner'].includes(meal_type)) {
                return res.status(400).json({ error: 'Invalid meal_type' });
            }

            // Use provided date or today
            const checkDate = date || new Date().toISOString().split('T')[0];
            const today = new Date().toISOString().split('T')[0];

            // Don't allow future dates or past dates beyond 30 days
            if (checkDate > today || checkDate < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) {
                return res.status(400).json({ error: 'Invalid date' });
            }

            // Only allow check-in within active meal window (for today only)
            if (checkDate === today && !isWithinMealWindow(meal_type)) {
                return res.status(400).json({ error: `Not within ${meal_type} window (${MEAL_WINDOWS[meal_type].start}:00–${MEAL_WINDOWS[meal_type].end}:00)` });
            }

            const checkInTime = new Date();
            const exitOffsetMinutes = Math.floor(Math.random() * 8) + 15; // 15-22 minutes
            const expectedExitTime = new Date(checkInTime.getTime() + exitOffsetMinutes * 60 * 1000);

            const { data, error } = await supabase
                .from('meal_attendance')
                .insert({
                    student_id: req.auth.profile.id,
                    // Keep the V2 columns populated while databases migrate to V3.
                    meal_date: checkDate,//
                    date: checkDate,
                    meal_type,
                    mess_type: req.auth.profile.mess_type,
                    logged_at: checkInTime.toISOString(),
                    duration_mins: exitOffsetMinutes,
                    method: 'self_log',
                    source: 'self_check_in',
                    check_in_time: checkInTime.toISOString(),
                    expected_exit_time: expectedExitTime.toISOString()
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ error: 'Already checked in for this meal' });
                }
                throw error;
            }

            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST: biometric hardware device check-in
    router.post('/biometric', requireAuth(supabase), async (req, res) => {
        try {
            const { mess_device_id, secret_token } = req.body;

            // Validate device and secret (configured mechanism)
            const deviceSecret = process.env[`MESS_DEVICE_SECRET_${mess_device_id}`];
            if (!deviceSecret || secret_token !== deviceSecret) {
                return res.status(403).json({ error: 'Invalid device or secret token' });
            }

            const meal_type = getCurrentMealType();
            if (!meal_type) {
                return res.status(400).json({ error: 'Not within any meal window' });
            }

            const checkInTime = new Date();
            const today = checkInTime.toISOString().split('T')[0];
            const exitOffsetMinutes = Math.floor(Math.random() * 8) + 15;
            const expectedExitTime = new Date(checkInTime.getTime() + exitOffsetMinutes * 60 * 1000);

            const { data, error } = await supabase
                .from('meal_attendance')
                .insert({
                    student_id: req.auth.profile.id,
                    meal_date: today,
                    date: today,
                    meal_type,
                    mess_type: req.auth.profile.mess_type,
                    logged_at: checkInTime.toISOString(),
                    duration_mins: exitOffsetMinutes,
                    method: 'face_scan',
                    source: 'biometric_face_scan',
                    check_in_time: checkInTime.toISOString(),
                    expected_exit_time: expectedExitTime.toISOString()
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ error: 'Already checked in for this meal' });
                }
                throw error;
            }

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // DELETE: remove attendance log
    router.delete('/log', requireAuth(supabase), async (req, res) => {
        try {
            const { date, meal_type } = req.body;

            if (!date || !meal_type) {
                return res.status(400).json({ error: 'date and meal_type required' });
            }

            const { error } = await supabase
                .from('meal_attendance')
                .delete()
                .match({ student_id: req.auth.profile.id, date, meal_type });

            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET: live crowd status for current meal
    router.get('/crowd', async (req, res) => {
        try {
            const { meal_type } = req.query;

            if (!meal_type) {
                return res.status(400).json({ error: 'meal_type required' });
            }

            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();

            // Count active diners where expected_exit_time > now
            const { data, error } = await supabase
                .from('meal_attendance')
                .select('id')
                .eq('date', today)
                .eq('meal_type', meal_type)
                .lte('check_in_time', now)
                .gt('expected_exit_time', now);

            if (error) throw error;

            const count = (data || []).length;
            let status = 'green';
            let waitMinutes = 0;
            let statusLabel = 'Low Crowd';
            let waitRange = '0–3 min';

            if (count > 90) {
                status = 'red';
                waitMinutes = 20;
                statusLabel = 'Peak Rush';
                waitRange = '15–20 min';
            } else if (count >= 40) {
                status = 'yellow';
                waitMinutes = 10;
                statusLabel = 'Moderate Crowd';
                waitRange = '5–10 min';
            }

            const isPeakHour = [12, 13, 19, 20].includes(new Date().getHours());

            res.json({
                active_count: count,
                status,
                wait_minutes: waitMinutes,
                wait_range: waitRange,
                status_label: statusLabel,
                is_peak_hours: isPeakHour,
                occupancy_threshold: count < 40 ? 'low' : count < 90 ? 'moderate' : 'high'
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET: parent - child attendance (relationship-protected)
    router.get('/child/:student_id', requireAuth(supabase), requireRole('parent'), async (req, res) => {
        try {
            const { student_id } = req.params;
            const { days } = req.query;

            // Verify parent relationship
            const { data: child } = await supabase
                .from('profiles')
                .select('parent_email')
                .eq('id', student_id)
                .single();

            if (!child || child.parent_email?.toLowerCase() !== req.auth.user.email?.toLowerCase()) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const since = new Date();
            since.setDate(since.getDate() - (Number(days) || 30));

            const { data, error } = await supabase
                .from('meal_attendance')
                .select('*')
                .eq('student_id', student_id)
                .gte('date', since.toISOString().split('T')[0])
                .order('date', { ascending: false });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET: admin full attendance view
    router.get('/admin', requireAuth(supabase), requireRole('admin'), async (req, res) => {
        try {
            const { date, meal_type } = req.query;

            let query = supabase
                .from('meal_attendance')
                .select(`
                    *,
                    profile:profiles!student_id(full_name, reg_number, hostel_block, mess_type)
                `)
                .order('check_in_time', { ascending: false });

            if (date) query = query.eq('date', date);
            if (meal_type) query = query.eq('meal_type', meal_type);

            const { data, error } = await query.limit(500);
            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
