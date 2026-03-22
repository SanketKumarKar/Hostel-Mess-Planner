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

            // 1. Get the date of the item being voted on
            const { data: itemData, error: itemError } = await supabase
                .from('menu_items')
                .select('date_served')
                .eq('id', menu_item_id)
                .single();

            if (itemError) throw itemError;
            
            // 2. Count existing votes for this user on this same date
            const { count, error: countError } = await supabase
                .from('votes')
                .select('id, menu_items!inner(date_served)', { count: 'exact', head: true })
                .eq('user_id', user_id)
                .eq('menu_items.date_served', itemData.date_served);

            if (countError) throw countError;

            if (count >= 8) {
                return res.status(400).json({ error: 'You can only vote for up to 8 items per day.' });
            }

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
