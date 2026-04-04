#!/usr/bin/env node

/**
 * Script de debug para verificar que las variables de .env se cargan correctamente
 * Uso: node debug-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Leer el archivo .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

console.log('📋 Contenido del .env:');
console.log('─'.repeat(60));

const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
const envVars = {};

lines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

// Mostrar variables VITE_GEMINI
console.log('🔑 Claves de API Gemini cargadas:');
console.log('─'.repeat(60));

const geminiKeys = Object.entries(envVars).filter(([key]) => key.startsWith('VITE_GEMINI'));

geminiKeys.forEach(([key, value]) => {
  const masked = value.substring(0, 20) + '...' + value.substring(value.length - 5);
  console.log(`✓ ${key}: ${masked}`);
});

console.log('\n📊 Resumen:');
console.log('─'.repeat(60));
console.log(`Total claves de API: ${geminiKeys.length}`);
console.log(`VITE_GEMINI_API_KEY_FALLBACK presente: ${!!envVars['VITE_GEMINI_API_KEY_FALLBACK']}`);
console.log(`VITE_GEMINI_API_KEY_FALLBACK_2 presente: ${!!envVars['VITE_GEMINI_API_KEY_FALLBACK_2']}`);

const fallbacks = [
  envVars['VITE_GEMINI_API_KEY_FALLBACK'],
  envVars['VITE_GEMINI_API_KEY_FALLBACK_2']
].filter(Boolean);

console.log(`\n✅ ${fallbacks.length} claves fallback disponibles para el workflow`);

// Simular lo que hace chatbotLogic.js
console.log('\n🧪 Simulación de chatbotLogic.js:');
console.log('─'.repeat(60));

const PRIMARY_API_KEY = envVars['VITE_GEMINI_API_KEY'] || '';
const FALLBACK_API_KEYS = [
  envVars['VITE_GEMINI_API_KEY_FALLBACK'] || '',
  envVars['VITE_GEMINI_API_KEY_FALLBACK_2'] || '',
].filter(key => key && key.length > 0);
const API_KEYS = PRIMARY_API_KEY ? [PRIMARY_API_KEY, ...FALLBACK_API_KEYS] : FALLBACK_API_KEYS;

console.log(`✓ PRIMARY_API_KEY: ${PRIMARY_API_KEY.substring(0, 20)}...`);
console.log(`✓ FALLBACK_API_KEYS: ${FALLBACK_API_KEYS.length} claves`);
console.log(`✓ API_KEYS totales: ${API_KEYS.length} claves`);

console.log('\n✨ Debug completado. El .env está listo para inyectar en el workflow.');
