const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const app = express();
const PORT = 3000;

// Infrastructure Configuration
const AWS_CONFIG = {
  region: 'eu-north-1',
  bucket: 'movieoo',
  credentials: {
    accessKeyId: 'AKIAVRLYUWE74MLT4FFI',
    secretAccessKey: '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'
  }
};

const s3Client = new S3Client({
  region: AWS_CONFIG.region,
  credentials: AWS_CONFIG.credentials
});

// Multer configured for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB Limit
});

app.use(cors());
app.use(express.json());

// Heartbeat
app.get('/', (req, res) => {
  res.json({ status: "Lenscape S3 Node Operational", region: AWS_CONFIG.region });
});

/**
 * Upload Endpoint
 * Receives multipart/form-data with 'image' and optional 'folder'
 */
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file payload detected.');
    }

    const folder = req.body.folder || 'uploads';
    const fileName = `${folder}/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;

    const uploadParams = {
      Bucket: AWS_CONFIG.bucket,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read' // Assumes your bucket allows public ACLs
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const s3Url = `https://${AWS_CONFIG.bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${fileName}`;
    
    console.log(`[S3-SUCCESS] Asset Deployed: ${s3Url}`);
    res.json({ url: s3Url });

  } catch (error) {
    console.error('[S3-ERROR]', error);
    res.status(500).json({ error: 'Infrastructure Sync Failed', details: error.message });
  }
});

/**
 * Download Endpoint
 * Proxies or Redirects to S3 Asset
 */
app.get('/download', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send('Missing path parameter.');

  const s3Url = `https://${AWS_CONFIG.bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${filePath}`;
  
  // Since objects are 100% public, we can simply redirect to the S3 URL
  // The browser will handle the download if the path is visited
  res.redirect(s3Url);
});

app.listen(PORT, () => {
  console.log(`Lenscape Studio Server running on port ${PORT}`);
  console.log(`AWS Node: ${AWS_CONFIG.region} / ${AWS_CONFIG.bucket}`);
});
