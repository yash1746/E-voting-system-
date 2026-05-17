require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const cron = require('node-cron');
const { supabase } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ────────────────────────────────────────
// Docs page — disable CSP so Mermaid.js CDN can load
app.use('/docs.html', helmet({ contentSecurityPolicy: false }));

// All other routes — full security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                        'https://fonts.googleapis.com',
                        'https://cdn.jsdelivr.net'],
      scriptSrcAttr:   ["'unsafe-inline'"],
      styleSrc:        ["'self'", "'unsafe-inline'",
                        'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      fontSrc:         ["'self'", 'https://fonts.gstatic.com'],
      frameSrc:        ["'self'", 'https://www.youtube.com'],
      imgSrc:          ["'self'", 'data:', 'https:'],
      workerSrc:       ["'self'", 'blob:'],
    },
  },
}));

// Trust Vercel's proxy so rate limiters see the real visitor IP
app.set('trust proxy', 1);

app.use(cors({
  origin: true, // Allow the deployed domain automatically
  credentials: true,
}));

// Rate limiting — relaxed in dev, strict in production
const isDev = process.env.NODE_ENV !== 'production';

const authLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 15 * 60 * 1000, // 1 min dev / 15 min prod
  max: isDev ? 100 : 30,                          // 100 dev / 30 prod (per real IP)
  skip: (req) => isDev && req.ip === '::1',        // skip for localhost in dev
  message: { error: 'Too many authentication attempts. Please wait and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 500,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use(generalLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Static Files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Request Logger ─────────────────────────────────────────────
app.use((req, res, next) => {
  if (isDev) console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/elections', require('./routes/electionRoutes'));
app.use('/api/vote', require('./routes/voteRoutes'));
app.use('/api/results', require('./routes/resultsRoutes'));
app.use('/api/parties', require('./routes/partyRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/register', require('./routes/registrationRoutes'));

// ─── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    system: 'National E-Voting System',
  });
});

// ─── SPA Fallback & Catch-All ───────────────────────────────────
app.all('*all', (req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ 
      error: 'Endpoint not found.',
      path: req.path,
      method: req.method
    });
  }
});

// ─── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   🏛️  NATIONAL E-VOTING SYSTEM             ║');
  console.log('║   Secure · Anonymous · Transparent        ║');
  console.log(`║   Running on http://localhost:${PORT}          ║`);
  console.log('╚════════════════════════════════════════════╝\n');

  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project-id')) {
    console.warn('⚠️  WARNING: Supabase not configured. Update your .env file!');
    console.warn('   Get your keys from: https://supabase.com → Project Settings → API\n');
  }

  // ─── Auto Status Scheduler ──────────────────────────────────
  // Checks every minute for elections that should change status
  cron.schedule('* * * * *', async () => {
    const now = new Date().toISOString();

    try {
      // 1. Auto-activate upcoming elections whose start_date has passed
      const { data: activated, error: activateError } = await supabase
        .from('elections')
        .update({ status: 'active' })
        .eq('status', 'upcoming')
        .lte('start_date', now)
        .select('id, title');
      
      if (activated?.length) {
        activated.forEach(e => console.log(`[Scheduler] Election Activated: ${e.title}`));
      }

      // 2. Auto-close active elections whose end_date has passed
      const { data: closed, error: closeError } = await supabase
        .from('elections')
        .update({ status: 'closed' })
        .eq('status', 'active')
        .lte('end_date', now)
        .select('id, title');

      if (closed?.length) {
        closed.forEach(e => console.log(`[Scheduler] Election Closed: ${e.title}`));
      }

    } catch (err) {
      console.error('[Scheduler] Error updating election statuses:', err);
    }
  });
});

module.exports = app;
