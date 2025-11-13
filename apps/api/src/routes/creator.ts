/**
 * 创建者路由
 * GET /creator/:address
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProjectsByCreator } from '../services/project.service.js';
import { SuccessResponse } from '../utils/error.js';

interface CreatorParams {
  address: string;
}

export async function creatorRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: CreatorParams }>(
    '/creator/:address',
    async (request: FastifyRequest<{ Params: CreatorParams }>, reply: FastifyReply) => {
      try {
        const { address } = request.params;

        const projects = await getProjectsByCreator(address);

        const response: SuccessResponse<typeof projects> = {
          success: true,
          data: projects,
        };

        return reply.send(response);
      } catch (error) {
        throw error;
      }
    }
  );
}

