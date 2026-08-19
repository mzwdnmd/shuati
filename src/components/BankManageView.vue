<script setup>
import { ref, computed } from 'vue'
import * as storage from '../lib/storage.js'

const props = defineProps({
  profile: { type: Object, required: true },
  bankId: { type: String, required: true }
})
const emit = defineEmits(['back', 'changed'])

const bank = computed(() => (props.profile.banks || []).find((b) => b.id === props.bankId) || null)
const questions = computed(() => (bank.value ? bank.value.questions : []))
const builtin = computed(() => !!bank.value && !!bank.value.builtin)
const letter = (i) => String.fromCharCode(65 + i)
const segsOf = (text) => (text || '').split('____')

/* ---------------- 落盘 ---------------- */
function saveBank(nextBank) {
  const next = (props.profile.banks || []).map((b) => (b.id === nextBank.id ? nextBank : b))
  storage.updateBanks(props.profile.id, next)
  emit('changed')
}

function genQuestionId(existing) {
  let id = ''
  do {
    id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  } while (existing.has(id))
  return id
}

/* ---------------- 题库元信息 ---------------- */
const showMeta = ref(false)
const metaForm = ref({ name: '', description: '' })
const metaError = ref('')

function openMeta() {
  if (!bank.value) return
  metaForm.value = { name: bank.value.name, description: bank.value.description || '' }
  metaError.value = ''
  showMeta.value = true
}

function saveMeta() {
  const name = metaForm.value.name.trim()
  if (!name) {
    metaError.value = '题库名称不能为空。'
    return
  }
  const dup = (props.profile.banks || []).find((b) => b.name === name && b.id !== props.bankId)
  if (dup) {
    metaError.value = `已有同名题库「${name}」，请换一个名称。`
    return
  }
  saveBank({ ...bank.value, name, description: metaForm.value.description.trim() })
  showMeta.value = false
}

/* ---------------- 题目编辑（新增 / 编辑共用） ---------------- */
const showQuestion = ref(false)
const editingId = ref(null) // null 表示新增
const qForm = ref({ type: 'single', question: '', options: ['', '', ''], answer: 0, explanation: '', blanks: [] })
const qError = ref('')

function openNewQuestion() {
  qForm.value = { type: 'single', question: '', options: ['', '', ''], answer: 0, explanation: '', blanks: [] }
  editingId.value = null
  qError.value = ''
  showQuestion.value = true
}

function openEditQuestion(q) {
  qForm.value = {
    type: q.type === 'blank' ? 'blank' : 'single',
    question: q.question,
    options: q.options ? [...q.options] : ['', '', ''],
    answer: q.answer,
    explanation: q.explanation || '',
    blanks: q.blanks ? [...q.blanks] : []
  }
  editingId.value = q.id
  qError.value = ''
  showQuestion.value = true
}

function addOption() {
  qForm.value.options.push('')
}

function removeOption(i) {
  if (qForm.value.options.length <= 2) return
  qForm.value.options.splice(i, 1)
  if (qForm.value.answer >= qForm.value.options.length) qForm.value.answer = 0
}

function addBlank() {
  qForm.value.blanks.push('')
}

function removeBlank(i) {
  if (qForm.value.blanks.length <= 1) return
  qForm.value.blanks.splice(i, 1)
}

function saveQuestion() {
  if (qForm.value.type === 'blank') {
    saveBlankQuestion()
    return
  }
  saveSingleQuestion()
}

function saveBlankQuestion() {
  const question = qForm.value.question.trim()
  if (!question) {
    qError.value = '题干不能为空。'
    return
  }
  const blankCount = (question.match(/____/g) || []).length
  if (blankCount === 0) {
    qError.value = '题干中需要有 ____ 占位符（每个考点一个）。'
    return
  }
  const blanks = qForm.value.blanks.map((b) => b.trim())
  if (blanks.length !== blankCount) {
    qError.value = `题干中有 ${blankCount} 个空，但答案填了 ${blanks.length} 个，请保持一致。`
    return
  }
  if (blanks.some((b) => !b)) {
    qError.value = '答案内容不能为空，请填写或删除空答案。'
    return
  }
  const qs = questions.value
  const payload = { question, blanks, explanation: qForm.value.explanation.trim() }
  let nextQuestions
  if (editingId.value) {
    nextQuestions = qs.map((q) => (q.id === editingId.value ? { ...q, ...payload } : q))
  } else {
    const existingIds = new Set(qs.map((q) => q.id))
    nextQuestions = [...qs, { id: genQuestionId(existingIds), type: 'blank', ...payload }]
  }
  const nextBank = { ...bank.value, questions: nextQuestions }
  if (nextBank.builtin) delete nextBank.builtin
  saveBank(nextBank)
  showQuestion.value = false
}

