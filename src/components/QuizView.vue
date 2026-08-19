<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  bank: { type: Object, required: true }
})
const emit = defineEmits(['back', 'answer'])

const idx = ref(0)
const picked = ref(null)      // 已选答案索引
const answered = ref(false)   // 本题是否已作答
const score = ref(0)
const finished = ref(false)
const lastCorrect = ref(null) // 本题是否答对（单选/填空共用）
const blankInputs = ref([])   // 填空输入
const blankError = ref('')

const questions = computed(() => props.bank.questions)
const total = computed(() => questions.value.length)
const current = computed(() => questions.value[idx.value])
const segs = computed(() => (current.value.question || '').split('____'))

const normalize = (s) => (s || '').trim().toLowerCase()

function choose(i) {
  if (answered.value) return
  picked.value = i
  answered.value = true
  lastCorrect.value = i === current.value.answer
  if (lastCorrect.value) score.value++
  emit('answer', lastCorrect.value)
}

function submitBlank() {
  if (answered.value) return
  if (blankInputs.value.some((v) => !normalize(v))) {
    blankError.value = '请填写所有空后再交卷。'
    return
  }
  blankError.value = ''
  const correct = current.value.blanks.every((b, i) => normalize(blankInputs.value[i]) === normalize(b))
  answered.value = true
  lastCorrect.value = correct
  if (correct) score.value++
  emit('answer', correct)
}

function blankClass(i) {
  if (!answered.value) return ''
  return normalize(blankInputs.value[i]) === normalize(current.value.blanks[i]) ? 'correct' : 'wrong'
}

function next() {
  if (idx.value + 1 >= total.value) {
    finished.value = true
    return
  }
  idx.value++
  picked.value = null
  answered.value = false
  lastCorrect.value = null
  blankError.value = ''
  blankInputs.value = current.value.blanks ? current.value.blanks.map(() => '') : []
}

function restart() {
  idx.value = 0
  picked.value = null
  answered.value = false
  lastCorrect.value = null
  blankError.value = ''
  score.value = 0
  finished.value = false
  blankInputs.value = current.value.blanks ? current.value.blanks.map(() => '') : []
}

function optionClass(i) {
  if (!answered.value) return ''
  if (i === current.value.answer) return 'correct'
  if (i === picked.value) return 'wrong'
  return 'dim'
}

const rate = computed(() => Math.round((score.value / total.value) * 100))
</script>

<template>
  <main class="quiz">
    <header class="quiz-bar">
      <button class="back" @click="emit('back')">← 返回</button>
      <span class="quiz-title">{{ bank.name }}</span>
      <span class="quiz-progress">{{ idx + 1 }} / {{ total }}</span>
    </header>

    <!-- 完成页 -->
    <section v-if="finished" class="result-card">
      <div class="result-seal">绩</div>
      <h2>研习已毕</h2>
      <p class="result-score">{{ score }} / {{ total }}</p>
      <p class="result-rate">正确率 {{ rate }}%</p>
      <div class="result-actions">
        <button class="btn ghost" @click="emit('back')">返回书卷</button>
        <button class="btn primary" @click="restart">再习一遍</button>
      </div>
    </section>

    <!-- 刷题页 -->
    <section v-else class="question-card" :key="'q-' + idx">
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: ((idx + 1) / total * 100) + '%' }"></div>
      </div>

      <!-- 填空题型 -->
      <template v-if="current.type === 'blank'">
        <h2 class="question blank-question">
          <template v-for="(seg, i) in segs" :key="i">
            <span>{{ seg }}</span>
            <input
              v-if="i < segs.length - 1"
              v-model="blankInputs[i]"
              class="blank-input"
              :class="answered ? blankClass(i) : ''"
              :disabled="answered"
              :placeholder="answered ? '' : '填空'"
            />
          </template>
        </h2>
        <p v-if="blankError" class="blank-error">{{ blankError }}</p>
        <button v-if="!answered" class="btn primary submit-btn" @click="submitBlank">交卷</button>
      </template>

      <!-- 单选题型 -->
      <div v-else class="options">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          class="option"
          :class="optionClass(i)"
          @click="choose(i)"
        >
          <span class="opt-mark">{{ String.fromCharCode(65 + i) }}</span>
          <span class="opt-text">{{ opt }}</span>
          <span v-if="answered && i === current.answer" class="opt-tag">正解</span>
          <span v-else-if="answered && i === picked" class="opt-tag">未中</span>
        </button>
      </div>

      <transition name="fade">
        <div v-if="answered" class="explanation">
          <p class="exp-label">{{ lastCorrect ? '答对了' : '记下这处' }}</p>
          <div v-if="current.type === 'blank'" class="blank-answers">
            <span v-for="(b, i) in current.blanks" :key="i" class="blank-answer">
              {{ i + 1 }}. {{ b }}
            </span>
          </div>
          <p v-if="current.explanation" class="exp-text">{{ current.explanation }}</p>
          <button class="btn primary next-btn" @click="next">
            {{ idx + 1 >= total ? '查看成绩' : '下一题' }}
          </button>
        </div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.quiz-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 24px;
}

