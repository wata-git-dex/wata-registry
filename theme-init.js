(() => {
  try {
    const saved = localStorage.getItem("wata-theme");
    const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = saved || (systemDark ? "dark" : "light");
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
