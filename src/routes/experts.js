import express from 'express';
import expertAggregator from '../services/expertAggregator.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const results = await expertAggregator.getPlayerConsensus(search);
    res.json(results || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;