require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/database');

const aiRoutes = require('./routes/ai');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-chatbot' });
});

const PORT = process.env.PORT || 4001;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`AI Chatbot service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start AI Chatbot service:', err);
    process.exit(1);
  });

