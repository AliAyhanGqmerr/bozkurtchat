const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();
const http = require('http');
const path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port =  3000; 
const fs = require('fs');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

function blockFiles(req, res, next) {
  const basename = path.basename(req.url).toLowerCase();
 const blockedFiles =  ['index.js']; // Engellenecek dosyaların listesi

  if (blockedFiles.includes(basename)) {
     res.status(403).sendFile(__dirname + '/assets/403.html');
  } else {
    next();
  }
}
app.use(blockFiles); // Middleware'i kullan
app.use(express.static(path.join(__dirname)));
app.use(limiter);

app.use((req, res, next) => {
  res.status(404).sendFile(__dirname + '/assets/404.html');
});

app.use((req, res, next) => {
    if (req.url.length > 100) {
        res.sendFile(__dirname + '/assets/414.html');
    } else {
        next();
    }
});

app.use((req, res, next) => {
  res.status(429).sendFile(__dirname + '/assets/429.html');
});

let usernames = {}; // Store username for each connected socket

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html'); // Serve the HTML file
});
io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'];
  
  console.log('Bir kullanıcı bağlandı', ip);

  // Request username upon connection
  socket.emit('request username');

  socket.on('username', (username) => {
    if (Object.values(usernames).includes(username)) {
      socket.emit('nameusederror', 'Bu kullanıcı adı zaten kullanılıyor.');
      return;
    }
    usernames[socket.id] = username;
    socket.broadcast.emit('kullanıcı katıldı', username);
    console.log(`${username} sohbete katıldı`, ip);
  });

  socket.on('disconnect', () => {
    const username = usernames[socket.id];
    if (username && username.trim()) {
      delete usernames[socket.id];
      socket.broadcast.emit('kullanıcı ayrıldı', username);
      console.log(`${username} sohbetten ayrıldı`, ip);
    } else {
      console.log('Bir kullanıcı ayrıldı', ip);
    }
  });

  socket.on('chat message', (msg) => {
      const username = usernames[socket.id]; // Get username from map
     console.log(`${username} mesaj attı: ${msg}`)
      const fullMessage = `${username}: ${msg}`;
      io.emit('chat message', fullMessage); // Broadcast message with username
    });
  });


server.listen(port, () => {
   console.log(`Sunucu ${port} portunda dinliyor...`);
});
