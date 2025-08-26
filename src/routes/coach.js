import express from 'express';
import { getCoachAdvice } from '../services/aiCoach.js';

const router = express.Router();

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    const response = await getCoachAdvice(question);
    
    res.json({ answer: response });
  } catch (error) {
    console.error('Error in coach route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;