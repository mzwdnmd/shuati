<script setup>
import { ref, onMounted } from 'vue'
import HomeView from './components/HomeView.vue'
import QuizView from './components/QuizView.vue'
import ProfileGate from './components/ProfileGate.vue'
import * as storage from './lib/storage.js'

const view = ref('gate') // gate | home | quiz
const profile = ref(null)
const currentBank = ref(null)

onMounted(() => {
  const meta = storage.loadMeta()
  const cur = meta && meta.currentProfileId ? meta.profiles.find((p) => p.id === meta.currentProfileId) : null
  if (cur) {
    profile.value = storage.loadProfile(cur.id)
    view.value = 'home'
  } else {
    view.value = 'gate'
  }
})

function onProfileReady(p) {
  profile.value = p
  view.value = 'home'
}

function openManage() {
  view.value = 'gate'
}

function cancelGate() {
  if (profile.value) view.value = 'home'
}

function startQuiz(bank) {
  currentBank.value = bank
  view.value = 'quiz'
}

function backHome() {
  currentBank.value = null
  view.value = 'home'
}

function onChanged() {
  if (profile.value) profile.value = storage.loadProfile(profile.value.id)
}

function onAnswer(correct) {
  if (!profile.value || !currentBank.value) return
  storage.recordProgress(profile.value.id, currentBank.value.id, correct)
  profile.value = storage.loadProfile(profile.value.id)
}
</script>

<template>
  <div class="app">
    <ProfileGate
      v-if="view === 'gate'"
      :current-profile-id="profile ? profile.id : null"
      @ready="onProfileReady"
      @cancel="cancelGate"
    />
    <QuizView v-else-if="view === 'quiz'" :bank="currentBank" @back="backHome" @answer="onAnswer" />
    <HomeView
      v-else-if="profile"
      :profile="profile"
      @start="startQuiz"
      @manage-profile="openManage"
      @changed="onChanged"
    />
  </div>
</template>
