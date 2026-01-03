// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');

const app = express();

// 1. Security: Only allow your specific sites to talk to this server
const allowedOrigins = [
  'https://lenscape-studio.netlify.app',
  'https://lenscape-studio-premier-freelance-agency-946105902514.us-west1.run.app',
  'http://localhost:5173' // For local testing
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// 2. Setup Google Cloud Storage
// We will pass the JSON key content via an Environment Variable for security
let storageOptions = {
    projectId: 'my-file-cdn', // Your Project ID
};

if (process.env.GCLOUD_CREDENTIALS) {
    // If running in cloud, read credentials from Env Var
    storageOptions.credentials = JSON.parse(process.env.GCLOUD_CREDENTIALS);
} else {
    // If running locally, look for the file
    storageOptions.keyFilename = './service-account-key.json';
}

const storage = new Storage(storageOptions);
const bucketName = 'lenscape-studio'; 
const bucket = storage.bucket(bucketName);

// 3. Setup Multer (Handling file upload in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit to 10MB
});

// 4. The Upload Endpoint
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    console.log(`Starting upload for: ${req.file.originalname}`);

    // Create a unique filename
    const filename = `uploads/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const blob = bucket.file(filename);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    });

    blobStream.on('error', (err) => {
      console.error('Upload error:', err);
      res.status(500).send(err.message);
    });

    blobStream.on('finish', () => {
      // Construct the public URL
      // Ensure your bucket has "Storage Object Viewer" permissions for "allUsers"
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
      
      console.log(`Upload complete: ${publicUrl}`);
      
      // Return the URL to your frontend
      res.status(200).json({ 
        message: 'Upload successful', 
        url: publicUrl 
      });
    });

    blobStream.end(req.file.buffer);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).send(error.message);
  }
});

// Cloud Run requires listening on process.env.PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});