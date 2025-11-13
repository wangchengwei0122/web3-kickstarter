/**
 * 项目列表路由
 * GET /projects
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProjects } from '../services/project.service.js';
import { SuccessResponse } from '../utils/error.js';

interface ProjectsQuery {
  page?: string;
  limit?: string;
  sort?: 'latest' | 'deadline';
}

export async function projectsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ProjectsQuery }>(
    '/projects',
    async (request: FastifyRequest<{ Querystring: ProjectsQuery }>, reply: FastifyReply) => {
      try {
        const { page, limit, sort } = request.query;

        const result = await getProjects({
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          sort,
        });

        const response: SuccessResponse<typeof result> = {
          success: true,
          data: result,
        };

        return reply.send(response);
      } catch (error) {
        throw error;
      }
    }
  );
}

