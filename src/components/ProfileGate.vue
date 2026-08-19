<script setup>
import { ref, onMounted } from 'vue'
import * as storage from '../lib/storage.js'

const props = defineProps({
  currentProfileId: { type: String, default: null }
})
const emit = defineEmits(['ready', 'cancel'])

const mode = ref('select') // select | create | verify
const meta = ref({ profiles: [], currentProfileId: null })

const createForm = ref({ nickname: '', password: '', password2: '' })
const createError = ref('')

const verifyTarget = ref(null)
const verifyPassword = ref('')
const verifyError = ref('')

onMounted(() => {
  meta.value = storage.loadMeta() || { profiles: [], currentProfileId: null }
  if (meta.value.profiles.length === 0) {
    mode.value = 'create'
  }
})

function startCreate() {
  createForm.value = { nickname: '', password: '', password2: '' }
  createError.value = ''
  mode.value = 'create'
}

function cancelCreate() {
  if (meta.value.profiles.length > 0) {
    mode.value = 'select'
  } else {
    emit('cancel')
  }
}

function submitCreate() {
  const nickname = createForm.value.nickname.trim()
  if (!nickname) {
    createError.value = '请填写一个昵称，作为你的书斋名。'
    return
  }
  if (createForm.value.password && createForm.value.password.length < 4) {
    createError.value = '密码至少 4 位；若想不设密码，留空即可。'
    return
  }
  if (createForm.value.password !== createForm.value.password2) {
    createError.value = '两次输入的密码不一致。'
    return
  }
  const profile = storage.createProfile({
    nickname,
    password: createForm.value.password
  })
  emit('ready', profile)
}

function chooseProfile(p) {
  if (p.id === props.currentProfileId) {
    emit('cancel')
    return
  }
  if (p.hasPassword) {
    verifyTarget.value = p
    verifyPassword.value = ''
    verifyError.value = ''
    mode.value = 'verify'
  } else {
    const profile = storage.loadProfile(p.id)
    storage.switchProfile(p.id)
    emit('ready', profile)
  }
}

function submitVerify() {
  const p = verifyTarget.value
  if (!storage.verifyPassword(p, verifyPassword.value)) {
    verifyError.value = '密码不正确，请再试。'
    return
  }
  const profile = storage.loadProfile(p.id)
  storage.switchProfile(p.id)
  emit('ready', profile)
}
</script>

<template>
  <main class="gate">
    <!-- 创建档案 -->
    <section v-if="mode === 'create'" class="gate-card">
      <div class="gate-seal">立</div>
      <h1 class="gate-title">初入观微</h1>
      <p class="gate-sub">设立你的书斋，题库与进度将在此名下独立存放。</p>

      <form class="gate-form" @submit.prevent="submitCreate">
        <label class="field">
          <span class="field-label">昵称</span>
          <input v-model="createForm.nickname" class="input" type="text" maxlength="20" placeholder="如何称呼你" />
        </label>
        <label class="field">
          <span class="field-label">密码（可选）</span>
          <input v-model="createForm.password" class="input" type="password" maxlength="64" placeholder="留空则不设密码" />
        </label>
        <label class="field">
          <span class="field-label">确认密码</span>
          <input v-model="createForm.password2" class="input" type="password" maxlength="64" placeholder="再输入一次" />
        </label>
        <p v-if="createError" class="form-error">{{ createError }}</p>
        <div class="form-actions">
          <button v-if="meta.profiles.length > 0" type="button" class="btn ghost" @click="cancelCreate">返回</button>
          <button type="submit" class="btn primary">入室</button>
        </div>
      </form>
      <p class="gate-tip">密码仅以哈希保存于本机浏览器，请妥善记忆。</p>
    </section>

    <!-- 选择档案 -->
    <section v-else-if="mode === 'select'" class="gate-card">
      <div class="gate-seal">卷</div>
      <h1 class="gate-title">择卷而读</h1>
      <p class="gate-sub">选择一间书斋。设有密码的档案，切换时需验证。</p>

      <div class="profile-list">
        <button
          v-for="p in meta.profiles"
          :key="p.id"
          class="profile-item"
          @click="chooseProfile(p)"
        >
          <span class="profile-name">{{ p.nickname }}</span>
          <span class="profile-lock">{{ p.hasPassword ? '已设密码' : '未设密码' }}</span>
        </button>
      </div>

      <div class="form-actions">
        <button class="btn ghost" @click="emit('cancel')">返回</button>
        <button class="btn primary" @click="startCreate">新建档案</button>
      </div>
    </section>

    <!-- 密码验证 -->
    <section v-else class="gate-card">
      <div class="gate-seal">锁</div>
      <h1 class="gate-title">此卷有锁</h1>
      <p class="gate-sub">「{{ verifyTarget.nickname }}」设有密码，验证通过后方可进入。</p>

      <form class="gate-form" @submit.prevent="submitVerify">
        <label class="field">
          <span class="field-label">密码</span>
          <input v-model="verifyPassword" class="input" type="password" maxlength="64" placeholder="输入档案密码" autofocus />
        </label>
        <p v-if="verifyError" class="form-error">{{ verifyError }}</p>
        <div class="form-actions">
          <button type="button" class="btn ghost" @click="mode = 'select'">返回</button>
          <button type="submit" class="btn primary">验证</button>
        </div>
      </form>
    </section>
  </main>
</template>

<style scoped>
.gate {
  display: flex;
  justify-content: center;
  padding-top: 64px;
}

.gate-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 40px 36px 32px;
  box-shadow: var(--shadow);
  text-align: center;
}

.gate-seal {
  display: inline-block;
  width: 52px;
  height: 52px;
  line-height: 52px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--bg-card);
  font-size: 20px;
  letter-spacing: 2px;
  margin-bottom: 18px;
  box-shadow: 0 6px 18px rgba(139, 58, 46, 0.22);
}

.gate-title {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 6px;
}

.gate-sub {
  margin-top: 10px;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.8;
}

.gate-form {
  margin-top: 26px;
  text-align: left;
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
  padding: 11px 14px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--accent-soft);
}

.form-error {
  margin-top: -4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--bad);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.gate-tip {
  margin-top: 20px;
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 26px 0 8px;
}

.profile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 18px;
  font-size: 15px;
  transition: border-color 0.2s, transform 0.15s;
}

.profile-item:hover {
  border-color: var(--accent-soft);
  transform: translateX(2px);
}

.profile-name {
  font-size: 16px;
  letter-spacing: 2px;
}

.profile-lock {
  font-size: 12px;
  color: var(--ink-faint);
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
</style>
