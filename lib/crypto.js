const crypto = require('crypto')
const { promisify } = require('util')

const CRYPTO_ALGORITHM = 'aes-192-cbc'
const HASH_ALGORITHM = 'sha256'
const CRYPTO_PASSWORD = process.env['CRYPTO_PASSWORD'] || '123456'

let key

async function init () {
  if (key) return

  key = await promisify(crypto.scrypt)(CRYPTO_PASSWORD, 'salt', 24) // 192 bits => 24 byte
}

// We don't have centralized storage for session data. So we simply store the encrypted session data on the client side.
// By using nonce and digest, it should be cryptographically safe
async function encrypt (payload) {
  await init()

  const json = JSON.stringify(payload)
  const hasher = crypto.createHash(HASH_ALGORITHM)
  hasher.update(json)

  const iv = await promisify(crypto.randomFill)(new Uint8Array(16))
  const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM, key, iv)

  return new Promise((resolve, reject) => {
    let encrypted = []

    cipher.on('data', chunk => encrypted.push(chunk))

    cipher.on('end', () => {
      const hash = hasher.digest()
      const ciphertext = Buffer.concat(encrypted)
      resolve(Buffer.concat([hash, iv, ciphertext]).toString('base64'))
    })

    cipher.on('error', reject)

    cipher.end(Buffer.from(json, 'utf-8'))
  })
}

async function decrypt (input) {
  await init()

  const buffer = Buffer.from(input, 'base64')
  const hash = buffer.slice(0, 32)
  const iv = buffer.slice(32, 32 + 16)
  const ciphertext = buffer.slice(32 + 16)

  const decipher = crypto.createDecipheriv(CRYPTO_ALGORITHM, key, iv)

  return new Promise((resolve, reject) => {
    let decrypted = []

    decipher.on('data', chunk => decrypted.push(chunk))

    decipher.on('end', () => {
      const payload = Buffer.concat(decrypted).toString('utf-8')
      const hasher = crypto.createHash(HASH_ALGORITHM)
      hasher.update(payload)
      if (!hasher.digest().equals(hash)) {
        reject(new Error('Session data is corrupted'))
      }

      resolve(JSON.parse(payload))
    })

    decipher.on('error', reject)

    decipher.end(ciphertext)
  })
}

module.exports = { encrypt, decrypt }

// usage:
// ;(async () => {
//   const ciphertext = (await encrypt({foo: 'bar'}))
//   console.log(ciphertext)
//   const plaintext = await decrypt(ciphertext)
//   console.log(plaintext)
// })()