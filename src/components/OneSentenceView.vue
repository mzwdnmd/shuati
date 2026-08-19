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

/* ---------------- 模式切换 ---------------- */
const mode = ref('single') // single | batch

/* ---------------- 批量成题 ---------------- */
const batchText = ref('')
const batchItems = ref([])
const batchErr = ref('')

/** 剥离常见行首编号：① ② …、一、二、…、1. 1、 1． (1) 等 */
function stripNumber(line) {
  let s = line
  s = s.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/, '')
  s = s.replace(/^[一二三四五六七八九十百]+[、.．]/, '')
  s = s.replace(/^\s*[（(]?\d+[）)．.]?[、.．]?\s*/, '')
  return s.trim()
}

/**
 * 默认挖空规则：
 * - 含「是」：挖掉「是」后面第一个词块（如「太阳是恒星」→ 挖「恒星」）
 * - 否则：挖掉句子最后一个词块（按标点/空格切分）；整句仅一个词块时挖最后一个字
 */
function autoBlank(line) {
  const isIdx = line.indexOf('是')
  let pick = null
  let start = 0
  if (isIdx >= 0) {
    const after = line.slice(isIdx + 1)
    const m = after.match(/[^\s，。！？、；：,.!?;:]+/)
    if (m) {
      pick = m[0]
      start = isIdx + 1 + m.index
    }
  }
  if (!pick) {
    const m = line.match(/[^\s，。！？、；：,.!?;:]+$/)
    if (m) {
      if (m[0] === line && line.length > 2) {
        pick = line.slice(-1)
        start = line.length - 1
      } else {
        pick = m[0]
        start = m.index
      }
    }
  }
  if (!pick || pick === line) return null
  return {
    question: line.slice(0, start) + '____' + line.slice(start + pick.length),
    blanks: [pick]
  }
}

function generateBatch() {
  batchErr.value = ''
  if (!batchText.value.trim()) {
    batchErr.value = '请先粘贴文本。'
    return
  }
  const items = []
  for (const raw of batchText.value.split('\n')) {
    const line = stripNumber(raw)
    if (!line) continue
    const auto = autoBlank(line)
    items.push({
      original: line,
      sentence: auto ? auto.question : line,
      blanks: auto ? auto.blanks : [],
      explanation: '',
      expanded: false,
      selValid: false,
      selStart: 0,
      selEnd: 0,
      selText: ''
    })
  }
  if (items.length === 0) {
    batchErr.value = '未能从文本中识别出句子。'
    return
  }
  batchItems.value = items
}

/* ---- 批量题目微调 ---- */
function itemSel(item, e) {
  const el = e.target
  const start = el.selectionStart
  const end = el.selectionEnd
  if (end <= start) {
    item.selValid = false
    return
  }
  const text = item.sentence.slice(start, end)
  if (!text.trim() || text.includes('____')) {
    item.selValid = false
    return
  }
  item.selStart = start
  item.selEnd = end
  item.selText = text.trim()
  item.selValid = true
}

function itemHollow(item) {
  if (!item.selValid) {
    batchErr.value = '请先划选要挖空的词。'
    return
  }
  const s = item.sentence
  item.sentence = s.slice(0, item.selStart) + '____' + s.slice(item.selEnd)
  item.blanks.push(item.selText)
  item.selValid = false
  batchErr.value = ''
}

function itemUndo(item) {
  const idx = item.sentence.lastIndexOf('____')
  if (idx < 0) return
  const last = item.blanks.pop()
  if (last) item.sentence = item.sentence.slice(0, idx) + last + item.sentence.slice(idx + 4)
}

function itemReAuto(item) {
  const auto = autoBlank(item.sentence)
  if (!auto) {
    batchErr.value = '无法自动挖空，请手动划选。'
    return
  }
  item.sentence = auto.question
  item.blanks = auto.blanks
  item.selValid = false
  batchErr.value = ''
}

function itemAddBlank(item) {
  item.blanks.push('')
}

function itemRemoveBlank(item, i) {
  if (item.blanks.length > 1) item.blanks.splice(i, 1)
}

function removeItem(item) {
  batchItems.value = batchItems.value.filter((x) => x !== item)
}

function resetBatch() {
  batchItems.value = []
  batchText.value = ''
  batchErr.value = ''
}

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
  saveToBank([question], '已保存 1 道题', err)
}

