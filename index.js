const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000; // Use PORT environment variable if available, otherwise default to 3000

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(cors());

// Define a global variable to store the access token
let accessToken = '';

// In-memory store for uploaded files and their upload times
let uploadedFiles = {};

// Function to generate a random 6-digit code
const generateRandomCode = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

function requestLogger(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${ip} ${req.method} ${req.url}`);
    next();
}

// Set up Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Check if the file extension is .snail
    if (path.extname(file.originalname).toLowerCase() === '.snail') {
      return cb(null, true);
    }
    // Reject file if extension is not .js
    cb(new Error('Only .snail files are allowed.'));
  }
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/extra/up', (req, res) => {
  res.status(200).send('If you see this, the server is up! The API should work fine.');
});

app.get('/silly/billy', (req, res) => {
  res.send('🐌🐌🐌🐌🐌🐌🐌🐌🐌🐌');
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
  const extensionURL = `https://opensnail.snail-ide.com/api/download/${fileName}`;
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


// Discord

// Route to initiate the OAuth2 flow
app.get('/auth/discord', (req, res) => {
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`);
});

// Route to handle callback from Discord OAuth2
app.get('/auth/discord/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', querystring.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    accessToken = tokenResponse.data.access_token; // Store the access token globally
    
    // Get user data from Discord API
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const userData = {
      username: userResponse.data.username,
      profile_picture: `https://cdn.discordapp.com/avatars/${userResponse.data.id}/${userResponse.data.avatar}.png`,
      auth_token: accessToken
    };

    // Prepare HTML response to execute the script
    const htmlResponse = `
      <html>
      <head>
        <script>
          window.onload = function() {
            window.close();
          };
        </script>
      </head>
      <body>
        <pre>${JSON.stringify(userData, null, 2)}</pre>
      </body>
      </html>
    `;

    // Send the HTML response
    res.send(htmlResponse);
  } catch (error) {
    console.error('Error during Discord authentication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to fetch user data from Discord API
app.get('/api/userdata', async (req, res) => {
  try {
    // Check if the access token is available
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is missing' });
    }

    // Make a request to the Discord API to fetch user data
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    // Extract relevant user data
    const userData = {
      username: userResponse.data.username,
      profile_picture: `https://cdn.discordapp.com/avatars/${userResponse.data.id}/${userResponse.data.avatar}.png`
    };

    // Return the user data as JSON response
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});