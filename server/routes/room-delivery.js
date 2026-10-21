const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

// Valid status flow
const STATUS_FLOW = {
    pending: ['approved', 'rejected'],
    approved: ['packed'],
    packed: ['out_for_delivery'],
    out_for_delivery: ['delivered'],
    rejected: [], // terminal
    delivered: [] // terminal
};

const isValidTransition = (from, to) => STATUS_FLOW[from]?.includes(to) || false;

module.exports = (supabase) => {

    // GET: Student's own room delivery requests
    router.get('/mine', requireAuth(supabase), async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('room_delivery_requests')
                .select('*')
                .eq('student_id', req.auth.profile.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST: Create new room delivery request (student)
    router.post('/', requireAuth(supabase), requireRole('student'), async (req, res) => {
        try {
            const { date, meal_type, reason, proof_image_url } = req.body;

            // Validation
            if (!date || !meal_type || !reason) {
                return res.status(400).json({
                    error: 'date, meal_type, and reason are required'
                });
            }

            const validMealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
            if (!validMealTypes.includes(meal_type)) {
                return res.status(400).json({ error: 'Invalid meal_type' });
            }

            // Check for duplicate request
            const { data: existing } = await supabase
                .from('room_delivery_requests')
                .select('id')
                .eq('student_id', req.auth.profile.id)
                .eq('date', date)
                .eq('meal_type', meal_type)
                .single();

            if (existing) {
                return res.status(409).json({ error: 'You already have a request for this meal.' });
            }

            // Insert new request using student's profile details
            const { data, error } = await supabase
                .from('room_delivery_requests')
                .insert({
                    student_id: req.auth.profile.id,
                    date,
                    meal_type,
                    reason: reason.trim(),
                    proof_image_url: proof_image_url || null,
                    hostel_block: req.auth.profile.hostel_block || 'A',
                    room_number: req.auth.profile.room_number || '',
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET: All room delivery requests (admin)
    router.get('/admin', requireAuth(supabase), requireRole('admin'), async (req, res) => {
        try {
            const { status, date, hostel_block } = req.query;

            let query = supabase
                .from('room_delivery_requests')
                .select(`
                    *,
                    student:profiles!student_id(full_name, reg_number, mess_type, assigned_caterer_id)
                `)
                .order('created_at', { ascending: false });

            if (status) query = query.eq('status', status);
            if (date) query = query.eq('date', date);
            if (hostel_block) query = query.eq('hostel_block', hostel_block.toUpperCase());

            const { data, error } = await query.limit(500);
            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PATCH: Update room delivery request status (admin/caterer)
    router.patch('/:id', requireAuth(supabase), async (req, res) => {
        try {
            const { id } = req.params;
            const { status, admin_notes } = req.body;
            const { role, id: userId } = req.auth.profile;

            if (!status) {
                return res.status(400).json({ error: 'status is required' });
            }

            // Validate status
            const validStatuses = ['pending', 'approved', 'rejected', 'packed', 'out_for_delivery', 'delivered'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            // Get current request
            const { data: request, error: fetchError } = await supabase
                .from('room_delivery_requests')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;
            if (!request) return res.status(404).json({ error: 'Request not found' });

            // Authorization checks
            const isAdmin = role === 'admin';
            const isCaterer = role === 'caterer';
            const isStudent = role === 'student' && request.student_id === userId;

            // Determine allowed actions
            let canUpdate = false;

            if (isAdmin) {
                // Admins can change any status except packing/delivery actions
                canUpdate = true;
            } else if (isCaterer) {
                // Caterers can only update requests for their assigned students
                const { data: student } = await supabase
                    .from('profiles')
                    .select('assigned_caterer_id')
                    .eq('id', request.student_id)
                    .single();

                canUpdate = student?.assigned_caterer_id === userId;
                // Caterers can only perform packing/delivery transitions
                canUpdate = canUpdate && ['packed', 'out_for_delivery', 'delivered'].includes(status);
            } else if (isStudent) {
                // Students can only cancel pending requests
                canUpdate = status === 'rejected' && request.status === 'pending';
            }

            if (!canUpdate) {
                return res.status(403).json({ error: 'Insufficient permissions for this action' });
            }

            // Validate status transition
            if (!isValidTransition(request.status, status)) {
                return res.status(400).json({
                    error: `Invalid status transition: ${request.status} → ${status}`
                });
            }

            // Prepare update data
            const updateData = { status };
            if (admin_notes !== undefined && (isAdmin || isCaterer)) {
                updateData.admin_notes = admin_notes;
            }

            // Perform update
            const { data, error } = await supabase
                .from('room_delivery_requests')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // DELETE: Cancel own room delivery request (student)
    router.delete('/:id', requireAuth(supabase), async (req, res) => {
        try {
            const { id } = req.params;

            // Get request to verify ownership and status
            const { data: request, error: fetchError } = await supabase
                .from('room_delivery_requests')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;
            if (!request) return res.status(404).json({ error: 'Request not found' });

            // Students can only delete their own pending requests
            if (request.student_id !== req.auth.profile.id) {
                return res.status(403).json({ error: 'Cannot delete another student\'s request' });
            }

            if (request.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending requests can be deleted' });
            }

            const { error } = await supabase
                .from('room_delivery_requests')
                .delete()
                .eq('id', id);

            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET: Caterer view (approved/packed requests for their mess type)
    router.get('/caterer', requireAuth(supabase), requireRole('caterer'), async (req, res) => {
        try {
            const { status } = req.query;

            // Get caterer's served mess types
            const { data: caterer } = await supabase
                .from('profiles')
                .select('served_mess_types')
                .eq('id', req.auth.profile.id)
                .single();

            if (!caterer || !caterer.served_mess_types) {
                return res.json([]);
            }

            // Get requests for students assigned to this caterer
            let query = supabase
                .from('room_delivery_requests')
                .select(`
                    *,
                    student:profiles!student_id(full_name, reg_number, mess_type, assigned_caterer_id)
                `)
                .in('status', status ? [status] : ['approved', 'packed', 'out_for_delivery'])
                .order('date', { ascending: true })
                .order('meal_type', { ascending: true });

            // Filter by assigned caterer directly in query
            query = query.eq('student.assigned_caterer_id', req.auth.profile.id);

            const { data, error } = await query;
            if (error) throw error;

            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