function saveSingleQuestion() {
  const question = qForm.value.question.trim()
  if (!question) {
    qError.value = '题干不能为空。'
    return
  }
  const options = qForm.value.options.map((o) => o.trim())
  if (options.length < 2) {
    qError.value = '至少需要 2 个选项。'
    return
  }
  if (options.some((o) => !o)) {
    qError.value = '选项内容不能为空，请填写或删除空选项。'
    return
  }
  const answer = Number(qForm.value.answer)
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    qError.value = '正确答案必须在选项范围内。'
    return
  }
  const qs = questions.value
  const payload = { question, options, answer, explanation: qForm.value.explanation.trim() }
  let nextQuestions
  if (editingId.value) {
    nextQuestions = qs.map((q) => (q.id === editingId.value ? { ...q, ...payload } : q))
  } else {
    const existingIds = new Set(qs.map((q) => q.id))
    nextQuestions = [...qs, { id: genQuestionId(existingIds), type: 'single', ...payload }]
  }
  const nextBank = { ...bank.value, questions: nextQuestions }
  if (nextBank.builtin) delete nextBank.builtin // 编辑后转为自建题库
  saveBank(nextBank)
  showQuestion.value = false
}

/* ---------------- 删除题目 ---------------- */
const deleteTarget = ref(null)

function askDeleteQuestion(q) {
  deleteTarget.value = q
}

function confirmDeleteQuestion() {
  if (!deleteTarget.value) return
  const nextBank = { ...bank.value, questions: questions.value.filter((q) => q.id !== deleteTarget.value.id) }
  if (nextBank.builtin) delete nextBank.builtin // 删除题目后内容已非内置，转为自建
  saveBank(nextBank)
  deleteTarget.value = null
}
</script>

