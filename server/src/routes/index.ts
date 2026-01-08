import { Router } from 'express';
import userRoutes from './userRoutes.js';
import healthRoutes from './healthRoutes.js';
import converterRoutes from './converterRoutes.js';
import filesRoutes from './filesRoutes.js';
import editorRoutes from './editorRoutes.js';
import aiDetectionRoutes from './aiDetection.js';
import humanizerRoutes from './humanizer.js';
import reductorRoutes from './reductorRoutes.js';
import processRoutes from './processRoutes.js';
import jobRoutes from './jobRoutes.js';
import jobFilesRoutes from './jobFilesRoutes.js';
import oneClickRoutes from './oneClickRoutes.js';

const router = Router();

router.use('/api/users', userRoutes);
router.use('/api/converter', converterRoutes);
router.use('/api/files', filesRoutes);
router.use('/api/editor', editorRoutes);
router.use('/api/ai-detection', aiDetectionRoutes);
router.use('/api/humanizer', humanizerRoutes);
router.use('/api/reductor', reductorRoutes);
router.use('/api/process', processRoutes);
router.use('/api/jobs', jobRoutes);
router.use('/api/jobs', jobFilesRoutes);
router.use('/api/one-click', oneClickRoutes);
router.use('/api', healthRoutes);

export default router;
