/**
 * Meta API routes — spec meta data retrieval and on-demand refresh.
 */

import { Router } from 'express';
import { getMetaWithFreshness, triggerSpecRefresh, isRefreshing } from '../services/metaRefreshManager.js';
import { getSpecData } from '@stillnoob/shared';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/meta/:className/:spec
 * Returns current meta data for a spec (M+ preferred, raid fallback).
 * Public — no auth required.
 */
router.get('/:className/:spec', async (req, res) => {
  try {
    const { className, spec } = req.params;

    // Validate class/spec exists
    const specData = getSpecData(className, spec);
    if (!specData) {
      return res.status(404).json({ error: 'Unknown class/spec combination' });
    }

    const { meta, status, source } = await getMetaWithFreshness(className, spec, 'world');

    res.json({
      specData,
      specMeta: meta,
      metaSource: source,
      metaStatus: status,
      lastUpdated: meta?.lastUpdated || null,
    });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to fetch spec meta' });
  }
});

/**
 * POST /api/v1/meta/:className/:spec/refresh
 * Trigger on-demand refresh for a spec.
 * Requires auth to prevent abuse.
 */
router.post('/:className/:spec/refresh', authenticateToken, async (req, res) => {
  try {
    const { className, spec } = req.params;

    const specData = getSpecData(className, spec);
    if (!specData) {
      return res.status(404).json({ error: 'Unknown class/spec combination' });
    }

    if (isRefreshing(className, spec)) {
      return res.json({
        triggered: false,
        reason: 'Already refreshing',
        metaStatus: 'refreshing',
      });
    }

    triggerSpecRefresh(className, spec, 'mplus');

    res.json({
      triggered: true,
      estimatedTime: '2-3 minutes',
      metaStatus: 'refreshing',
    });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to trigger refresh' });
  }
});

export default router;