<template>
  <main v-if="bank" class="manage">
    <header class="manage-bar">
      <button class="back" @click="emit('back')">← 返回书卷</button>
      <div class="manage-heading">
        <h2 class="manage-name">
          {{ bank.name }}
          <span v-if="builtin" class="bank-builtin">内置</span>
        </h2>
        <p class="manage-sub">{{ bank.description || '暂无简介' }} · 共 {{ questions.length }} 题</p>
      </div>
    </header>

    <p v-if="builtin" class="builtin-tip">
      此题库为内置示例，可正常查看与编辑；编辑或删除题目后，将自动转为自建题库（可参与导出）。
    </p>

    <section class="manage-actions">
      <button class="btn ghost" @click="openMeta">编辑题库信息</button>
      <button class="btn primary" @click="openNewQuestion">＋ 新增题目</button>
    </section>

    <!-- 题目列表 -->
    <section class="question-list">
      <article v-for="(q, qi) in questions" :key="q.id" class="q-card">
        <div class="q-head">
          <span class="q-index">第 {{ qi + 1 }} 题</span>
          <span class="q-ops">
            <button class="q-btn" @click="openEditQuestion(q)">编辑</button>
            <button class="q-btn danger" @click="askDeleteQuestion(q)">删除</button>
          </span>
        </div>
        <!-- 填空题 -->
        <template v-if="q.type === 'blank'">
          <p class="q-text blank-view">
            <template v-for="(seg, i) in segsOf(q.question)" :key="i">
              <span>{{ seg }}</span>
              <span v-if="i < segsOf(q.question).length - 1" class="q-blank-mark">____</span>
            </template>
          </p>
          <div class="q-blanks">
            <span v-for="(b, bi) in q.blanks" :key="bi" class="q-blank-answer">
              {{ bi + 1 }}. {{ b }}
            </span>
          </div>
        </template>
        <!-- 单选题 -->
        <template v-else>
          <p class="q-text">{{ q.question }}</p>
          <ul class="q-options">
            <li v-for="(opt, i) in q.options" :key="i" :class="{ correct: i === q.answer }">
              <span class="opt-letter">{{ letter(i) }}</span>
              <span class="opt-text">{{ opt }}</span>
              <span v-if="i === q.answer" class="opt-tag">正解</span>
            </li>
          </ul>
        </template>
        <p v-if="q.explanation" class="q-explanation">
          <span class="exp-label">解析</span>{{ q.explanation }}
        </p>
      </article>

      <div v-if="questions.length === 0" class="empty-tip">
        <p>此题库还没有题目。</p>
        <button class="btn primary" @click="openNewQuestion">新增第一题</button>
      </div>
    </section>

    <!-- 元信息编辑 -->
    <div v-if="showMeta" class="modal-mask" @click.self="showMeta = false">
      <div class="modal">
        <h3 class="modal-title">编辑题库信息</h3>
        <label class="field">
          <span class="field-label">题库名称</span>
          <input v-model="metaForm.name" class="input" maxlength="40" placeholder="给题库起个名字" />
        </label>
        <label class="field">
          <span class="field-label">简介（可选）</span>
          <input v-model="metaForm.description" class="input" maxlength="80" placeholder="一句话介绍本卷" />
        </label>
        <p v-if="metaError" class="modal-error">{{ metaError }}</p>
        <div class="modal-actions">
          <button class="btn ghost" @click="showMeta = false">取消</button>
          <button class="btn primary" @click="saveMeta">保存</button>
        </div>
      </div>
    </div>

    <!-- 题目编辑 -->
    <div v-if="showQuestion" class="modal-mask" @click.self="showQuestion = false">
      <div class="modal wide">
        <h3 class="modal-title">{{ editingId ? '编辑题目' : '新增题目' }}</h3>
        <label class="field">
          <span class="field-label">题干<span v-if="qForm.type === 'blank'" class="field-hint">（挖空处用 ____ 占位）</span></span>
          <textarea v-model="qForm.question" class="input textarea" rows="3" placeholder="请输入题目内容"></textarea>
        </label>

        <!-- 填空题：答案列表 -->
        <div v-if="qForm.type === 'blank'" class="field">
          <span class="field-label">每个空的答案（与题干中的 ____ 一一对应）</span>
          <div class="option-rows">
            <div v-for="(b, i) in qForm.blanks" :key="i" class="option-row">
              <span class="opt-letter">{{ i + 1 }}</span>
              <input v-model="qForm.blanks[i]" class="input" :placeholder="'第 ' + (i + 1) + ' 空答案'" />
              <button
                class="row-del"
                title="删除此答案"
                :disabled="qForm.blanks.length <= 1"
                @click="removeBlank(i)"
              >
                删
              </button>
            </div>
          </div>
          <button class="add-opt" @click="addBlank">＋ 添加答案</button>
        </div>

        <!-- 单选题：选项列表 -->
        <template v-else>
          <div class="field">
            <span class="field-label">选项（至少 2 个，标点为正确答案）</span>
            <div class="option-rows">
              <div v-for="(opt, i) in qForm.options" :key="i" class="option-row">
                <span class="opt-letter">{{ letter(i) }}</span>
                <input v-model="qForm.options[i]" class="input" :placeholder="'选项 ' + letter(i)" />
                <button
                  class="row-del"
                  title="删除此选项"
                  :disabled="qForm.options.length <= 2"
                  @click="removeOption(i)"
                >
                  删
                </button>
              </div>
            </div>
            <button class="add-opt" @click="addOption">＋ 添加选项</button>
          </div>
          <label class="field">
            <span class="field-label">正确答案</span>
            <select v-model="qForm.answer" class="input select">
              <option v-for="(opt, i) in qForm.options" :key="i" :value="i">选项 {{ letter(i) }}</option>
            </select>
          </label>
        </template>
        <label class="field">
          <span class="field-label">解析（可选）</span>
          <textarea v-model="qForm.explanation" class="input textarea" rows="2" placeholder="答案解析或备注"></textarea>
        </label>
        <p v-if="qError" class="modal-error">{{ qError }}</p>
        <div class="modal-actions">
          <button class="btn ghost" @click="showQuestion = false">取消</button>
          <button class="btn primary" @click="saveQuestion">保存题目</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="modal-mask" @click.self="deleteTarget = null">
      <div class="modal">
        <h3 class="modal-title">删除题目</h3>
        <p class="modal-desc">确定删除第 {{ questions.findIndex((q) => q.id === deleteTarget.id) + 1 }} 题「{{ deleteTarget.question }}」吗？删除后不可恢复。</p>
        <div class="modal-actions">
          <button class="btn ghost" @click="deleteTarget = null">取消</button>
          <button class="btn danger" @click="confirmDeleteQuestion">确认删除</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.manage-bar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 0 20px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 18px;
}

