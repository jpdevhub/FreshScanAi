// src/lib/theme.ts
export const toggleTheme = () => {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
};

export const initTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  // Apply saved preference, or default to dark mode
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light');
  }
};