import CryptoJS from 'crypto-js'

/**
 * 密码与加解密工具（基于 crypto-js，纯前端、零后端）
 * - 密码哈希：SHA-256，仅存哈希值，不明文落盘
 * - 文件加密：PBKDF2(SHA-256) 派生密钥 + AES-CBC/PKCS7，随机盐与 IV
 */

export function sha256(text) {
  return CryptoJS.SHA256(String(text)).toString(CryptoJS.enc.Hex)
}

const PBKDF2_ITERATIONS = 10000

/**
 * 加密任意可 JSON 序列化对象，返回加密包（不含明文）
 * @returns {{ ciphertext: string, salt: string, iv: string, iterations: number }}
 */
export function encryptJSON(obj, password) {
  const salt = CryptoJS.lib.WordArray.random(16)
  const iv = CryptoJS.lib.WordArray.random(16)
  const key = CryptoJS.PBKDF2(String(password), salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  })
  const plain = JSON.stringify(obj)
  const cipher = CryptoJS.AES.encrypt(plain, key, { iv })
  return {
    ciphertext: cipher.toString(),
    salt: CryptoJS.enc.Base64.stringify(salt),
    iv: CryptoJS.enc.Base64.stringify(iv),
    iterations: PBKDF2_ITERATIONS
  }
}

/**
 * 解密 encryptJSON 生成的加密包；密码错误或数据损坏时抛错
 */
export function decryptJSON(data, password) {
  if (!data || !data.ciphertext || !data.salt || !data.iv) {
    throw new Error('加密数据不完整')
  }
  const salt = CryptoJS.enc.Base64.parse(data.salt)
  const iv = CryptoJS.enc.Base64.parse(data.iv)
  const iterations = Number(data.iterations) || PBKDF2_ITERATIONS
  const key = CryptoJS.PBKDF2(String(password), salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256
  })
  const decrypted = CryptoJS.AES.decrypt(data.ciphertext, key, { iv })
  const text = decrypted.toString(CryptoJS.enc.Utf8)
  if (!text) {
    throw new Error('密码错误或文件已损坏')
  }
  return JSON.parse(text)
}
