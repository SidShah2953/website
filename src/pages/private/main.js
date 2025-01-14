onload = () => {
    const c = setTimeout(() => {
      const div = document.getElementById('myDiv');
      div.classList.remove("not-loaded");
      clearTimeout(c);
    }, 1000);
  };