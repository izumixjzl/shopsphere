import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { api } from './api'

let echo = null

/**
 * Shared Laravel Echo client for Reverb, or null when Reverb isn't configured
 * (the app then falls back to polling). Private-channel auth goes through the
 * normal API client so it carries the Sanctum bearer token.
 */
export function getEcho() {
  const env = import.meta.env
  if (!env.VITE_REVERB_APP_KEY) return null
  if (!echo) {
    echo = new Echo({
      broadcaster: 'reverb',
      Pusher,
      key: env.VITE_REVERB_APP_KEY,
      wsHost: env.VITE_REVERB_HOST || window.location.hostname,
      wsPort: env.VITE_REVERB_PORT || 80,
      wssPort: env.VITE_REVERB_PORT || 443,
      forceTLS: (env.VITE_REVERB_SCHEME || 'https') === 'https',
      enabledTransports: ['ws', 'wss'],
      authorizer: (channel) => ({
        authorize: (socketId, callback) => {
          api.post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
            .then((res) => callback(null, res.data))
            .catch((err) => callback(err))
        },
      }),
    })
  }
  return echo
}