/* ---- 批量保存 ---- */
function saveBatch() {
  batchErr.value = ''
  if (batchItems.value.length === 0) {
    batchErr.value = '请先粘贴并生成题目。'
    return
  }
  const qs = []
  for (const item of batchItems.value) {
    const s = item.sentence.trim()
    if (!s) {
      batchErr.value = '存在空句子，请删除该句或补全。'
      return
    }
    const n = (s.match(/____/g) || []).length
    if (n === 0) {
      batchErr.value = `「${s}」尚未挖空，请展开微调。`
      return
    }
    const blanks = item.blanks.map((b) => b.trim())
    if (blanks.length !== n) {
      batchErr.value = `「${s}」有 ${n} 个挖空，但答案 ${blanks.length} 个，请保持一致。`
      return
    }
    if (blanks.some((b) => !b)) {
      batchErr.value = `「${s}」存在空答案，请填写或删除。`
      return
    }
    qs.push({ id: genQuestionId(), type: 'blank', question: s, blanks, explanation: item.explanation.trim() })
  }
  saveToBank(qs, `已保存 ${qs.length} 道题`, batchErr)
}

/** 单句/批量共用的落盘逻辑：questions 为待保存题目数组 */
function saveToBank(questions, okMsg, errRef) {
  if (targetMode.value === 'new') {
    const name = newName.value.trim()
    if (!name) {
      errRef.value = '请输入新题库名称。'
      return
    }
    if (banks.value.some((b) => b.name === name)) {
      errRef.value = `已有同名题库「${name}」，请换一个名称。`
      return
    }
    const bank = { id: genBankId(), name, description: '', questions }
    storage.updateBanks(props.profile.id, [...banks.value, bank])
    emit('done', `${okMsg}到新题库「${name}」`)
  } else {
    if (!targetBankId.value) {
      errRef.value = '请选择题库。'
      return
    }
    const target = banks.value.find((b) => b.id === targetBankId.value)
    if (!target) return
    const nextBank = { ...target, questions: [...target.questions, ...questions] }
    if (nextBank.builtin) delete nextBank.builtin // 向内置题库添加题目后视为自建
    const next = banks.value.map((b) => (b.id === nextBank.id ? nextBank : b))
    storage.updateBanks(props.profile.id, next)
    emit('done', `${okMsg}到题库「${nextBank.name}」`)
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

    <div class="mode-tabs">
      <button class="mode-tab" :class="{ active: mode === 'single' }" @click="mode = 'single'">单句成题</button>
      <button class="mode-tab" :class="{ active: mode === 'batch' }" @click="mode = 'batch'">批量成题</button>
    </div>

    <section v-if="mode === 'single'" class="compose-card">
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

    <section v-else class="compose-card">
      <label class="field">
        <span class="field-label">① 粘贴多行知识点</span>
        <textarea
          v-model="batchText"
          class="input textarea"
          rows="6"
          placeholder="每行一句，可带编号：&#10;1. 肾主水&#10;2、肝主目&#10;一、心主血脉&#10;① 肺主气&#10;或直接每行一句"
        ></textarea>
      </label>
      <div class="select-bar">
        <button class="btn primary small" @click="generateBatch">生成题目</button>
        <span class="spacer"></span>
        <button class="btn ghost small" :disabled="batchItems.length === 0" @click="resetBatch">整批重置</button>
      </div>
      <p class="sel-hint batch-hint">
        自动剥离行首编号（1. 1、① 一、等），空行忽略；含「是」的句子挖「是」后第一个词块，否则挖句尾词块。生成后可逐句微调。
      </p>
      <p v-if="batchErr" class="form-error">{{ batchErr }}</p>

      <div v-if="batchItems.length" class="batch-list">
        <article v-for="(item, i) in batchItems" :key="i" class="batch-item" :class="{ expanded: item.expanded }">
          <div class="batch-item-head" @click="item.expanded = !item.expanded">
            <span class="batch-no">{{ i + 1 }}</span>
            <div class="batch-main">
              <p class="batch-original">{{ item.original }}</p>
              <p class="batch-question">
                <template v-for="(seg, si) in item.sentence.split('____')" :key="si">
                  <span>{{ seg }}</span>
                  <span v-if="si < item.sentence.split('____').length - 1" class="blank-mark">____</span>
                </template>
                <span v-if="!item.sentence.includes('____')" class="batch-warn">（未挖空，请展开微调）</span>
              </p>
            </div>
            <span class="batch-toggle">{{ item.expanded ? '收起' : '微调' }}</span>
            <button class="row-del batch-del" @click.stop="removeItem(item)">删</button>
          </div>
          <div v-if="item.expanded" class="batch-edit">
            <label class="field">
              <span class="field-label">句子（可修改）</span>
              <textarea
                v-model="item.sentence"
                class="input textarea"
                rows="2"
                placeholder="修改句子，或划选句中要考的词后点「挖空」"
                @select="itemSel(item, $event)"
                @mouseup="itemSel(item, $event)"
                @keyup="itemSel(item, $event)"
              ></textarea>
            </label>
            <div class="select-bar">
              <template v-if="item.selValid">
                <span class="sel-tip">已选中「{{ item.selText }}」</span>
                <button class="btn primary small" @click="itemHollow(item)">挖空</button>
              </template>
              <span v-else class="sel-hint">划选句中要考的词后点「挖空」</span>
              <span class="spacer"></span>
              <button class="btn ghost small" :disabled="!item.sentence.includes('____')" @click="itemUndo(item)">撤销一空</button>
              <button class="btn ghost small" @click="itemReAuto(item)">重新自动</button>
            </div>
            <div class="field">
              <span class="field-label">各空答案（与 ____ 一一对应）</span>
              <div class="option-rows">
                <div v-for="(b, bi) in item.blanks" :key="bi" class="option-row">
                  <span class="opt-letter">{{ bi + 1 }}</span>
                  <input v-model="item.blanks[bi]" class="input" :placeholder="'第 ' + (bi + 1) + ' 空答案'" />
                  <button class="row-del" :disabled="item.blanks.length <= 1" @click="itemRemoveBlank(item, bi)">删</button>
                </div>
              </div>
              <button class="add-opt" @click="itemAddBlank(item)">＋ 添加答案</button>
            </div>
            <label class="field">
              <span class="field-label">解析（可选）</span>
              <textarea
                v-model="item.explanation"
                class="input textarea"
                rows="2"
                placeholder="本题解析或备注"
              ></textarea>
            </label>
          </div>
        </article>
      </div>
    </section>

    <section class="save-card">
      <h3 class="save-title">{{ mode === 'single' ? '③ 保存到' : '② 保存 ' + batchItems.length + ' 道题到' }}</h3>
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
      <button
        class="btn primary save-btn"
        :disabled="(mode === 'single' && historyIdx <= 0) || (mode === 'batch' && batchItems.length === 0)"
        @click="mode === 'single' ? save() : saveBatch()"
      >{{ mode === 'single' ? '保存题目' : '整批保存' }}</button>
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

/* ---- 模式切换 ---- */
.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-tab {
  flex: 1;
  padding: 10px 0;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink-soft);
  font-size: 15px;
  letter-spacing: 3px;
  transition: all 0.2s;
}

.mode-tab:hover:not(.active) {
  border-color: var(--accent-soft);
  color: var(--accent);
}

.mode-tab.active {
  background: var(--accent);
  color: var(--bg-card);
  border-color: var(--accent);
}

/* ---- 批量成题 ---- */
.batch-hint {
  margin-top: 8px;
  line-height: 1.8;
}

.batch-list {
  margin-top: 18px;
}

.batch-item {
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 10px;
  overflow: hidden;
}

.batch-item-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.batch-item-head:hover {
  background: var(--bg);
}

.batch-no {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-card);
  font-size: 13px;
}

.batch-main {
  flex: 1;
  min-width: 0;
}

.batch-original {
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.batch-question {
  font-size: 16px;
  line-height: 1.8;
}

.batch-warn {
  color: var(--bad);
  font-size: 12px;
}

.batch-toggle {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.batch-del {
  flex-shrink: 0;
}

.batch-edit {
  padding: 14px 16px 4px;
  border-top: 1px dashed var(--line);
  background: var(--bg);
}

.option-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.opt-letter {
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-faint);
}

.row-del {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 12px;
  cursor: pointer;
}

.row-del:hover:not(:disabled) {
  border-color: var(--bad);
  color: var(--bad);
}

.row-del:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-opt {
  margin-top: 8px;
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
}

.add-opt:hover {
  color: var(--accent-soft);
}
</style>
