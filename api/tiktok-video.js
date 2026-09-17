import axios from 'axios';
import crypto from 'crypto';

export const config = {
    runtime: 'nodejs'
};

const SECRET_KEY = crypto.createHash('sha256').update(process.env.ENCRYPT_KEY || 'SK_2627').digest();
const regex = /https:\/\/(www\.)?tiktok\.com\/(@[^\/]+\/(video|photo)\/\d+|\w+\/\d+|\w+)|https:\/\/(vt|vm)\.tiktok\.com\/\w+/i;

function encryptData(payload) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    };

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Gunakan metode GET.'
        })
    };

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            error: 'Masukkan parameter url video atau slide TikTok!'
        })
    };

    if (!regex.test(url)) {
        return res.status(400).json({
            error: 'URL yang dimasukkan bukan link TikTok yang valid!'
        })
    };

    try {
        const response = await axios.post('https://www.tikwm.com/api/', {}, {
            params: {
                url: url,
                hd: 1
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 15000
        });

        const data = response.data;

        if (!data || data.code !== 0 || !data.data) {
            return res.status(400).json({
                error: data?.msg || 'Gagal mengambil data dari TikTok atau video privat.'
            });
        };

        const info = data.data;

        const rawResult = {
            success: true,
            title: info.title || '',
            duration: info.duration || 0,
            cover: info.cover || null,
            author: {
                id: info.author?.id || '',
                uniqueId: info.author?.unique_id || '',
                nickname: info.author?.nickname || '',
                avatar: info.author?.avatar || ''
            },
            type: info.images && info.images.length > 0 ? 'image' : 'video',
            video: info.play ? {
                noWatermark: info.play.startsWith('http') ? info.play : `https://www.tikwm.com${info.play}`,
                hd: info.hdplay ? (info.hdplay.startsWith('http') ? info.hdplay : `https://www.tikwm.com${info.hdplay}`) : null,
                watermark: info.wmplay ? (info.wmplay.startsWith('http') ? info.wmplay : `https://www.tikwm.com${info.wmplay}`) : null
            } : null,
            music: info.music ? (info.music.startsWith('http') ? info.music : `https://www.tikwm.com${info.music}`) : null,
            images: info.images || [],
            stats: {
                playCount: info.play_count || 0,
                diggCount: info.digg_count || 0,
                commentCount: info.comment_count || 0,
                shareCount: info.share_count || 0,
                downloadCount: info.download_count || 0
            }
        };

        return res.status(200).json({
            result: encryptData(rawResult)
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
};
