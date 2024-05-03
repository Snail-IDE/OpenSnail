const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(cors());

let accessToken = '';
let uploadedFiles = {};

const generateRandomCode = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

function requestLogger(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${ip} ${req.method} ${req.url}`);
  next();
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for .snail files
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.js' || ext === '.snail') {
      return cb(null, true);
    }
    cb(new Error('Only .js or .snail files are allowed.'));
  }
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/extra/up', (req, res) => {
  res.status(200).send('If you see this, the server is up! The API should work fine.');
});

app.post('/api/upload', upload.single('extension'), (req, res) => {
  const file = req.file;
  const extensionName = req.body.extensionName;
  if (!file || !extensionName) {
    return res.status(400).send('No file or extension name provided.');
  }

  if (extensionName.includes(' ')) {
    return res.status(400).send('Extension name cannot contain spaces.');
  }
  
  const randomCode = generateRandomCode();
  const ext = path.extname(file.originalname);
  const fileName = `${extensionName}-${randomCode}${ext}`;

  uploadedFiles[fileName] = {
    buffer: file.buffer,
    uploadTime: Date.now()
  };

  const extensionURL = `https://opensnail.snail-ide.com/api/download/${randomCode}`;
  res.send(extensionURL);
});

app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const fileInfo = uploadedFiles[filename];
  if (!fileInfo) {
    return res.status(404).send('File not found.');
  }

  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(fileInfo.buffer);
});

app.get('/api/download/tempshare/:randomcode', (req, res) => {
  const randomCode = req.params.randomcode;
  const fileName = Object.keys(uploadedFiles).find(name => name.includes(`-${randomCode}`));
  if (!fileName) {
    return res.status(404).send('File not found.');
  }

  const fileInfo = uploadedFiles[fileName];
  if (!fileInfo) {
    return res.status(404).send('File not found.');
  }

  const downloadURL = `https://opensnail.snail-ide.com/api/download/${fileName}`;
  res.send(downloadURL);
});

setInterval(() => {
  const currentTime = Date.now();
  Object.keys(uploadedFiles).forEach(filename => {
    if (currentTime - uploadedFiles[filename].uploadTime > 15 * 60 * 1000) {
      delete uploadedFiles[filename];
    }
  });
}, 15 * 60 * 1000);

app.get('/auth/discord', (req, res) => {
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`);
});

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

    accessToken = tokenResponse.data.access_token;
    
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

    res.send(htmlResponse);
  } catch (error) {
    console.error('Error during Discord authentication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/userdata', async (req, res) => {
  try {
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is missing' });
    }

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const userData = {
      username: userResponse.data.username,
      profile_picture: `https://cdn.discordapp.com/avatars/${userResponse.data.id}/${userResponse.data.avatar}.png`
    };

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
