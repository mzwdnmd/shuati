<script setup>
defineProps({
  banks: { type: Array, required: true }
})
defineEmits(['start'])
</script>

<template>
  <main class="home">
    <header class="hero">
      <div class="seal">观微</div>
      <h1>术数自习</h1>
      <p class="subtitle">以手观心，以题养学。择一卷而习之。</p>
    </header>

    <section class="bank-list">
      <button
        v-for="bank in banks"
        :key="bank.id"
        class="bank-card"
        @click="$emit('start', bank)"
      >
        <div class="bank-head">
          <span class="bank-name">{{ bank.name }}</span>
          <span class="bank-count">{{ bank.questions.length }} 题</span>
        </div>
        <p class="bank-desc">{{ bank.description }}</p>
        <span class="bank-cta">开始研习 →</span>
      </button>
    </section>

    <footer class="home-foot">题库即文件 · 每一题都是基石</footer>
  </main>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 48px 0 40px;
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
  margin-bottom: 20px;
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

.bank-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bank-card {
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

.bank-cta {
  display: inline-block;
  margin-top: 14px;
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 1px;
}

.home-foot {
  margin-top: 48px;
  text-align: center;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 2px;
}
</style>
