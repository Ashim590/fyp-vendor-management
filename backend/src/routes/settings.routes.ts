import { Router } from 'express';
import ThemeSettings from '../models/ThemeSettings';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get current theme settings (public – used by all clients)
router.get('/theme', async (_req, res) => {
  const settings =
    (await ThemeSettings.findOne().sort({ createdAt: -1 })) ||
    (await ThemeSettings.create({}));
  res.json({
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor
  });
});

// Update theme settings (admin only)
router.put('/theme', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { primaryColor, secondaryColor } = req.body;

  const updated = await ThemeSettings.findOneAndUpdate(
    {},
    {
      primaryColor,
      secondaryColor
    },
    { upsert: true, new: true }
  );

  res.json({
    primaryColor: updated.primaryColor,
    secondaryColor: updated.secondaryColor
  });
});

export default router;