.back {
  flex-shrink: 0;
  margin-top: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 13px;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.back:hover {
  border-color: var(--accent-soft);
  color: var(--accent);
}

.manage-heading {
  min-width: 0;
}

.manage-name {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 3px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.manage-sub {
  margin-top: 6px;
  color: var(--ink-soft);
  font-size: 13px;
  letter-spacing: 1px;
  overflow-wrap: anywhere;
}

.bank-builtin {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--ok-bg);
  color: var(--ok);
  font-size: 11px;
  letter-spacing: 1px;
  vertical-align: 4px;
}

.builtin-tip {
  background: var(--ok-bg);
  border: 1px solid rgba(62, 107, 79, 0.18);
  border-radius: 10px;
  color: var(--ok);
  font-size: 13px;
  line-height: 1.8;
  padding: 10px 16px;
  margin-bottom: 18px;
}

.manage-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.q-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px 24px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.q-card:hover {
  border-color: var(--accent-soft);
  box-shadow: var(--shadow);
}

.q-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.q-index {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 2px;
}

.q-ops {
  display: inline-flex;
  gap: 6px;
}

.q-btn {
  padding: 3px 12px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 12px;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.q-btn:hover {
  border-color: var(--accent-soft);
  color: var(--accent);
}

.q-btn.danger:hover {
  border-color: var(--bad);
  color: var(--bad);
}

.q-text {
  font-size: 16px;
  line-height: 1.8;
  margin-bottom: 12px;
}

.blank-view {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  row-gap: 4px;
}

.q-blank-mark {
  color: var(--accent);
  font-weight: 600;
  letter-spacing: 1px;
  margin: 0 2px;
}

.q-blanks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 4px;
}

.q-blank-answer {
  font-size: 13px;
  color: var(--ok);
  background: var(--ok-bg);
  border-radius: 8px;
  padding: 3px 12px;
  letter-spacing: 0.5px;
}

.q-options {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.q-options li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.7;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid transparent;
}

.q-options li.correct {
  background: var(--ok-bg);
  border-color: rgba(62, 107, 79, 0.25);
}

.opt-letter {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-weight: 600;
  color: var(--accent);
}

.opt-text {
  flex: 1;
  overflow-wrap: anywhere;
}

.opt-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ok);
  letter-spacing: 1px;
  margin-left: 8px;
}

.q-explanation {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  font-size: 13px;
  color: var(--ink-soft);
  line-height: 1.8;
}

.exp-label {
  color: var(--accent);
  letter-spacing: 1px;
  margin-right: 8px;
}

.empty-tip {
  text-align: center;
  color: var(--ink-faint);
  font-size: 14px;
  padding: 48px 0;
  letter-spacing: 1px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: center;
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

.modal.wide {
  max-width: 560px;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 4px;
  margin-bottom: 18px;
}

.modal-desc {
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.8;
  margin-bottom: 16px;
  overflow-wrap: anywhere;
}

.modal-error {
  font-size: 13px;
  color: var(--bad);
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

.field-hint {
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.5px;
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

.textarea {
  resize: vertical;
  line-height: 1.7;
}

.select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-faint) 50%), linear-gradient(135deg, var(--ink-faint) 50%, transparent 50%);
  background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.option-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.option-row .input {
  flex: 1;
}

.row-del {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 12px;
  transition: all 0.2s;
}

.row-del:hover:not(:disabled) {
  border-color: var(--bad);
  color: var(--bad);
}

.row-del:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.add-opt {
  padding: 6px 14px;
  border-radius: 8px;
  background: transparent;
  border: 1px dashed var(--line);
  color: var(--ink-soft);
  font-size: 13px;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.add-opt:hover {
  border-color: var(--accent-soft);
  color: var(--accent);
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
