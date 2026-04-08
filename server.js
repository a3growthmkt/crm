const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve public files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for Single Page Applications (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CRM running on port ${PORT}`);
});
