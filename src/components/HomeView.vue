<script setup>
import { ref, computed } from 'vue'
import * as storage from '../lib/storage.js'
import { serializeExport, parseImportFile, decryptImport, stamp } from '../lib/importExport.js'

const props = defineProps({
  profile: { type: Object, required: true }
})
const emit = defineEmits(['start', 'manage-profile', 'changed'])

const banks = computed(() => props.profile.banks || [])
const progress = computed(() => props.profile.progress || {})

function bankProgress(bankId) {
  return progress.value[bankId] || null
}

/* ---------------- 导出 ---------------- */
const showExport = ref(false)
const exportPassword = ref('')
const exportError = ref('')
const exportDone = ref(false)

function openExport() {
  const exportable = banks.value.filter((b) => !b.builtin)
  exportError.value = ''
  exportDone.value = false
  exportPassword.value = ''
  if (exportable.length === 0) {
    exportError.value = '当前档案没有可导出的自建题库（内置示例题库不提供导出）。'
  }
  showExport.value = true
}

function doExport() {
  const exportable = banks.value.filter((b) => !b.builtin)
  if (exportable.length === 0) return
  const json = serializeExport(exportable, exportPassword.value || '')
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `观微题库-${props.profile.nickname}-${stamp()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  exportDone.value = true
}

/* ---------------- 导入 ---------------- */
const showImport = ref(false)
const importStep = ref('choose') // choose | password | conflict | done
const importFileName = ref('')
const importError = ref('')
const importPassword = ref('')
const importedRaw = ref(null)
const pending = ref({ fresh: [], conflicts: [] })
const importSummary = ref(null)

function openImport() {
  showImport.value = true
  importStep.value = 'choose'
  importError.value = ''
  importPassword.value = ''
  importFileName.value = ''
  importedRaw.value = null
  importSummary.value = null
}

async function onFileChosen(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  importFileName.value = file.name
  importError.value = ''
  try {
    const text = await file.text()
    const result = parseImportFile(text)
    if (result.encrypted) {
      importedRaw.value = result
      importPassword.value = ''
      importStep.value = 'password'
    } else {
      startConflictCheck(result.banks)
    }
  } catch (err) {
    importError.value = err.message
  }
}

function confirmDecrypt() {
  try {
    const b = decryptImport(importedRaw.value.data, importPassword.value)
    startConflictCheck(b)
  } catch (err) {
    importError.value = err.message
  }
}

function startConflictCheck(newBanks) {
  const existing = banks.value
  const nameMap = new Map(existing.map((b) => [b.name, b]))
  const conflicts = []
  const fresh = []
  for (const nb of newBanks) {
    if (nameMap.has(nb.name)) {
      conflicts.push({ bank: nb, existing: nameMap.get(nb.name) })
    } else {
      fresh.push(nb)
    }
  }
  if (conflicts.length > 0) {
    pending.value = { fresh, conflicts }
    importStep.value = 'conflict'
  } else {
    doImport(fresh, [], [])
  }
}

function chooseConflict(mode) {
  const { fresh, conflicts } = pending.value
  if (mode === 'skip') {
    doImport(fresh, [], conflicts.map((c) => c.bank.name))
  } else {
    const toReplace = conflicts.map((c) => {
      const nb = { ...c.bank, id: c.existing.id }
      if (c.existing.builtin) delete nb.builtin // 覆盖内置题库后视为自建
      return nb
    })
    doImport(fresh, toReplace, [])
  }
}

function doImport(toAdd, toReplace, skipped) {
  const existingIds = new Set(banks.value.map((b) => b.id))
  const replaceIds = new Set(toReplace.map((b) => b.id))
  const next = banks.value.map((b) => (replaceIds.has(b.id) ? toReplace.find((r) => r.id === b.id) : { ...b }))
  const finalBanks = [...next]
  for (const nb of toAdd) {
    let bank = { ...nb }
    if (existingIds.has(bank.id)) {
      bank = { ...bank, id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }
    }
    finalBanks.push(bank)
  }
  storage.updateBanks(props.profile.id, finalBanks)
  emit('changed')
  importSummary.value = {
    added: toAdd.length,
    replaced: toReplace.length,
    skipped: skipped.length
  }
  importStep.value = 'done'
}

/* ---------------- 删除题库 ---------------- */
const deleteTarget = ref(null)

function askDelete(bank) {
  deleteTarget.value = bank
}

function confirmDelete() {
  if (!deleteTarget.value) return
  const next = banks.value.filter((b) => b.id !== deleteTarget.value.id)
  storage.updateBanks(props.profile.id, next)
  emit('changed')
  deleteTarget.value = null
}
</script>

<template>
  <main class="home">
    <header class="hero">
      <div class="seal">观微</div>
      <h1>术数自习</h1>
      <p class="subtitle">以手观心，以题养学。择一卷而习之。</p>
    </header>

    <!-- 档案栏 -->
    <section class="profile-bar">
      <div class="profile-info">
        <span class="profile-label">书斋</span>
        <span class="profile-name">{{ profile.nickname }}</span>
        <span v-if="banks.length" class="profile-count">共 {{ banks.length }} 卷</span>
      </div>
      <div class="profile-actions">
        <button class="mini-btn ghost" @click="emit('manage-profile')">切换档案</button>
        <button class="mini-btn primary" @click="openImport">导入题库</button>
        <button class="mini-btn primary" @click="openExport">导出题库</button>
      </div>
    </section>

    <!-- 题库列表 -->
    <section class="bank-list">
      <button
        v-for="bank in banks"
        :key="bank.id"
        class="bank-card"
        @click="emit('start', bank)"
      >
        <div class="bank-head">
          <span class="bank-name">
            {{ bank.name }}
            <span v-if="bank.builtin" class="bank-builtin">内置</span>
          </span>
          <span class="bank-count">{{ bank.questions.length }} 题</span>
        </div>
        <p class="bank-desc">{{ bank.description }}</p>
        <div class="bank-foot">
          <span v-if="bankProgress(bank.id)" class="bank-progress">
            已习 {{ bankProgress(bank.id).answered }} 题 · 答对 {{ bankProgress(bank.id).correct }}
          </span>
          <span v-else class="bank-progress">尚未开卷</span>
          <span class="bank-ops">
            <span class="bank-del" title="删除题库" @click.stop="askDelete(bank)">删除</span>
            <span class="bank-cta">开始研习 →</span>
          </span>
        </div>
      </button>

      <p v-if="banks.length === 0" class="empty-tip">书斋空空。可导入题库，或切换档案。</p>
    </section>

    <footer class="home-foot">题库即文件 · 每一题都是基石</footer>

    <!-- 导出面板 -->
    <div v-if="showExport" class="modal-mask" @click.self="showExport = false">
      <div class="modal">
        <h3 class="modal-title">导出题库</h3>
        <p class="modal-desc">将当前档案中的自建题库导出为 JSON 文件（内置示例题库不提供导出）。</p>
        <p v-if="exportError" class="modal-error">{{ exportError }}</p>
        <template v-if="!exportError">
          <label class="field">
            <span class="field-label">导出密码（可选）</span>
            <input v-model="exportPassword" class="input" type="password" maxlength="64" placeholder="设置密码后，文件内容将被加密" />
          </label>
          <p class="modal-hint">加密方案：PBKDF2 派生密钥 + AES 加密；不设密码则为明文 JSON。</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="showExport = false">取消</button>
            <button class="btn primary" @click="doExport">{{ exportDone ? '再次下载' : '生成并下载' }}</button>
          </div>
          <p v-if="exportDone" class="modal-ok">文件已生成并开始下载。</p>
        </template>
        <template v-else>
          <div class="modal-actions">
            <button class="btn ghost" @click="showExport = false">关闭</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 导入面板 -->
    <div v-if="showImport" class="modal-mask" @click.self="showImport = false">
      <div class="modal">
        <h3 class="modal-title">导入题库</h3>

        <!-- 步骤一：选文件 -->
        <template v-if="importStep === 'choose'">
          <p class="modal-desc">从 JSON 文件导入题库到当前档案，将追加至现有题库；同名题库会提示处理方式。</p>
          <label class="file-pick">
            <input type="file" accept=".json,application/json" @change="onFileChosen" />
            <span class="file-pick-btn">选择文件…</span>
          </label>
          <p v-if="importFileName" class="modal-hint">已选择：{{ importFileName }}</p>
          <p v-if="importError" class="modal-error">{{ importError }}</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="showImport = false">取消</button>
          </div>
        </template>

        <!-- 步骤二：解密密码 -->
        <template v-else-if="importStep === 'password'">
          <p class="modal-desc">「{{ importFileName }}」是加密文件，请输入导出时设置的密码。</p>
          <label class="field">
            <span class="field-label">文件密码</span>
            <input v-model="importPassword" class="input" type="password" maxlength="64" placeholder="输入文件密码" />
          </label>
          <p v-if="importError" class="modal-error">{{ importError }}</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="openImport">重新选择</button>
            <button class="btn primary" @click="confirmDecrypt">解密导入</button>
          </div>
        </template>

        <!-- 步骤三：同名冲突 -->
        <template v-else-if="importStep === 'conflict'">
          <p class="modal-desc">检测到 {{ pending.conflicts.length }} 个题库与当前档案同名，请选择处理方式：</p>
          <ul class="conflict-list">
            <li v-for="c in pending.conflicts" :key="c.bank.name">
              「{{ c.bank.name }}」
              <span class="conflict-tag">{{ c.existing.builtin ? '内置' : '已有' }}</span>
            </li>
          </ul>
          <div class="modal-actions">
            <button class="btn ghost" @click="openImport">取消导入</button>
            <button class="btn ghost" @click="chooseConflict('skip')">跳过同名</button>
            <button class="btn primary" @click="chooseConflict('overwrite')">覆盖同名</button>
          </div>
          <p class="modal-hint">跳过：保留现有同名题库；覆盖：用文件内容替换同名题库（内置题库被覆盖后将转为自建）。</p>
        </template>

        <!-- 步骤四：完成 -->
        <template v-else>
          <p class="modal-ok">导入完成</p>
          <ul class="conflict-list">
            <li>新增题库：{{ importSummary.added }} 个</li>
            <li v-if="importSummary.replaced">覆盖同名：{{ importSummary.replaced }} 个</li>
            <li v-if="importSummary.skipped">跳过同名：{{ importSummary.skipped }} 个</li>
          </ul>
          <div class="modal-actions">
            <button class="btn primary" @click="showImport = false">完成</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="modal-mask" @click.self="deleteTarget = null">
      <div class="modal">
        <h3 class="modal-title">删除题库</h3>
        <p class="modal-desc">确定删除题库「{{ deleteTarget.name }}」吗？删除后不可恢复。</p>
        <div class="modal-actions">
          <button class="btn ghost" @click="deleteTarget = null">取消</button>
          <button class="btn danger" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 40px 0 32px;
}

.seal {
  display: inline-block;
  width: 56px;
  height: 56px;
  line-height: 56px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--bg-card);
  font-size: 20px;
  letter-spacing: 2px;
  margin-bottom: 18px;
  box-shadow: 0 6px 18px rgba(139, 58, 46, 0.25);
}

h1 {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 6px;
}

.subtitle {
  margin-top: 12px;
  color: var(--ink-soft);
  font-size: 15px;
  letter-spacing: 1px;
}

/* 档案栏 */
.profile-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 18px;
  margin-bottom: 24px;
}

.profile-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.profile-label {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 2px;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--accent);
}

.profile-count {
  font-size: 12px;
  color: var(--ink-faint);
}

.profile-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mini-btn {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.mini-btn.primary {
  background: var(--bg-card);
  color: var(--accent);
  border: 1px solid var(--accent-soft);
}

.mini-btn.primary:hover {
  background: var(--accent);
  color: var(--bg-card);
}

.mini-btn.ghost {
  background: transparent;
  color: var(--ink-soft);
  border: 1px solid var(--line);
}

.mini-btn.ghost:hover {
  border-color: var(--accent-soft);
  color: var(--accent);
}

/* 题库列表 */
.bank-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bank-card {
  position: relative;
  text-align: left;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px 24px;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}

.bank-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-soft);
  box-shadow: var(--shadow);
}

.bank-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.bank-name {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 2px;
}

.bank-builtin {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--ok-bg);
  color: var(--ok);
  font-size: 11px;
  letter-spacing: 1px;
  vertical-align: 2px;
}

.bank-count {
  font-size: 13px;
  color: var(--accent);
}

.bank-desc {
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.7;
}

.bank-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.bank-progress {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.bank-ops {
  display: inline-flex;
  align-items: center;
}

.bank-cta {
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 1px;
}

.bank-del {
  font-size: 12px;
  color: var(--ink-faint);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 2px 8px;
  margin-right: 10px;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
}

.bank-card:hover .bank-del {
  opacity: 1;
}

.bank-del:hover {
  color: var(--bad);
  border-color: var(--line);
}

.empty-tip {
  text-align: center;
  color: var(--ink-faint);
  font-size: 14px;
  padding: 40px 0;
  letter-spacing: 1px;
}

.home-foot {
  margin-top: 48px;
  text-align: center;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 2px;
}

/* 模态 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(43, 43, 40, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 440px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 28px 28px 24px;
  box-shadow: 0 20px 60px rgba(70, 60, 40, 0.18);
  max-height: 85vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 4px;
  margin-bottom: 12px;
}

.modal-desc {
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.8;
  margin-bottom: 16px;
}

.modal-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--ink-faint);
  line-height: 1.7;
}

.modal-error {
  font-size: 13px;
  color: var(--bad);
  margin-bottom: 12px;
}

.modal-ok {
  font-size: 15px;
  color: var(--ok);
  letter-spacing: 2px;
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
  flex-wrap: wrap;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--ink-soft);
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  font-family: inherit;
  font-size: 15px;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--accent-soft);
}

.file-pick {
  display: inline-block;
}

.file-pick input {
  display: none;
}

.file-pick-btn {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 10px;
  font-size: 14px;
  letter-spacing: 2px;
  background: var(--bg);
  color: var(--ink);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.file-pick-btn:hover {
  border-color: var(--accent-soft);
  color: var(--accent);
}

.conflict-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: var(--ink);
  margin-bottom: 4px;
}

.conflict-list li {
  line-height: 1.6;
}

.conflict-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--bad-bg);
  color: var(--bad);
  font-size: 11px;
  letter-spacing: 1px;
}

.btn {
  padding: 10px 22px;
  border-radius: 10px;
  font-size: 14px;
  letter-spacing: 2px;
  transition: all 0.2s;
}

.btn.primary {
  background: var(--accent);
  color: var(--bg-card);
  border: 1px solid var(--accent);
}

.btn.primary:hover {
  background: var(--accent-soft);
  border-color: var(--accent-soft);
}

.btn.ghost {
  background: transparent;
  color: var(--ink-soft);
  border: 1px solid var(--line);
}

.btn.ghost:hover {
  border-color: var(--accent-soft);
  color: var(--accent);
}

.btn.danger {
  background: var(--bad);
  color: var(--bg-card);
  border: 1px solid var(--bad);
}

.btn.danger:hover {
  opacity: 0.88;
}
</style>
