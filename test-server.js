import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Fantasy Coach NFL API - Test Server Working!' });
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});

export default app;
