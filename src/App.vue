<script setup>
import { ref } from 'vue'
import HomeView from './components/HomeView.vue'
import QuizView from './components/QuizView.vue'
import { quizBanks } from './data/index.js'

const currentBank = ref(null)

const startQuiz = (bank) => {
  currentBank.value = bank
}

const backHome = () => {
  currentBank.value = null
}
</script>

<template>
  <div class="app">
    <QuizView v-if="currentBank" :bank="currentBank" @back="backHome" />
    <HomeView v-else :banks="quizBanks" @start="startQuiz" />
  </div>
</template>
