const express = require('express');
const router = express.Router();

module.exports = (supabase) => {

    // GET announcements - scoped by caterer_id (student's assigned caterer) OR mess_type
    // Supports: ?caterer_id=xxx or ?mess_type=veg
    router.get('/', async (req, res) => {
        try {
            const { mess_type, caterer_id } = req.query;

            let query = supabase
                .from('announcements')
                .select(`*, caterer:profiles!caterer_id(full_name)`)
                .order('created_at', { ascending: false });

            // If caterer_id is given, filter by that specific caterer
            if (caterer_id) {
                query = query.eq('caterer_id', caterer_id);
            }
            // Also filter by mess_type if given
            if (mess_type) {
                query = query.eq('mess_type', mess_type);
            }

            const { data, error } = await query;
            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST create announcement (caterer)
    router.post('/', async (req, res) => {
        try {
            const { caterer_id, title, body, mess_type } = req.body;
            if (!caterer_id || !title || !body || !mess_type) {
                return res.status(400).json({ error: 'caterer_id, title, body, and mess_type are required' });
            }
            if (typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 100) {
                return res.status(400).json({ error: 'Title must be a string between 5 and 100 characters' });
            }
            if (typeof body !== 'string' || body.trim().length < 10 || body.trim().length > 1000) {
                return res.status(400).json({ error: 'Message body must be a string between 10 and 1000 characters' });
            }
            const validMessTypes = ['all', 'veg', 'non_veg', 'special', 'food_park'];
            if (!validMessTypes.includes(mess_type.toLowerCase())) {
                return res.status(400).json({ error: `Invalid mess type. Must be one of: ${validMessTypes.join(', ')}` });
            }

            const { data, error } = await supabase
                .from('announcements')
                .insert({ 
                    caterer_id, 
                    title: title.trim(), 
                    body: body.trim(), 
                    mess_type: mess_type.toLowerCase() 
                })
                .select()
                .single();
            if (error) throw error;
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE announcement (caterer deletes own)
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('announcements')
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
