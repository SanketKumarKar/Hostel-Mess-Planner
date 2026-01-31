const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
    // Get menu items for a session
    router.get('/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { mess_type } = req.query;

            let query = supabase
                .from('menu_items')
                .select('*')
                .eq('session_id', sessionId);

            if (mess_type) {
                query = query.eq('mess_type', mess_type);
            }

            const { data, error } = await query.order('date_served', { ascending: true });

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Add menu item (Caterer)
    router.post('/', async (req, res) => {
        try {
            const { session_id, date_served, meal_type, mess_type, name, description } = req.body;
            const { data, error } = await supabase
                .from('menu_items')
                .insert({ session_id, date_served, meal_type, mess_type, name, description })
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
