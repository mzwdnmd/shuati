import { sha256 } from './crypto.js'
import shouxiang from '../data/shouxiang.js'

/**
 * localStorage 档案存储层
 * 键设计：
 * - shuati_meta_v1           档案元信息（列表 + 当前档案）
 * - shuati_profile_<id>_v1   单个档案完整数据（题库 + 进度 + 密码哈希）
 * 每个档案的数据完全隔离，互不可见。
 */

const META_KEY = 'shuati_meta_v1'
const profileKey = (id) => `shuati_profile_${id}_v1`

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw)
    if (!meta || !Array.isArray(meta.profiles)) return null
    return meta
  } catch {
    return null
  }
}

function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function loadProfile(id) {
  try {
    const raw = localStorage.getItem(profileKey(id))
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || p.id !== id) return null
    return p
  } catch {
    return null
  }
}

export function saveProfile(profile) {
  localStorage.setItem(profileKey(profile.id), JSON.stringify(profile))
}

/** 内置示例题库（手相入门），新档案预置 */
export function createBuiltinBank() {
  return {
    ...shouxiang,
    questions: shouxiang.questions.map((q) => ({ ...q })),
    builtin: true
  }
}

export function createProfile({ nickname, password }) {
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const profile = {
    id,
    nickname,
    passwordHash: password ? sha256(password) : null,
    createdAt: Date.now(),
    banks: [createBuiltinBank()],
    progress: {}
  }
  saveProfile(profile)

  const meta = loadMeta() || { profiles: [], currentProfileId: null }
  meta.profiles.push({
    id,
    nickname,
    hasPassword: !!password,
    createdAt: profile.createdAt
  })
  meta.currentProfileId = id
  saveMeta(meta)
  return profile
}

export function switchProfile(id) {
  const meta = loadMeta()
  if (!meta) return
  meta.currentProfileId = id
  saveMeta(meta)
}

export function verifyPassword(profile, password) {
  if (!profile.passwordHash) return true
  return sha256(password) === profile.passwordHash
}

export function updateBanks(profileId, banks) {
  const profile = loadProfile(profileId)
  if (!profile) return
  profile.banks = banks
  saveProfile(profile)
}

export function recordProgress(profileId, bankId, correct) {
  const profile = loadProfile(profileId)
  if (!profile) return
  const prog = profile.progress[bankId] || { answered: 0, correct: 0 }
  prog.answered += 1
  if (correct) prog.correct += 1
  profile.progress[bankId] = prog
  saveProfile(profile)
}
