/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // 이벤트 타입별 색상 클래스
    'border-blue-500', 'bg-blue-50', 'text-blue-600',
    'border-green-500', 'bg-green-50', 'text-green-600',
    'border-purple-500', 'bg-purple-50', 'text-purple-600',
    'border-amber-500', 'bg-amber-50', 'text-amber-600',
    'border-gray-500', 'bg-gray-50', 'text-gray-600',
    'border-rose-500', 'bg-rose-50', 'text-rose-600',
    'border-emerald-500', 'bg-emerald-50', 'text-emerald-600',
    'border-teal-500', 'bg-teal-50', 'text-teal-600',
    'border-cyan-500', 'bg-cyan-50', 'text-cyan-600',
    'border-lime-500', 'bg-lime-50', 'text-lime-600',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 