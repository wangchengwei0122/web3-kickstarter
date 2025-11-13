/**
 * Fastify API 启动文件
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './utils/env.js';
import { errorHandler } from './utils/error.js';
import { projectsRoutes } from './routes/projects.js';
import { projectRoutes } from './routes/project.js';
import { creatorRoutes } from './routes/creator.js';
import { statsRoutes } from './routes/stats.js';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // 注册 CORS
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  });

  // 注册错误处理器
  fastify.setErrorHandler(errorHandler);

  // 健康检查路由
  fastify.get('/healthz', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 注册业务路由
  await fastify.register(projectsRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(creatorRoutes);
  await fastify.register(statsRoutes);

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();

    const address = await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    console.log(`🚀 API ready at ${address}`);
    console.log(`📊 Health check: ${address}/healthz`);
    console.log(`📝 Environment: ${env.NODE_ENV}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// 启动服务器
start();

