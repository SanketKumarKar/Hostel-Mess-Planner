const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
    // Get menu items for a session
    router.get('/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { mess_type, approved_only } = req.query;

            let query = supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', sessionId);

            if (mess_type) {
                query = query.eq('mess_type', mess_type);
            }
            // Students should only see approved items (approved_only=true)
            if (approved_only === 'true') {
                query = query.eq('approval_status', 'approved');
            }

            const { data, error } = await query.order('date_served', { ascending: true });

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get ALL pending items across all sessions (for admin approval panel)
    router.get('/pending', async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('menu_items')
                .select(`
                    *,
                    session:voting_sessions!session_id(title, status)
                `)
                .eq('approval_status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Add menu item (Caterer) - starts as pending
    router.post('/', async (req, res) => {
        try {
            const { session_id, date_served, meal_type, mess_type, name, description } = req.body;

            // Backend validation
            if (!session_id) {
                return res.status(400).json({ error: 'Session ID is required' });
            }
            if (!date_served || isNaN(Date.parse(date_served))) {
                return res.status(400).json({ error: 'Valid date served is required' });
            }
            const validMealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
            if (!meal_type || !validMealTypes.includes(meal_type.toLowerCase())) {
                return res.status(400).json({ error: `Invalid meal type. Must be one of: ${validMealTypes.join(', ')}` });
            }
            const validMessTypes = ['veg', 'non_veg', 'special', 'food_park'];
            if (!mess_type || !validMessTypes.includes(mess_type.toLowerCase())) {
                return res.status(400).json({ error: `Invalid mess type. Must be one of: ${validMessTypes.join(', ')}` });
            }
            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'Dish name is required and must be a string' });
            }
            if (name.trim().length < 3 || name.trim().length > 100) {
                return res.status(400).json({ error: 'Dish name must be between 3 and 100 characters long' });
            }
            if (description && description.length > 200) {
                return res.status(400).json({ error: 'Description must be under 200 characters long' });
            }

            const { data, error } = await supabase
                .from('menu_items')
                .insert({
                    session_id, 
                    date_served, 
                    meal_type: meal_type.toLowerCase(), 
                    mess_type: mess_type.toLowerCase(), 
                    name: name.trim(), 
                    description: description ? description.trim() : null,
                    approval_status: 'pending'  // Always starts as pending
                })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Approve a menu item (Admin)
    router.patch('/:id/approve', async (req, res) => {
        try {
            const { id } = req.params;
            const { data, error } = await supabase
                .from('menu_items')
                .update({ approval_status: 'approved' })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Reject a menu item (Admin)
    router.patch('/:id/reject', async (req, res) => {
        try {
            const { id } = req.params;
            const { data, error } = await supabase
                .from('menu_items')
                .update({ approval_status: 'rejected' })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete menu item
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('menu_items')
                .delete()
                .eq('id', id);

            if (error) throw error;
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
