// Import the Express framework
const express = require('express');
// Import the path module for working with file and directory paths
const path = require('path');
// Create an instance of the Express application
const app = express();
// Define the port number the server will listen on
const port = process.env.PORT || 3000;

// Serve static files (CSS, JS, images, etc.) from the project directory
app.use(express.static(path.join(__dirname)));

// Serve index.html for all routes (single-page app routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 