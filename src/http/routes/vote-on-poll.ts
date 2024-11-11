import { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import z from 'zod'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { voting } from '../../utils/voting-pub-sub'

export async function voteOnPoll(app: FastifyInstance) {
  app.post('/polls/:pollId/votes', async (request, reply) => {
    // Validação dos parâmetros
    const voteOnPollParams = z.object({
      pollId: z.string().uuid(),
    })
    const { pollId } = voteOnPollParams.parse(request.params)

    const voteOnPollBody = z.object({
      pollOptionId: z.string().uuid(),
    })
    const { pollOptionId } = voteOnPollBody.parse(request.body)

    // Obtém o sessionId do cookie ou gera um novo
    let { sessionId } = request.cookies

    if (!sessionId) {
      sessionId = randomUUID()
      reply.setCookie('sessionId', sessionId, {
        path: '/',
        maxAge: 60 * 24 * 7, // 7 days
        signed: true,
        httpOnly: true,
      })
    }

    // Verifica se o usuário já votou nesta enquete
    const existingVote = await prisma.vote.findUnique({
      where: {
        sessionId_pollId: {
          sessionId,
          pollId,
        },
      },
    })

    if (existingVote) {
      // Verifica se o usuário votou na mesma opção
      if (existingVote.pollOptionId === pollOptionId) {
        return reply.status(400).send({
          message: 'User has already voted on this poll',
        })
      }

      // Apaga o voto anterior se foi em uma opção diferente
      await prisma.vote.delete({
        where: { id: existingVote.id },
      })

      // Decrementa o voto antigo
      const votes = await redis.zincrby(pollId, -1, existingVote.pollOptionId)

      voting.publish(pollId, {
        pollOptionId: existingVote.pollOptionId,
        votes: Number(votes),
      })
    }

    // Registra o novo voto
    await prisma.vote.create({
      data: {
        sessionId,
        pollOptionId,
        pollId,
      },
    })

    // Incrementa o voto na opção escolhida
    const votes = await redis.zincrby(pollId, 1, pollOptionId)

    voting.publish(pollId, {
      pollOptionId,
      votes: Number(votes),
    })

    return reply.status(201).send()
  })
}
