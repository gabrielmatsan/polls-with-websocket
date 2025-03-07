import fastify from 'fastify'
import { createPoll } from './routes/create-poll'
import { getPoll } from './routes/get-polls'
import { voteOnPoll } from './routes/vote-on-poll'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import { pollResults } from './ws/poll-results'

const app = fastify({ logger: true })
app.register(websocket)

app.register(cookie, {
  secret: 'poll-secret-key',
  hook: 'onRequest',
  parseOptions: {},
})

app.register(createPoll)
app.register(getPoll)
app.register(voteOnPoll)

app.register(pollResults)

app.listen({ port: 3333 }).then(() => {
  console.log(`Server is running on port 3333`)
})
