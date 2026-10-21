const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

module.exports = (supabase) => {

    // GET: night mess items (authenticated, filtered by user's block)
    router.get('/', requireAuth(supabase), async (req, res) => {
        try {
            let query = supabase
                .from('night_mess_items')
                .select('*')
                .eq('is_available', true);

            // Determine which block to show
            const { role, hostel_block } = req.auth.profile;

            // If student, filter to their block only; if admin/caterer, show all
            if (role === 'student' && hostel_block) {
                query = query.eq('hostel_block', hostel_block.toUpperCase());
            }

            // Optional query param override for admin/caterer
            const { block } = req.query;
            if ((role === 'admin' || role === 'caterer') && block) {
                query = query.eq('hostel_block', block.toUpperCase());
            }

            query = query.order('name', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST: upload/add night mess item (admin only)
    router.post('/', requireAuth(supabase), requireRole('admin'), async (req, res) => {
        try {
            const { hostel_block, name, price, category } = req.body;

            if (!hostel_block || !name || price == null) {
                return res.status(400).json({ error: 'hostel_block, name, price required' });
            }

            const validBlocks = ['A', 'B', 'C', 'D', 'E'];
            if (!validBlocks.includes(hostel_block.toUpperCase())) {
                return res.status(400).json({ error: 'hostel_block must be A-E' });
            }

            if (isNaN(Number(price)) || Number(price) < 0) {
                return res.status(400).json({ error: 'price must be a non-negative number' });
            }

            const { data, error } = await supabase
                .from('night_mess_items')
                .insert({
                    hostel_block: hostel_block.toUpperCase(),
                    name: name.trim(),
                    category: category || 'General',
                    price: Number(price),
                    uploaded_by: req.auth.profile.id
                })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST: bulk upload via CSV data array (admin only)
    router.post('/bulk', requireAuth(supabase), requireRole('admin'), async (req, res) => {
        try {
            const { items } = req.body;
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'items array required' });
            }

            const validBlocks = ['A', 'B', 'C', 'D', 'E'];
            const cleaned = items.map((it, i) => {
                const block = String(it.hostel_block || '').trim().toUpperCase();
                const name = String(it.name || '').trim();
                const price = Number(it.price);
                const category = String(it.category || 'General').trim();

                if (!validBlocks.includes(block)) throw new Error(`Row ${i}: invalid block ${block}`);
                if (!name) throw new Error(`Row ${i}: name required`);
                if (isNaN(price) || price < 0) throw new Error(`Row ${i}: invalid price`);

                return {
                    hostel_block: block,
                    name,
                    category,
                    price,
                    is_available: true,
                    uploaded_by: req.auth.profile.id
                };
            });

            const { data, error } = await supabase
                .from('night_mess_items')
                .insert(cleaned)
                .select();

            if (error) throw error;
            res.json({ inserted: (data || []).length, items: data });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // PATCH: toggle availability (admin/caterer)
    router.patch('/:id/toggle', requireAuth(supabase), requireRole('admin', 'caterer'), async (req, res) => {
        try {
            const { id } = req.params;
            const { is_available } = req.body;

            const { data, error } = await supabase
                .from('night_mess_items')
                .update({ is_available: Boolean(is_available) })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PATCH: edit item (admin/caterer)
    router.patch('/:id', requireAuth(supabase), requireRole('admin', 'caterer'), async (req, res) => {
        try {
            const { id } = req.params;
            const { name, price, category, hostel_block } = req.body;

            const updates = {};
            if (name !== undefined) updates.name = name.trim();
            if (price !== undefined) {
                const priceNum = Number(price);
                if (isNaN(priceNum) || priceNum < 0) {
                    return res.status(400).json({ error: 'price must be a non-negative number' });
                }
                updates.price = priceNum;
            }
            if (category !== undefined) updates.category = category.trim();
            if (hostel_block !== undefined) {
                const validBlocks = ['A', 'B', 'C', 'D', 'E'];
                if (!validBlocks.includes(hostel_block.toUpperCase())) {
                    return res.status(400).json({ error: 'hostel_block must be A-E' });
                }
                updates.hostel_block = hostel_block.toUpperCase();
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'No updates provided' });
            }

            const { data, error } = await supabase
                .from('night_mess_items')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // DELETE: remove item (admin only)
    router.delete('/:id', requireAuth(supabase), requireRole('admin'), async (req, res) => {
        try {
            const { id } = req.params;
            const { error } = await supabase.from('night_mess_items').delete().eq('id', id);
            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET: all items for admin/caterer (no filtering)
    router.get('/all', requireAuth(supabase), requireRole('admin', 'caterer'), async (req, res) => {
        try {
            const { block } = req.query;
            let query = supabase
                .from('night_mess_items')
                .select('*')
                .order('hostel_block', { ascending: true })
                .order('name', { ascending: true });

            if (block) query = query.eq('hostel_block', block.toUpperCase());

            const { data, error } = await query;
            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
