import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

export const config = {
    runtime: 'nodejs'
};

const SECRET_KEY = crypto.createHash('sha256').update('SK_2627').digest();

function encryptData(payload) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { user } = req.query;

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    };

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Gunakan metode GET.' });
    };

    if (!user) {
        return res.status(400).json({ error: 'Masukkan username akun!' });
    };

    const username = user.replace(/^@/, '');

    try {
        const inspect = await axios.get(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });

        const data = cheerio.load(inspect.data)('#__UNIVERSAL_DATA_FOR_REHYDRATION__').text();

        if (!data) {
            if (inspect.data.includes('verify-') || inspect.data.includes('captcha')) {
                return res.status(500).json({
                    error: 'Terkena captcha atau TikTok memblokir request.'
                });
            };

            return res.status(500).json({
                error: 'Data tidak ditemukan. Isi struktur mungkin berubah.'
            });
        };

        const result = JSON.parse(data)?.['__DEFAULT_SCOPE__']?.['webapp.user-detail'];

        if (!result || result.statusCode !== 0) {
            return res.status(404).json({
                error: result?.statusMsg || 'Akun tidak ditemukan atau struktur berubah.'
            });
        };

        const rawResult = {
            success: true,
            user: result.userInfo.user,
            stats: result.userInfo.stats
        };

        return res.status(200).json({
            result: encryptData(rawResult)
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};
