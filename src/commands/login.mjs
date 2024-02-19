import { hostname } from 'os'
import { consola } from 'consola'
import { defineCommand } from 'citty'
import { isHeadless, fetchUser, updateUserConfig, $api, NUXT_HUB_URL } from '../utils/index.mjs'
import { createApp, eventHandler, toNodeListener, getQuery, sendRedirect } from 'h3'
import { getRandomPort } from 'get-port-please'
import { listen } from 'listhen'
import { withQuery, joinURL } from 'ufo'
import open from 'open'

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Authenticate with NuxtHub.',
  },
  async setup() {
    if (isHeadless()) {
      throw new Error('nuxthub login is not supported in Docker or SSH yet.')
    }
    const user = await fetchUser()
    if (user) {
      return consola.info(`Already logged in as \`${user.name}\``)
    }
    // Create server for OAuth flow
    let listener
    const app = createApp()
    let handled = false
    // Get machine name
    const host = hostname().replace(/-/g, ' ').replace('.local', '').replace('.home', '')
    const tokenName = `NuxtHub CLI on ${host}`
    // eslint-disable-next-line no-async-promise-executor
    await new Promise(async (resolve, reject) => {
      app.use('/', eventHandler(async (event) => {
        if (handled)  return
        handled = true
        const code = getQuery(event).code

        if (code) {
          const { token } = await $api('/cli/verify', {
            method: 'POST',
            body: {
              code,
              name: tokenName
            }
          }).catch((err) => {
            consola.error(err.message)
            return { token: null }
          })
          const user = await $api('/user', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }).catch(() => null)
          if (user?.name) {
            updateUserConfig({ hub: { userToken: token } })
            consola.success('Authenticated successfully!')

            resolve()
            return sendRedirect(event, joinURL(NUXT_HUB_URL, '/cli/status?success'))
          }
        }
        consola.error('Authentication error, please try again.')
        reject()
        return sendRedirect(event, joinURL(NUXT_HUB_URL, '/cli/status?error'))
      }))
      const randomPort = await getRandomPort()
      listener = await listen(toNodeListener(app), {
        showURL: false,
        port: randomPort
      })
      const authUrl = withQuery(joinURL(NUXT_HUB_URL, '/api/cli/authorize'), { redirect: listener.url })
      consola.info('Please visit the following URL in your web browser:')
      consola.info(`\`${authUrl}\``)
      consola.info('Waiting for authentication to be completed...')
      open(authUrl)
    })
    // Close server after 1s to make sure we have time to handle the request
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await listener.close()
  },
})
