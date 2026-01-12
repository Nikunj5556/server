const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
// Render automatically provides a PORT environment variable
const port = process.env.PORT || 3000;

// CORS setup to allow your main site to contact this server
app.use(cors({
    origin: '*', // Change this to your main site URL (e.g., https://mysite.com) for security
    methods: ['GET', 'POST']
}));

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const upload = multer({ storage: multer.memoryStorage() });

// Health check for Render
app.get('/', (req, res) => res.send('Server is live!'));

// --- UPLOAD ---
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        const fileName = `${Date.now()}-${req.file.originalname}`;
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }));

        const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        res.status(200).json({ url: publicUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- DOWNLOAD (Proxy) ---
app.get('/download', async (req, res) => {
    try {
        const fileUrl = req.query.url;
        const fileName = fileUrl.split('/').pop();
        const response = await axios({ url: fileUrl, method: 'GET', responseType: 'stream' });
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send('Download failed');
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
