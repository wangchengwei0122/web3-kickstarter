/**
 * 单个项目路由
 * GET /projects/:address
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProjectByAddress, getProjectStatus } from '../services/project.service.js';
import { SuccessResponse } from '../utils/error.js';

interface ProjectParams {
  address: string;
}

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: ProjectParams }>(
    '/projects/:address',
    async (request: FastifyRequest<{ Params: ProjectParams }>, reply: FastifyReply) => {
      try {
        const { address } = request.params;

        const project = await getProjectByAddress(address);
        const status = getProjectStatus(project);

        // const response: SuccessResponse<typeof project & { status: string }> = {
        //   success: true,
        //   data: {
        //     ...project,
        //     status,
        //   },
        // };
        type ProjectResponse = Omit<typeof project, 'status'> & {
          status: ReturnType<typeof getProjectStatus>;
        };

        const response: SuccessResponse<ProjectResponse> = {
          success: true,
          data: {
            ...project,
            status,
          },
        };

        return reply.send(response);
      } catch (error) {
        throw error;
      }
    }
  );
}
