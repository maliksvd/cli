import isDocker from 'is-docker'
import { updateUser, readUser, writeUser } from 'rc9'
import { homedir } from 'os'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { config } from 'dotenv'

// Load project .env
config()

export const INITIAL_CONFIG = loadUserConfig()
export const NUXT_HUB_URL = process.env.NUXT_HUB_URL || INITIAL_CONFIG.hub?.url || 'https://hub.nuxt.com'
export const MAX_ASSET_SIZE = 25 * 1024 * 1024

export function loadUserConfig () {
  return readUser('.nuxtrc')
}
export function updateUserConfig (config) {
  return updateUser(config, '.nuxtrc')
}
export function writeUserConfig (config) {
  return writeUser(config, '.nuxtrc')
}

export function isHeadless() {
  return isDocker() || Boolean(process.env.SSH_CLIENT || process.env.SSH_TTY)
}

export function projectPath() {
  return withTilde(process.cwd())
}

export function withTilde(path) {
  return path.replace(homedir(), '~')
}

export async function linkProject(project) {
  const path = join(process.cwd(), '.env')
  let env = await readFile(path, 'utf-8').catch(() => '')
  if (env.includes('NUXT_HUB_PROJECT_KEY')) {
    env = env.replace(/NUXT_HUB_PROJECT_KEY=[^\n]+/, `NUXT_HUB_PROJECT_KEY=${project.key}`)
  } else {
    env += `${env.length && env[env.length - 1] !== '\n' ? '\n' : ''}NUXT_HUB_PROJECT_KEY=${project.key}`
  }
  process.env.NUXT_HUB_PROJECT_KEY = project.key
  await writeFile(path, env, 'utf-8')
}

export async function unlinkProject() {
  const path = join(process.cwd(), '.env')
  let env = await readFile(path, 'utf-8').catch(() => '')
  if (env.includes('NUXT_HUB_PROJECT_KEY=')) {
    env = env.replace(/NUXT_HUB_PROJECT_KEY=[^\n]+/, '')
    await writeFile(path, env, 'utf-8')
  }
}
