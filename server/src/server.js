import 'dotenv/config';
import { app } from './app.js';
import { connectDb } from './config/db.js';
const port = process.env.PORT || 5000;
connectDb().then(() => app.listen(port, () => console.log(`Khorocha API listening on ${port}`))).catch(err => { console.error('Database connection failed:', err.message); process.exit(1); });
