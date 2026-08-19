import { encryptJSON, decryptJSON } from './crypto.js'

/**
 * 题库导入导出（JSON 文件，带格式版本号）
 * 文件结构：
 * {
 *   "format": "shuati-bank",
 *   "version": 1,
 *   "exportedAt": "...",
 *   "app": "日课",
 *   "encrypted": false,
 *   "banks": [ ... ]
 * }
 * 加密导出时 banks 内容被 AES 加密后放入 data 字段，encrypted 为 true。
 */

export const EXPORT_FORMAT = 'shuati-bank'
export const EXPORT_VERSION = 1

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** 生成导出文件文本；password 为空则不加密 */
export function serializeExport(banks, password) {
  const payload = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: '日课',
    encrypted: false,
    banks
  }
  if (password) {
    payload.encrypted = true
    payload.data = encryptJSON({ banks }, password)
    delete payload.banks
  }
  return JSON.stringify(payload, null, 2)
}

/** 解析导入文件首层：返回 { encrypted, banks? , data? } */
export function parseImportFile(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON 格式')
  }
  if (!obj || typeof obj !== 'object' || obj.format !== EXPORT_FORMAT) {
    throw new Error('文件格式不正确，不是本应用导出的题库文件')
  }
  if (typeof obj.version !== 'number' || obj.version > EXPORT_VERSION) {
    throw new Error('题库文件版本过高，请升级应用后再导入')
  }
  if (obj.encrypted) {
    if (!obj.data || !obj.data.ciphertext) throw new Error('加密文件缺少数据')
    return { encrypted: true, data: obj.data }
  }
  if (!Array.isArray(obj.banks)) throw new Error('题库文件缺少题库数据')
  return { encrypted: false, banks: sanitizeBanks(obj.banks) }
}

/** 解密并解析加密导入文件 */
export function decryptImport(data, password) {
  if (!password) throw new Error('请输入文件密码')
  let obj
  try {
    obj = decryptJSON(data, password)
  } catch {
    throw new Error('密码错误，无法解密文件')
  }
  if (!obj || !Array.isArray(obj.banks)) throw new Error('解密后的数据缺少题库')
  return sanitizeBanks(obj.banks)
}

/** 清洗并校验题库结构，补全缺失字段 */
function sanitizeBanks(banks) {
  return banks.map((b, i) => {
    if (!b || typeof b.name !== 'string' || !b.name.trim()) {
      throw new Error(`第 ${i + 1} 个题库缺少名称`)
    }
    if (!Array.isArray(b.questions) || b.questions.length === 0) {
      throw new Error(`题库「${b.name}」没有题目`)
    }
    const questions = b.questions.map((q, j) => {
      if (!q || typeof q.question !== 'string' || !q.question.trim()) {
        throw new Error(`题库「${b.name}」第 ${j + 1} 题缺少题干`)
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`题库「${b.name}」第 ${j + 1} 题选项不足`)
      }
      const answer = typeof q.answer === 'number' ? q.answer : parseInt(q.answer, 10)
      if (Number.isNaN(answer) || answer < 0 || answer >= q.options.length) {
        throw new Error(`题库「${b.name}」第 ${j + 1} 题答案无效`)
      }
      return {
        id: typeof q.id === 'string' && q.id ? q.id : `q_${Date.now().toString(36)}_${i}_${j}`,
        type: q.type || 'single',
        question: String(q.question).trim(),
        options: q.options.map((o) => String(o)),
        answer,
        explanation: typeof q.explanation === 'string' ? q.explanation : ''
      }
    })
    return {
      id: typeof b.id === 'string' && b.id ? b.id : `b_${Date.now().toString(36)}_${i}`,
      name: String(b.name).trim(),
      description: typeof b.description === 'string' ? b.description : '',
      questions
    }
  })
}

export { stamp }
