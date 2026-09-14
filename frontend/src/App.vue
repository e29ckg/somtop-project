<template>
  <RouterView />
</template>

<script setup>
import { RouterView } from 'vue-router'
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background-color: var(--color-page);
  color: var(--color-text-body);
  font-family: var(--font-family-base);
}

body {
  background-color: var(--color-page);
}

#app {
  min-height: 100vh;
}
</style>
