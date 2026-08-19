<script setup>
import { ref, computed, nextTick } from 'vue'
import * as storage from '../lib/storage.js'

const props = defineProps({
  profile: { type: Object, required: true }
})
const emit = defineEmits(['back', 'done'])

const BLANK = '____'

const banks = computed(() => props.profile.banks || [])
const textRef = ref(null)
const sentence = ref('')
const explanation = ref('')
const err = ref('')

/* ---------------- 划选与挖空 ---------------- */
const selValid = ref(false)
const selText = ref('')
const selStart = ref(0)
const selEnd = ref(0)
const selHint = ref('用鼠标划选句中要考的词，再点「挖空」')

function updateSelection() {
  const el = textRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  if (end <= start) {
    selValid.value = false
    return
  }
  const text = sentence.value.slice(start, end)
  if (!text.trim()) {
    selValid.value = false
    return
  }
  if (text.includes(BLANK)) {
    selValid.value = false
    selHint.value = '不能对已挖空的占位符重复挖空。'
    return
  }
  selStart.value = start
  selEnd.value = end
  selText.value = text.trim()
  selValid.value = true
  selHint.value = '已选中，点击「挖空」生成考点。'
}

function onInput() {
  history.value[historyIdx.value].sentence = sentence.value
  selValid.value = false
  selHint.value = '用鼠标划选句中要考的词，再点「挖空」'
}

/* ---------------- 历史快照（撤销 / 重置） ---------------- */
const history = ref([{ sentence: '', blanks: [] }])
const historyIdx = ref(0)
const blanks = computed(() => history.value[historyIdx.value].blanks)

function pushHistory(s, b) {
  history.value = history.value.slice(0, historyIdx.value + 1)
  history.value.push({ sentence: s, blanks: b })
  historyIdx.value++
  sentence.value = s
}

function undo() {
  if (historyIdx.value <= 0) return
  historyIdx.value--
  sentence.value = history.value[historyIdx.value].sentence
  selValid.value = false
  selHint.value = '已撤销一次挖空。'
  err.value = ''
}

function resetAll() {
  if (historyIdx.value <= 0) return
  historyIdx.value = 0
  sentence.value = history.value[0].sentence
  selValid.value = false
  selHint.value = '已重置，可重新划选。'
  err.value = ''
}

function hollow() {
  if (!selValid.value) {
    err.value = '请先划选要挖空的词。'
    return
  }
  const start = selStart.value
  const end = selEnd.value
  const nextSentence = sentence.value.slice(0, start) + BLANK + sentence.value.slice(end)
  const nextBlanks = [...blanks.value, selText.value]
  pushHistory(nextSentence, nextBlanks)
  selValid.value = false
  err.value = ''
  selHint.value = '挖空成功，可继续划选下一个词。'
  nextTick(() => {
    const el = textRef.value
    if (el) {
      el.focus()
      el.setSelectionRange(start, start + BLANK.length)
    }
  })
}

/* ---------------- 预览 ---------------- */
const segs = computed(() => sentence.value.split(BLANK))

/* ---------------- 保存 ---------------- */
const targetMode = ref('existing') // existing | new
const targetBankId = ref('')
const newName = ref('')

function genQuestionId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function genBankId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function save() {
  const q = sentence.value.trim()
  if (!q) {
    err.value = '请输入句子。'
    return
  }
  const blankCount = (q.match(/____/g) || []).length
  if (blankCount === 0) {
    err.value = '请先划选并挖空要考的词。'
    return
  }
  if (blankCount !== blanks.value.length) {
    err.value = `句中 ${blankCount} 个挖空与 ${blanks.value.length} 条答案数量不一致，请撤销后重新挖空。`
    return
  }
  if (blanks.value.some((b) => !b.trim())) {
    err.value = '挖空答案不能为空。'
    return
  }
  const question = {
    id: genQuestionId(),
    type: 'blank',
    question: q,
    blanks: blanks.value.map((b) => b.trim()),
    explanation: explanation.value.trim()
  }
  if (targetMode.value === 'new') {
    const name = newName.value.trim()
    if (!name) {
      err.value = '请输入新题库名称。'
      return
    }
    if (banks.value.some((b) => b.name === name)) {
      err.value = `已有同名题库「${name}」，请换一个名称。`
      return
    }
    const bank = { id: genBankId(), name, description: '', questions: [question] }
    storage.updateBanks(props.profile.id, [...banks.value, bank])
    emit('done', `已保存到新题库「${name}」`)
  } else {
    if (!targetBankId.value) {
      err.value = '请选择题库。'
      return
    }
    const target = banks.value.find((b) => b.id === targetBankId.value)
    if (!target) return
    const nextBank = { ...target, questions: [...target.questions, question] }
    if (nextBank.builtin) delete nextBank.builtin // 向内置题库添加题目后视为自建
    const next = banks.value.map((b) => (b.id === nextBank.id ? nextBank : b))
    storage.updateBanks(props.profile.id, next)
    emit('done', `已保存到题库「${nextBank.name}」`)
  }
}
</script>

