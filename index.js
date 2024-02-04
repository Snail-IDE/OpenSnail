const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

// In-memory store for uploaded files and their upload times
let uploadedFiles = {};

// Function to generate a random 6-digit code
const generateRandomCode = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

// Set up Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Check if the file extension is .js
    if (path.extname(file.originalname).toLowerCase() === '.js') {
      return cb(null, true);
    }
    // Reject file if extension is not .js
    cb(new Error('Only .js files are allowed.'));
  }
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/extra/up', (req, res) => {
  res.send('If you see this, the server is up! The API should work fine.');
});

// Endpoint for uploading extension files
app.post('/api/upload', upload.single('extension'), (req, res) => {
  const file = req.file;
  const extensionName = req.body.extensionName; // Extract extension name from form data
  if (!file || !extensionName) {
    return res.status(400).send('No file or extension name provided.');
  }

  // Check if extension name contains spaces
  if (extensionName.includes(' ')) {
    return res.status(400).send('Extension name cannot contain spaces.');
  }
  
  // Generate a random code for the file name
  const randomCode = generateRandomCode();

  // Construct the file name using the provided extension name and random code
  const fileName = `${extensionName}-${randomCode}.js`;

  // Store the uploaded file and its upload time in memory
  uploadedFiles[fileName] = {
    buffer: file.buffer,
    uploadTime: Date.now() // Record the upload time
  };

  // Return the URL to the uploaded extension
  const extensionURL = `https://opensnail.onrender.com/api/download/${fileName}`;
  res.send(extensionURL);
});

// Endpoint to download uploaded files
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const fileInfo = uploadedFiles[filename];
  if (!fileInfo) {
    return res.status(404).send('File not found.');
  }

  // Set response headers for file download
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(fileInfo.buffer);
});

// Clean up expired uploads every 15 minutes
setInterval(() => {
  const currentTime = Date.now();
  Object.keys(uploadedFiles).forEach(filename => {
    if (currentTime - uploadedFiles[filename].uploadTime > 15 * 60 * 1000) {
      delete uploadedFiles[filename];
    }
  });
}, 15 * 60 * 1000);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
      
