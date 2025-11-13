/**
 * 统计路由
 * GET /stats
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getStats } from '../services/stats.service.js';
import { SuccessResponse } from '../utils/error.js';

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getStats();

        const response: SuccessResponse<typeof stats> = {
          success: true,
          data: stats,
        };

        return reply.send(response);
      } catch (error) {
        throw error;
      }
    }
  );
}

