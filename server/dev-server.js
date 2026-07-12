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

app.all('/api/auth', authHandler);
app.all('/api/users', usersHandler);
app.all('/api/feed', feedHandler);
app.all('/api/overrides', overridesHandler);
app.all('/api/monthly-returns', monthlyReturnsHandler);
app.all('/api/settings', settingsHandler);
app.all('/api/admins', adminsHandler);

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[api] dev server listening on http://localhost:${PORT}`);
});
