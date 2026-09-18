import axios from 'axios';

let activeBotTunnel = 'https://clause-bbs-cemetery-prague.trycloudflare.com';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAE7f-SFi2zqSl-4THBdLAoIYLYY';

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
        });
    };

    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            status: 'online',
            bot_endpoint: activeBotTunnel
        });
    };

    if (req.method === 'POST') {
        const { phone, code, token } = req.body;

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                error: 'ID Seleksi dan Kode OTP wajib diisi!'
            });
        };

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verifikasi Cloudflare Turnstile wajib diselesaikan!'
            });
        };

        try {
            const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            const verifyFormData = new URLSearchParams();
            verifyFormData.append('secret', TURNSTILE_SECRET_KEY);
            verifyFormData.append('response', token);
            if (clientIp) {
                verifyFormData.append('remoteip', clientIp);
            }

            const turnstileRes = await axios.post(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                verifyFormData.toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 5000
                }
            );

            if (!turnstileRes.data || !turnstileRes.data.success) {
                return res.status(403).json({
                    success: false,
                    error: 'Verifikasi keamanan gagal atau token kedaluwarsa. Silakan coba lagi.'
                });
            }

            const response = await axios.post(
                `${activeBotTunnel}/api/verify-otp`,
                { phone, code },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            );

            return res.status(response.status).json(response.data);
        } catch (err) {
            const status = err.response ? err.response.status : 500;
            const errorMsg = err.response?.data?.error || 'Gagal menghubungi bot WhatsApp atau bot sedang offline.';
            
            return res.status(status).json({
                success: false,
                error: errorMsg
            });
        }
    };

    return res.status(405).json({
        success: false,
        error: 'Method Not Allowed'
    });
};
