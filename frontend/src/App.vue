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
  background-color: #121212;
  color: #FFFFFF;
  font-family: 'Google Sans', 'Noto Sans Thai', sans-serif;
}

body {
  background-color: #121212;
}

#app {
  min-height: 100vh;
}
</style>
