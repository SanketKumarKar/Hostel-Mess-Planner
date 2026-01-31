const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
    // Get all sessions
    router.get('/', async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('voting_sessions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Create session (Admin only)
    router.post('/', async (req, res) => {
        try {
            const { title, start_date, end_date } = req.body;
            const { data, error } = await supabase
                .from('voting_sessions')
                .insert({ title, start_date, end_date, status: 'draft' })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Update session status
    router.patch('/:id/status', async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const { data, error } = await supabase
                .from('voting_sessions')
                .update({ status })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete session
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('voting_sessions')
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
