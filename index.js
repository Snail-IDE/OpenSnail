const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Set up Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
  });

  // In-memory store for uploaded files
  let uploadedFiles = {};

  // Endpoint for uploading extension files
  app.post('/api/upload', upload.single('extension'), (req, res) => {
    const file = req.file;
      if (!file) {
          return res.status(400).send('No file uploaded.');
            }
              
                // Store the uploaded file in memory
                  uploadedFiles[file.originalname] = file.buffer;

                    res.send('File uploaded successfully.');
                    });

                    // Endpoint to download uploaded files
                    app.get('/api/download/:filename', (req, res) => {
                      const filename = req.params.filename;
                        const file = uploadedFiles[filename];
                          if (!file) {
                              return res.status(404).send('File not found.');
                                }

                                  res.set('Content-Type', 'application/octet-stream');
                                    res.set('Content-Disposition', `attachment; filename="${filename}"`);
                                      res.send(file);
                                      });

                                      app.listen(port, () => {
                                        console.log(`Server running on http://localhost:${port}`);
                                        });
                                        
