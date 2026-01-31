const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
    // Get user's votes
    router.get('/user/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const { data, error } = await supabase
                .from('votes')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Cast vote
    router.post('/', async (req, res) => {
        try {
            const { user_id, menu_item_id } = req.body;
            const { data, error } = await supabase
                .from('votes')
                .insert({ user_id, menu_item_id })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Remove vote
    router.delete('/', async (req, res) => {
        try {
            const { user_id, menu_item_id } = req.body;
            const { error } = await supabase
                .from('votes')
                .delete()
                .match({ user_id, menu_item_id });

            if (error) throw error;
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get vote counts for a session
    router.get('/session/:sessionId/counts', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { data, error } = await supabase
                .rpc('get_vote_counts', { session_id_param: sessionId });

            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