.back {
  background: none;
  border: none;
  color: var(--ink-soft);
  font-size: 14px;
  letter-spacing: 1px;
  transition: color 0.2s;
}

.back:hover {
  color: var(--accent);
}

.quiz-title {
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--ink);
}

.quiz-progress {
  font-size: 14px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.question-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 32px 32px 28px;
  box-shadow: var(--shadow);
}

.progress-track {
  height: 3px;
  background: var(--line);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 28px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.question {
  font-size: 21px;
  font-weight: 600;
  line-height: 1.7;
  letter-spacing: 0.5px;
  margin-bottom: 26px;
}

/* 填空题型 */
.blank-question {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: 6px;
}

.blank-input {
  width: 96px;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--accent-soft);
  border-radius: 0;
  font-family: inherit;
  font-size: 21px;
  font-weight: 600;
  color: var(--ink);
  text-align: center;
  outline: none;
  margin: 0 6px;
  padding: 0 6px 2px;
  transition: border-color 0.2s, color 0.2s;
}

.blank-input:focus {
  border-bottom-color: var(--accent);
}

.blank-input.correct {
  border-bottom-color: var(--ok);
  color: var(--ok);
}

.blank-input.wrong {
  border-bottom-color: var(--bad);
  color: var(--bad);
}

.blank-error {
  font-size: 13px;
  color: var(--bad);
  margin: -14px 0 14px;
}

.submit-btn {
  margin-top: 6px;
  width: 100%;
}

.blank-answers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-bottom: 10px;
}

.blank-answer {
  font-size: 14px;
  color: var(--ok);
  letter-spacing: 0.5px;
  background: var(--ok-bg);
  border-radius: 8px;
  padding: 4px 12px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 15px;
  line-height: 1.6;
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
}

.option:hover:not(.correct):not(.wrong):not(.dim) {
  border-color: var(--accent-soft);
  transform: translateX(2px);
}

.opt-mark {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--ink-soft);
}

.option.correct {
  background: var(--ok-bg);
  border-color: var(--ok);
}

.option.correct .opt-mark {
  background: var(--ok);
  color: #fff;
  border-color: var(--ok);
}

.option.wrong {
  background: var(--bad-bg);
  border-color: var(--bad);
}

.option.wrong .opt-mark {
  background: var(--bad);
  color: #fff;
  border-color: var(--bad);
}

.option.dim {
  opacity: 0.55;
}

.opt-text {
  flex: 1;
}

.opt-tag {
  font-size: 12px;
  color: var(--ink-soft);
  letter-spacing: 1px;
}

.explanation {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px dashed var(--line);
}

.exp-label {
  font-size: 14px;
  color: var(--accent);
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.exp-text {
  font-size: 14px;
  line-height: 1.9;
  color: var(--ink-soft);
}

.next-btn {
  margin-top: 18px;
  width: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.result-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 48px 32px;
  text-align: center;
  box-shadow: var(--shadow);
}

.result-seal {
  width: 64px;
  height: 64px;
  line-height: 64px;
  margin: 0 auto 20px;
  border-radius: 14px;
  background: var(--accent);
  color: var(--bg-card);
  font-size: 26px;
}

.result-card h2 {
  font-size: 24px;
  letter-spacing: 6px;
  margin-bottom: 16px;
}

.result-score {
  font-size: 40px;
  font-weight: 600;
  color: var(--accent);
}

.result-rate {
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: 15px;
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 28px;
}

.btn {
  padding: 11px 26px;
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
</style>
