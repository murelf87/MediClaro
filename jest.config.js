/** @type {import('jest').Config} */
module.exports = {
  // Sin preset de expo — usamos Node puro para los tests de servicios
  testEnvironment: 'node',
  testMatch: [
    '**/src/**/__tests__/**/*.test.ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    }],
  },
  moduleNameMapper: {
    '^expo-location$': '<rootDir>/src/services/emergency/__mocks__/expo-location.ts',
    '^expo-speech$': '<rootDir>/src/services/emergency/__mocks__/expo-speech.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/services/emergency/__mocks__/async-storage.ts',
    '^react-native$': '<rootDir>/src/services/emergency/__mocks__/react-native.ts',
    // Supabase client mock genérico (supabaseClient.ts y supabase.ts → mismo mock)
    '^../../../lib/supabaseClient$': '<rootDir>/src/services/emergency/__mocks__/supabaseClient.ts',
    '^../../lib/supabaseClient$': '<rootDir>/src/services/emergency/__mocks__/supabaseClient.ts',
    '^../lib/supabaseClient$': '<rootDir>/src/services/emergency/__mocks__/supabaseClient.ts',
    '^../../../lib/supabase$': '<rootDir>/src/services/emergency/__mocks__/supabaseClient.ts',
    '^../../lib/supabase$': '<rootDir>/src/services/emergency/__mocks__/supabaseClient.ts',
    '^../lib/supabase$': '<rootDir>/src/services/emergency/__mocks__/supabaseClient.ts',
    // react-native-url-polyfill es ESM puro — no hace falta en Node
    '^react-native-url-polyfill/auto$': '<rootDir>/src/services/emergency/__mocks__/react-native-url-polyfill.ts',
    // expo-secure-store y expo-constants no disponibles en Node
    '^expo-secure-store$': '<rootDir>/src/services/emergency/__mocks__/expo-secure-store.ts',
    '^expo-constants$': '<rootDir>/src/services/emergency/__mocks__/expo-constants.ts',
    // «Mis pastillas»: módulos nativos sin versión para Node
    '^expo-crypto$': '<rootDir>/src/services/emergency/__mocks__/expo-crypto.ts',
    '^expo-notifications$': '<rootDir>/src/services/emergency/__mocks__/expo-notifications.ts',
  },
};
