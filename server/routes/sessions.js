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
            const { title, start_date, end_date, session_weeks, breakfast_limit, lunch_limit, snacks_limit, dinner_limit } = req.body;

            // Backend validation
            if (!title || typeof title !== 'string' || !title.trim()) {
                return res.status(400).json({ error: 'Title is required and must be a string' });
            }
            if (title.trim().length < 3) {
                return res.status(400).json({ error: 'Title must be at least 3 characters long' });
            }
            if (!start_date || isNaN(Date.parse(start_date))) {
                return res.status(400).json({ error: 'Valid start date is required' });
            }
            if (!end_date || isNaN(Date.parse(end_date))) {
                return res.status(400).json({ error: 'Valid end date is required' });
            }
            if (new Date(end_date) <= new Date(start_date)) {
                return res.status(400).json({ error: 'End date must be strictly after start date' });
            }
            if (session_weeks && ![1, 2].includes(Number(session_weeks))) {
                return res.status(400).json({ error: 'Session weeks must be either 1 or 2' });
            }

            const normalizedWeeks = Number(session_weeks) === 1 ? 1 : 2;
            const bLimit = Number(breakfast_limit) > 0 ? Number(breakfast_limit) : 3;
            const lLimit = Number(lunch_limit) > 0 ? Number(lunch_limit) : 6;
            const sLimit = Number(snacks_limit) > 0 ? Number(snacks_limit) : 2;
            const dLimit = Number(dinner_limit) > 0 ? Number(dinner_limit) : 6;

            const { data, error } = await supabase
                .from('voting_sessions')
                .insert({
                    title: title.trim(),
                    start_date,
                    end_date,
                    session_weeks: normalizedWeeks,
                    breakfast_limit: bLimit,
                    lunch_limit: lLimit,
                    snacks_limit: sLimit,
                    dinner_limit: dLimit,
                    status: 'draft'
                })
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

            const validStatuses = ['draft', 'open_for_voting', 'closed', 'finalized'];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
            }

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
