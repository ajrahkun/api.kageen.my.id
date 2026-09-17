import axios from 'axios';

let activeBotTunnel = 'https://options-mood-annotated-prozac.trycloudflare.com';

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
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                error: 'Nomor WhatsApp dan Kode OTP wajib diisi!'
            })
        };

        try {
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
            })
        }
    };

    return res.status(405).json({
        success: false,
        error: 'Method Not Allowed'
    })
};
