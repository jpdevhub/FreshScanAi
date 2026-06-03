export const toggleTheme = () => {
  const isLight = document.documentElement.classList.toggle('light');
  try {
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  } catch (e) {
    console.warn("Unable to save theme preference:", e);
  }
};

export const initTheme = () => {
  try {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else if (savedTheme === 'dark') {
      document.documentElement.classList.remove('light');
    } else if (systemPrefersDark) {
      document.documentElement.classList.remove('light');
    } else {
      // Default to light if that's the desired site baseline, 
      // or add 'light' class if the site defaults to dark
      document.documentElement.classList.add('light');
    }
  } catch (e) {
    // If localStorage is blocked, fall back to system preference
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!systemPrefersDark) {
      document.documentElement.classList.add('light');
    }
    console.warn("Unable to read theme preference:", e);
  }
};