<template>
  <main class="compose">
    <header class="compose-bar">
      <button class="back" @click="emit('back')">← 返回书卷</button>
      <div class="compose-heading">
        <h2>一句话成题</h2>
        <p>一句话进，一道题出 —— 划选要考的词，生成填空题</p>
      </div>
    </header>

    <section class="compose-card">
      <label class="field">
        <span class="field-label">① 输入句子</span>
        <textarea
          ref="textRef"
          v-model="sentence"
          class="input textarea"
          rows="3"
          placeholder="输入或粘贴一句话，如：太阳是恒星"
          @input="onInput"
          @select="updateSelection"
          @mouseup="updateSelection"
          @keyup="updateSelection"
        ></textarea>
      </label>

      <div class="select-bar">
        <template v-if="selValid">
          <span class="sel-tip">已选中「{{ selText }}」</span>
          <button class="btn primary small" @click="hollow">挖空</button>
        </template>
        <span v-else class="sel-hint">{{ selHint }}</span>
        <span class="spacer"></span>
        <button class="btn ghost small" :disabled="historyIdx <= 0" @click="undo">撤销</button>
        <button class="btn ghost small" :disabled="historyIdx <= 0" @click="resetAll">重置</button>
      </div>

      <p v-if="err" class="form-error">{{ err }}</p>

      <div v-if="historyIdx > 0" class="preview">
        <div class="preview-label">预览</div>
        <p class="preview-sentence">
          <template v-for="(seg, i) in segs" :key="i">
            <span>{{ seg }}</span>
            <span v-if="i < segs.length - 1" class="blank-mark">____</span>
          </template>
        </p>
        <div class="preview-meta">共 {{ blanks.length }} 空</div>
        <ul v-if="blanks.length" class="answer-list">
          <li v-for="(b, i) in blanks" :key="i">
            <span class="answer-index">{{ i + 1 }}.</span>{{ b }}
          </li>
        </ul>
      </div>

      <label class="field">
        <span class="field-label">② 解析（可选）</span>
        <textarea
          v-model="explanation"
          class="input textarea"
          rows="2"
          placeholder="答案解析或备注，如：恒星是自身发光的球状天体"
        ></textarea>
      </label>
    </section>

    <section class="save-card">
      <h3 class="save-title">③ 保存到</h3>
      <div class="save-mode">
        <label class="radio">
          <input v-model="targetMode" type="radio" value="existing" /> 已有题库
        </label>
        <label class="radio">
          <input v-model="targetMode" type="radio" value="new" /> 新建题库
        </label>
      </div>
      <template v-if="targetMode === 'existing'">
        <select v-model="targetBankId" class="input select">
          <option value="" disabled>选择题库…</option>
          <option v-for="b in banks" :key="b.id" :value="b.id">
            {{ b.name }}（{{ b.questions.length }} 题）{{ b.builtin ? '· 内置' : '' }}
          </option>
        </select>
      </template>
      <template v-else>
        <input v-model="newName" class="input" maxlength="40" placeholder="新题库名称，如：地理常识" />
      </template>
      <button class="btn primary save-btn" :disabled="historyIdx <= 0" @click="save">保存题目</button>
    </section>
  </main>
</template>

<style scoped>
.compose-bar {
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

.compose-heading h2 {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 3px;
}

.compose-heading p {
  margin-top: 6px;
  color: var(--ink-soft);
  font-size: 13px;
  letter-spacing: 1px;
}

.compose-card,
.save-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px 26px;
  margin-bottom: 16px;
}

.field {
  display: block;
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--ink-soft);
  letter-spacing: 1px;
  margin-bottom: 8px;
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
  line-height: 1.9;
  font-size: 17px;
}

.select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-faint) 50%), linear-gradient(135deg, var(--ink-faint) 50%, transparent 50%);
  background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.select-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.sel-tip {
  font-size: 14px;
  color: var(--accent);
  letter-spacing: 1px;
}

.sel-hint {
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.spacer {
  flex: 1;
}

.form-error {
  font-size: 13px;
  color: var(--bad);
  margin: 8px 0 0;
}

.preview {
  margin: 16px 0;
  padding: 16px 18px;
  background: var(--bg);
  border: 1px dashed var(--line);
  border-radius: 12px;
}

.preview-label {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.preview-sentence {
  font-size: 18px;
  line-height: 1.9;
  letter-spacing: 0.5px;
}

.blank-mark {
  color: var(--accent);
  font-weight: 600;
  letter-spacing: 2px;
}

.preview-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--accent);
  letter-spacing: 1px;
}

.answer-list {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--ok);
}

.answer-index {
  color: var(--ink-faint);
  margin-right: 4px;
}

.save-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  margin-bottom: 12px;
}

.save-mode {
  display: flex;
  gap: 20px;
  margin-bottom: 14px;
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}

.radio input {
  accent-color: var(--accent);
}

.save-btn {
  width: 100%;
  margin-top: 16px;
}

.btn {
  padding: 10px 22px;
  border-radius: 10px;
  font-size: 14px;
  letter-spacing: 2px;
  transition: all 0.2s;
}

.btn.small {
  padding: 6px 16px;
  font-size: 13px;
  letter-spacing: 1px;
}

.btn.primary {
  background: var(--accent);
  color: var(--bg-card);
  border: 1px solid var(--accent);
}

.btn.primary:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: var(--accent-soft);
}

.btn.ghost {
  background: transparent;
  color: var(--ink-soft);
  border: 1px solid var(--line);
}

.btn.ghost:hover:not(:disabled) {
  border-color: var(--accent-soft);
  color: var(--accent);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
