const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Import routes
const sessionRoutes = require('./routes/sessions');
const menuRoutes = require('./routes/menu');
const voteRoutes = require('./routes/votes');
const announcementRoutes = require('./routes/announcements');
const aiRoutes = require('./routes/ai');

// Base route
app.get('/', (req, res) => {
  res.json({
    message: 'Hostel Menu Selection API',
    version: '2.0.0',
    endpoints: {
      sessions: '/api/sessions',
      menu: '/api/menu',
      votes: '/api/votes',
      announcements: '/api/announcements',
      ai: '/api/ai'
    }
  });
});

// API Routes
app.use('/api/sessions', sessionRoutes(supabase));
app.use('/api/menu', menuRoutes(supabase));
app.use('/api/votes', voteRoutes(supabase));
app.use('/api/announcements', announcementRoutes(supabase));
app.use('/api/ai', aiRoutes(supabase));

// Import PDF Generator
const { generateReport } = require('./pdfGenerator');

// PDF Generation endpoint
app.get('/api/generate-pdf/:sessionId/:messType', async (req, res) => {
  try {
    const { sessionId, messType } = req.params;

    // Fetch session data
    const { data: session } = await supabase
      .from('voting_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch ALL approved menu items with vote counts for this session/mess
    const { data: items, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        votes(count)
      `)
      .eq('session_id', sessionId)
      .eq('mess_type', messType)
      .eq('approval_status', 'approved')
      .order('date_served', { ascending: true })
      .order('meal_type', { ascending: true });

    if (error) throw error;

    let finalItems = items || [];

    // Calculate vote counts
    finalItems = finalItems.map(item => ({
      ...item,
      vote_count: item.votes && item.votes[0] ? item.votes[0].count : 0
    }));

    // Logic: If finalized, show the "Winning" menu.
    if (session.status === 'finalized') {
      const manualSelections = finalItems.filter(i => i.is_selected);

      if (manualSelections.length > 0) {
        finalItems = manualSelections;
      } else {
        // Fallback: highest votes per slot
        const groups = {};
        finalItems.forEach(item => {
          const key = `${item.date_served}_${item.meal_type}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });

        const winners = [];
        Object.values(groups).forEach(groupItems => {
          groupItems.sort((a, b) => b.vote_count - a.vote_count);
          if (groupItems.length > 0) {
            winners.push(groupItems[0]);
          }
        });
        finalItems = winners;
      }
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=menu-report-${messType}-${new Date().toISOString().split('T')[0]}.pdf`);

    // Generate PDF
    generateReport(session, finalItems, messType, res);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

module.exports = app;
