export function switchTheme(link, dayIcon, nightIcon) {
    const currentTheme = document.documentElement.getAttribute('data-theme')
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'

    document.documentElement.setAttribute('data-theme', newTheme)

    if (newTheme === 'light') {
        link.innerHTML = dayIcon
    } else {
        link.innerHTML = nightIcon
    }

    localStorage.setItem('theme', newTheme)
}

