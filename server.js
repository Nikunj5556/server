const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const axios = require('axios'); // For easy streaming of the download
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- UPLOAD ENDPOINT ---
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const fileName = `${Date.now()}_${req.file.originalname}`;
        const bucketName = process.env.AWS_BUCKET_NAME;

        const uploadParams = {
            Bucket: bucketName,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

        res.status(200).json({
            message: 'Uploaded to S3',
            url: publicUrl,
            fileName: fileName
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DOWNLOAD/PROXY ENDPOINT ---
// Your site sends: /download?url=https://movieoo.s3...
app.get('/download', async (req, res) => {
    try {
        const fileUrl = req.query.url;
        if (!fileUrl) return res.status(400).send('URL is required');

        // Extract filename from URL for the download header
        const fileName = fileUrl.split('/').pop();

        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        // Set headers so the browser downloads the file instead of playing/opening it
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', response.headers['content-type']);

        // Pipe the S3 data directly to the user
        response.data.pipe(res);
    } catch (error) {
        console.error('Download error:', error.message);
        res.status(500).send('Error downloading file');
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
