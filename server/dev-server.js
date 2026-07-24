// Local dev only. Mounts the same handler modules Vercel will run as
// serverless functions in production, so behavior matches prod.
import express from 'express';

import authHandler from '../api/auth.js';
import usersHandler from '../api/users.js';
import feedHandler from '../api/feed.js';
import overridesHandler from '../api/overrides.js';
import monthlyReturnsHandler from '../api/monthly-returns.js';
import settingsHandler from '../api/settings.js';
import adminsHandler from '../api/admins.js';

const app = express();
app.use(express.json());

// Wrap each handler so a rejected promise (e.g. a jsonbin read/write
// failure) becomes a 500 response instead of an uncaught rejection that
// crashes the whole dev server and takes every other route down with it.
function safe(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(`[api] ${req.method} ${req.path} failed:`, err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
  };
}

app.all('/api/auth', safe(authHandler));
app.all('/api/users', safe(usersHandler));
app.all('/api/feed', safe(feedHandler));
app.all('/api/overrides', safe(overridesHandler));
app.all('/api/monthly-returns', safe(monthlyReturnsHandler));
app.all('/api/settings', safe(settingsHandler));
app.all('/api/admins', safe(adminsHandler));

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[api] dev server listening on http://localhost:${PORT}`);
});
